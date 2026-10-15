const db = require("../utils/sqlite");
const logger = require("../utils/logger");
const {entero} = require("../utils/validaciones");

async function getHTML(req, res){
    try{
        const eventos = await db.executeQuery("SELECT id FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = '' ORDER BY id DESC LIMIT 1");
        const eventoEnCurso = !!eventos.length;
        res.status(200).render("layouts/dashboard", {title: "Productos", page: "../pages/productos", script: "../../js/productos.js", usuario: req.session.data, eventoEnCurso});
    }catch(err){
        console.log(err);
        logger.log("Error en productos: " + err.message, "error");
    }
}

async function nuevo(req, res){
    try{
        const datos = req.body || {};
        const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
        if(!nombre || nombre.length > 200) return res.status(400).json({error: "El nombre es obligatorio y debe tener hasta 200 caracteres"});
        if(![0, 1, "0", "1"].includes(datos.visible)) return res.status(400).json({error: "Indique si el producto está visible en ventas"});
        for(const campo of ["costo", "precio", "stock"]){
            if(campo === "stock" && datos.stock === undefined) continue;
            try{
                entero(datos[campo], campo === "costo" ? "Costo" : campo === "precio" ? "Precio" : "Stock", {negativo: campo === "stock"});
            }catch(err){
                return res.status(400).json({error: err.message});
            }
        }
        const resultado = db.transaction(consultar => {
            if(consultar("SELECT id FROM productos WHERE nombre = ? COLLATE NOCASE AND eliminado = 0", [nombre]).length){
                return {status: 409, error: "Ya existe un producto con ese nombre"};
            }
            const eventos = consultar("SELECT id FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = '' ORDER BY id DESC LIMIT 1");
            const eventoEnCurso = !!eventos.length;
            if(eventoEnCurso && Number(datos.stock || 0) !== 0){
                return {status: 409, error: "No se puede modificar el stock mientras hay un evento en curso", stockBloqueado: true};
            }
            const insercion = consultar("INSERT INTO productos (nombre, costo, precio, stock, visible) VALUES (?, ?, ?, ?, ?)", [nombre, Number(datos.costo), Number(datos.precio), eventoEnCurso ? 0 : Number(datos.stock || 0), Number(datos.visible)]);
            const producto = consultar("SELECT * FROM productos WHERE id = ?", [insercion.insertId])[0];
            consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [new Date().toISOString(), req.session.data.email, "nuevo_producto", `Se creó el producto ${producto.nombre} (ID ${producto.id}); costo $${producto.costo}, precio $${producto.precio}, stock ${producto.stock}, visible en ventas: ${producto.visible ? "sí" : "no"}`]);
            return producto;
        });
        if(resultado.error) return res.status(resultado.status).json({error: resultado.error, stockBloqueado: resultado.stockBloqueado});
        res.status(201).json(resultado);
    }catch(err){
        console.log(err);
        logger.log("Error en productos: " + err.message, "error");
    }
}

async function modificar(req, res){
    try{
        const datos = req.body || {};
        const productoId = Number(datos.productoId);
        if(!Number.isSafeInteger(productoId) || productoId <= 0) return res.status(400).json({error: "Producto no válido"});
        const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
        if(!nombre || nombre.length > 200) return res.status(400).json({error: "El nombre es obligatorio y debe tener hasta 200 caracteres"});
        if(![0, 1, "0", "1"].includes(datos.visible)) return res.status(400).json({error: "Indique si el producto está visible en ventas"});
        for(const campo of ["costo", "precio", "stock"]){
            if(campo === "stock" && datos.stock === undefined) continue;
            try{
                entero(datos[campo], campo === "costo" ? "Costo" : campo === "precio" ? "Precio" : "Stock", {negativo: campo === "stock"});
            }catch(err){
                return res.status(400).json({error: err.message});
            }
        }
        const resultado = db.transaction(consultar => {
            const productos = consultar("SELECT * FROM productos WHERE id = ? AND eliminado = 0", [productoId]);
            if(!productos.length) return {status: 404, error: "Producto no encontrado"};
            if(consultar("SELECT id FROM productos WHERE nombre = ? COLLATE NOCASE AND id != ? AND eliminado = 0", [nombre, productoId]).length){
                return {status: 409, error: "Ya existe un producto con ese nombre"};
            }
            const eventos = consultar("SELECT id FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = '' ORDER BY id DESC LIMIT 1");
            const eventoEnCurso = !!eventos.length;
            if(eventoEnCurso && datos.stock !== undefined){
                return {status: 409, error: "No se puede modificar el stock mientras hay un evento en curso", stockBloqueado: true};
            }
            consultar("UPDATE productos SET nombre = ?, costo = ?, precio = ?, visible = ? WHERE id = ?", [nombre, Number(datos.costo), Number(datos.precio), Number(datos.visible), productoId]);
            if(datos.stock !== undefined){
                consultar("UPDATE productos SET stock = ? WHERE id = ?", [Number(datos.stock), productoId]);
            }
            const producto = consultar("SELECT * FROM productos WHERE id = ?", [productoId])[0];
            consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [new Date().toISOString(), req.session.data.email, "modificar_producto", `Se modificó el producto ${producto.nombre} (ID ${producto.id}); costo $${producto.costo}, precio $${producto.precio}, stock ${productos[0].stock} → ${producto.stock}, visible en ventas: ${productos[0].visible ? "sí" : "no"} → ${producto.visible ? "sí" : "no"}`]);
            return producto;
        });
        if(resultado.error) return res.status(resultado.status).json({error: resultado.error, stockBloqueado: resultado.stockBloqueado});
        res.status(200).json(resultado);
    }catch(err){
        console.log(err);
        logger.log("Error en productos: " + err.message, "error");
    }
}

async function eliminar(req, res){
    try{
        const productoId = Number(req.body?.productoId);
        if(!Number.isSafeInteger(productoId) || productoId <= 0) return res.status(400).json({error: "Producto no válido"});
        const producto = db.transaction(consultar => {
            const productos = consultar("SELECT id, nombre, stock FROM productos WHERE id = ? AND eliminado = 0", [productoId]);
            if(!productos.length) return null;
            consultar("UPDATE productos SET eliminado = 1 WHERE id = ?", [productoId]);
            consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [new Date().toISOString(), req.session.data.email, "eliminar_producto", `Se eliminó el producto ${productos[0].nombre} (ID ${productoId}); stock ${productos[0].stock}`]);
            return productos[0];
        });
        if(!producto) return res.status(404).json({error: "Producto no encontrado"});
        res.status(200).json({id: productoId});
    }catch(err){
        console.log(err);
        logger.log("Error en productos: " + err.message, "error");
    }
}

async function listado(req, res){
    try{
        const productos = await db.executeQuery("SELECT * FROM productos WHERE eliminado = 0 ORDER BY nombre, id");
        res.status(200).json(productos);
    }catch(err){
        console.log(err);
        logger.log("Error en productos: " + err.message, "error");
    }
}

module.exports = {getHTML, nuevo, modificar, eliminar, listado};
