const db = require("../utils/sqlite");
const logger = require("../utils/logger");
const {getPasswordHash, validateString} = require("../utils/utils");
const {error, texto, identificador} = require("../utils/validaciones");

function datosUsuario(datos, nuevo=false){
    const nombre = texto(datos.nombre, "Nombre", {opcional: true});
    const email = texto(datos.email, "Email", {max: 254}).toLowerCase();
    if(!validateString(email, "email")) throw error("Ingrese un email válido");
    const contrasena = datos.contrasena;
    if(nuevo || (contrasena !== undefined && contrasena !== null && contrasena !== "")){
        if(typeof contrasena !== "string" || !contrasena || Buffer.byteLength(contrasena, "utf8") > 72){
            throw error("La contraseña es obligatoria y debe tener hasta 72 bytes");
        }
    }
    const esAdmin = datos.esAdmin === true || datos.esAdmin === 1 || datos.esAdmin === "1" ? 1 : 0;
    return {nombre, email, contrasena, esAdmin};
}

function getHTML(req, res){
    res.status(200).render("layouts/dashboard", {title: "Usuarios", page: "../pages/usuarios", script: "../../js/usuarios.js", usuario: req.session.data});
}

async function listado(req, res){
    try{
        const usuarios = await db.executeQuery("SELECT id, nombre, email, esAdmin FROM usuarios WHERE eliminado = 0 ORDER BY nombre, id");
        res.status(200).json(usuarios);
    }catch(err){
        console.log(err);
        logger.log("Error en usuarios: " + err.message, "error");
    }
}

async function nuevo(req, res){
    try{
        const {nombre, email, contrasena, esAdmin} = datosUsuario(req.body || {}, true);
        const coincidencias = await db.executeQuery("SELECT id FROM usuarios WHERE email = ?", [email]);
        if(coincidencias.length) return res.status(409).json({error: "Ya existe un usuario con ese email"});
        const contrasenaHash = await getPasswordHash(contrasena);
        const usuario = db.transaction(consultar => {
            const resultado = consultar("INSERT INTO usuarios (nombre, email, contrasena, eliminado, esAdmin) VALUES (?, ?, ?, 0, ?)", [nombre, email, contrasenaHash, esAdmin]);
            consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [new Date().toISOString(), req.session.data.email, "nuevo_usuario", `Se creó el usuario ${email} (ID ${resultado.insertId})`]);
            return {id: resultado.insertId, nombre, email, esAdmin};
        });
        res.status(201).json(usuario);
    }catch(err){
        console.log(err);
        logger.log("Error en usuarios: " + err.message, "error");
    }
}

async function modificar(req, res){
    try{
        const usuarioId = identificador(req.body?.usuarioId, "Usuario");
        const {nombre, email, contrasena, esAdmin} = datosUsuario(req.body || {});
        const contrasenaHash = contrasena ? await getPasswordHash(contrasena) : null;
        const usuario = db.transaction(consultar => {
            const usuarios = consultar("SELECT id, nombre, email, esAdmin FROM usuarios WHERE id = ? AND eliminado = 0", [usuarioId]);
            if(!usuarios.length) return {status: 404, error: "Usuario no encontrado"};
            if(contrasenaHash && usuarios[0].esAdmin && usuarioId !== Number(req.session.data.id)){
                return {status: 403, error: "No se puede modificar la contraseña de otro administrador"};
            }
            if(consultar("SELECT id FROM usuarios WHERE email = ? AND id != ?", [email, usuarioId]).length){
                return {status: 409, error: "Ya existe un usuario con ese email"};
            }
            if(usuarios[0].esAdmin && !esAdmin && consultar("SELECT COUNT(*) AS cantidad FROM usuarios WHERE esAdmin = 1 AND eliminado = 0")[0].cantidad <= 1){
                return {status: 409, error: "No se puede quitar el permiso al último administrador"};
            }
            if(contrasenaHash){
                consultar("UPDATE usuarios SET nombre = ?, email = ?, contrasena = ?, esAdmin = ? WHERE id = ?", [nombre || usuarios[0].nombre, email, contrasenaHash, esAdmin, usuarioId]);
            }else{
                consultar("UPDATE usuarios SET nombre = ?, email = ?, esAdmin = ? WHERE id = ?", [nombre || usuarios[0].nombre, email, esAdmin, usuarioId]);
            }
            consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [new Date().toISOString(), req.session.data.email, "modificar_usuario", `Se modificó el usuario ${usuarioId} (${email})`]);
            return {...usuarios[0], nombre: nombre || usuarios[0].nombre, email, esAdmin};
        });
        if(usuario.error) return res.status(usuario.status).json({error: usuario.error});
        if(usuarioId === Number(req.session.data.id)) Object.assign(req.session.data, {nombre: usuario.nombre, email, esAdmin: !!esAdmin});
        res.status(200).json(usuario);
    }catch(err){
        console.log(err);
        logger.log("Error en usuarios: " + err.message, "error");
    }
}

async function eliminar(req, res){
    try{
        const usuarioId = identificador(req.body?.usuarioId, "Usuario");
        const actorEmail = req.session.data.email;
        const resultado = db.transaction(consultar => {
            const usuarios = consultar("SELECT id, nombre, email, esAdmin FROM usuarios WHERE id = ? AND eliminado = 0", [usuarioId]);
            if(!usuarios.length) return {status: 404, error: "Usuario no encontrado"};
            if(usuarios[0].esAdmin && consultar("SELECT COUNT(*) AS cantidad FROM usuarios WHERE esAdmin = 1 AND eliminado = 0")[0].cantidad <= 1){
                return {status: 409, error: "No se puede eliminar el último administrador"};
            }
            consultar("UPDATE usuarios SET eliminado = 1 WHERE id = ?", [usuarioId]);
            consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [new Date().toISOString(), actorEmail, "eliminar_usuario", `Se eliminó el usuario ${usuarioId} (${usuarios[0].email})`]);
        });
        if(resultado?.error) return res.status(resultado.status).json({error: resultado.error});
        if(usuarioId === Number(req.session.data.id)) delete req.session.data;
        res.status(200).json({id: usuarioId});
    }catch(err){
        console.log(err);
        logger.log("Error en usuarios: " + err.message, "error");
    }
}

module.exports = {getHTML, listado, nuevo, modificar, eliminar};
