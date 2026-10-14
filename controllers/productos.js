const db = require("../utils/sqlite");
const logger = require("../utils/logger");

async function getHTML(req, res){
    try{
        const eventos = await db.executeQuery("SELECT fechaInicio, fechaFin FROM eventos ORDER BY id DESC LIMIT 1");
        const eventoEnCurso = !!eventos[0]?.fechaInicio && !eventos[0]?.fechaFin;
        res.status(200).render("layouts/dashboard", {title: "Productos", page: "../pages/productos", script: "../../js/productos.js", eventoEnCurso});
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
        for(const campo of ["costo", "precio", "stock"]){
            if(campo === "stock" && datos.stock === undefined) continue;
            const valor = datos[campo];
            const formato = campo === "stock" ? /^-?\d+(?:\.\d{1,2})?$/ : /^\d+(?:\.\d{1,2})?$/;
            if((typeof valor !== "string" && typeof valor !== "number") || !formato.test(String(valor)) || !Number.isSafeInteger(Math.round(Number(valor) * 100))){
                return res.status(400).json({error: `${campo === "costo" ? "Costo" : campo === "precio" ? "Precio" : "Stock"} debe ser un número con hasta dos decimales${campo === "stock" ? "" : " y no negativo"}`});
            }
        }
        const resultado = db.transaction(consultar => {
            if(consultar("SELECT id FROM productos WHERE nombre = ? COLLATE NOCASE AND eliminado = 0", [nombre]).length){
                return {status: 409, error: "Ya existe un producto con ese nombre"};
            }
            const eventos = consultar("SELECT fechaInicio, fechaFin FROM eventos ORDER BY id DESC LIMIT 1");
            const eventoEnCurso = !!eventos[0]?.fechaInicio && !eventos[0]?.fechaFin;
            if(eventoEnCurso && Number(datos.stock || 0) !== 0){
                return {status: 409, error: "No se puede modificar el stock mientras hay un evento en curso", stockBloqueado: true};
            }
            const insercion = consultar("INSERT INTO productos (nombre, costo, precio, stock) VALUES (?, ?, ?, ?)", [nombre, Number(datos.costo), Number(datos.precio), eventoEnCurso ? 0 : Number(datos.stock || 0)]);
            return consultar("SELECT * FROM productos WHERE id = ?", [insercion.insertId])[0];
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
        for(const campo of ["costo", "precio", "stock"]){
            if(campo === "stock" && datos.stock === undefined) continue;
            const valor = datos[campo];
            const formato = campo === "stock" ? /^-?\d+(?:\.\d{1,2})?$/ : /^\d+(?:\.\d{1,2})?$/;
            if((typeof valor !== "string" && typeof valor !== "number") || !formato.test(String(valor)) || !Number.isSafeInteger(Math.round(Number(valor) * 100))){
                return res.status(400).json({error: `${campo === "costo" ? "Costo" : campo === "precio" ? "Precio" : "Stock"} debe ser un número con hasta dos decimales${campo === "stock" ? "" : " y no negativo"}`});
            }
        }
        const resultado = db.transaction(consultar => {
            const productos = consultar("SELECT * FROM productos WHERE id = ? AND eliminado = 0", [productoId]);
            if(!productos.length) return {status: 404, error: "Producto no encontrado"};
            if(consultar("SELECT id FROM productos WHERE nombre = ? COLLATE NOCASE AND id != ? AND eliminado = 0", [nombre, productoId]).length){
                return {status: 409, error: "Ya existe un producto con ese nombre"};
            }
            const eventos = consultar("SELECT fechaInicio, fechaFin FROM eventos ORDER BY id DESC LIMIT 1");
            const eventoEnCurso = !!eventos[0]?.fechaInicio && !eventos[0]?.fechaFin;
            if(eventoEnCurso && datos.stock !== undefined){
                return {status: 409, error: "No se puede modificar el stock mientras hay un evento en curso", stockBloqueado: true};
            }
            consultar("UPDATE productos SET nombre = ?, costo = ?, precio = ? WHERE id = ?", [nombre, Number(datos.costo), Number(datos.precio), productoId]);
            if(datos.stock !== undefined){
                consultar("UPDATE productos SET stock = ? WHERE id = ?", [Number(datos.stock), productoId]);
            }
            return consultar("SELECT * FROM productos WHERE id = ?", [productoId])[0];
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
        const resultado = await db.executeQuery("UPDATE productos SET eliminado = 1 WHERE id = ? AND eliminado = 0", [productoId]);
        if(!resultado.affectedRows) return res.status(404).json({error: "Producto no encontrado"});
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
