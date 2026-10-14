const db = require("../utils/sqlite");
const utils = require("../utils/utils");
const info = require("../utils/info");
const { promisify } = require("util");

function getHTML(req, res){
    res.status(200).render(
        "layouts/dashboard", 
        {
            title: "Inicio", 
            page: "../pages/inicio",
            script: "../../js/inicio.js",
        });
}

async function iniciarSesion(req, res){
    let sesionRenovada = false;
    try{
        const { email, contrasena } = req.body || {};
        if(typeof email !== "string" || typeof contrasena !== "string" || !contrasena)  return res.status(400).json({error: "Ingrese email y contraseña"});
        const correo = email.trim().toLowerCase();
        if(correo.length > 254 || !utils.validateString(correo, "email")) return res.status(400).json({error: "Ingrese un email válido"});
        if(Buffer.byteLength(contrasena, "utf8") > 72) return res.status(400).json({error: "La contraseña es demasiado larga"});

        const usuarios = await db.executeQuery("SELECT id, nombre, email, contrasena, esAdmin FROM usuarios WHERE LOWER(TRIM(email)) = ? AND COALESCE(eliminado, 0) != 1 LIMIT 2", [correo]);
        const usuario = usuarios.length === 1 ? usuarios[0] : null;
        if(!usuario || typeof usuario.contrasena !== "string" || !await utils.comparePasswordHash(contrasena, usuario.contrasena)){
            return res.status(401).json({error: "Email o contraseña incorrectos"});
        }

        const esAdmin = usuario.esAdmin === true || usuario.esAdmin === 1 || usuario.esAdmin === "1";
        if(esAdmin && info.config.adminHabilitado === false){
            return res.status(403).json({error: "El inicio de sesión de administradores está deshabilitado"});
        }
        const direccion = req.socket.remoteAddress;
        const esServidor = direccion === "127.0.0.1" || direccion === "::1" || direccion === "::ffff:127.0.0.1";
        if(esAdmin && !esServidor){
            return res.status(403).json({error: "Los administradores solo pueden iniciar sesión desde localhost"});
        }
        await promisify(req.session.regenerate).call(req.session);
        sesionRenovada = true;
        req.session.data = {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            esAdmin,
            esServidor
        };
        await promisify(req.session.save).call(req.session);
        await db.executeQuery("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [new Date().toISOString(), usuario.email, "inicio_sesion", "El usuario inició sesión"]);
        res.status(200).json({success: true, usuario: req.session.data});
    }catch(error){
        if(sesionRenovada) delete req.session.data;
        res.status(500).json({error: error.code === "ERR_SQLITE_ERROR" && error.message.includes("no such table: usuarios") ? "La base de datos no tiene la tabla usuarios configurada" : "Error al iniciar sesión"});
    }
}
async function cerrarSesion(req, res){
    try{
        await promisify(req.session.destroy).call(req.session);
        res.clearCookie("ventas2026.sid", {path: "/"});
        await db.executeQuery("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [new Date().toISOString(), req.session.data.email, "cerrar_sesion", "El usuario cerró sesión"]);
        if(req.method === "GET") return res.redirect("/");
        res.status(200).json({success: true});
    }catch(error){
        if(req.method === "GET") return res.status(500).send("Error al cerrar sesión");
        res.status(500).json({error: "Error al cerrar sesión"});
    }
}

module.exports = {
    getHTML,
    iniciarSesion,
    cerrarSesion
}
