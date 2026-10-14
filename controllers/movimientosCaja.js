const db = require("../utils/sqlite");
const logger = require("../utils/logger");

async function getHTML(req, res){
    try{
        const eventos = await db.executeQuery("SELECT id, nombre, fechaInicio, fechaFin FROM eventos ORDER BY id DESC");
        const eventoEnCurso = !!eventos[0]?.fechaInicio && !eventos[0]?.fechaFin;
        res.status(200).render("layouts/dashboard", {title: "Movimientos de caja", page: "../pages/movimientosCaja", script: "../../js/movimientosCaja.js", eventos, eventoEnCurso});
    }catch(err){
        console.log(err);
        logger.log("Error en movimientos de caja: " + err.message, "error");
    }
}

function nuevo(req, res){
    try{
        const datos = req.body || {};
        if(datos.tipo !== "ingreso" && datos.tipo !== "egreso") return res.status(400).json({error: "El tipo debe ser ingreso o egreso"});
        const detalle = typeof datos.detalle === "string" ? datos.detalle.trim() : "";
        if(!detalle || detalle.length > 500) return res.status(400).json({error: "El detalle es obligatorio y debe tener hasta 500 caracteres"});
        for(const campo of ["efectivo", "transferencia"]){
            const valor = datos[campo];
            if((typeof valor !== "string" && typeof valor !== "number") || !/^\d+(?:\.\d{1,2})?$/.test(String(valor)) || !Number.isSafeInteger(Math.round(Number(valor) * 100))){
                return res.status(400).json({error: "Los importes deben ser números no negativos con hasta dos decimales"});
            }
        }
        const efectivo = Math.round(Number(datos.efectivo) * 100);
        const transferencia = Math.round(Number(datos.transferencia) * 100);
        if(!Number.isSafeInteger(efectivo + transferencia) || efectivo + transferencia <= 0){
            return res.status(400).json({error: "El importe total debe ser mayor que cero y estar dentro del rango permitido"});
        }
        const resultado = db.transaction(consultar => {
            const eventos = consultar("SELECT id, fechaInicio, fechaFin FROM eventos ORDER BY id DESC LIMIT 1");
            const evento = eventos[0];
            if(!evento?.fechaInicio || evento.fechaFin){
                return {error: "Solo se pueden registrar ingresos o egresos cuando hay un evento en curso"};
            }
            const numeros = consultar(`
                SELECT COALESCE(MAX(CAST(numeroGlobal AS INTEGER)), 0) + 1 AS global,
                    COALESCE(MAX(CASE WHEN eventoId = ? THEN CAST(numeroEvento AS INTEGER) END), 0) + 1 AS evento
                FROM movimientosCaja
            `, [evento.id])[0];
            const insercion = consultar(`
                INSERT INTO movimientosCaja (eventoId, fecha, numeroGlobal, numeroEvento, usuarioEmail, tipo, detalle, efectivo, transferencia)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [evento.id, new Date().toISOString(), String(numeros.global), String(numeros.evento), req.session.data.email,
                datos.tipo, detalle, efectivo / 100, transferencia / 100]);
            return consultar("SELECT * FROM movimientosCaja WHERE id = ?", [insercion.insertId])[0];
        });
        if(resultado.error) return res.status(409).json({error: resultado.error, eventoEnCurso: false});
        res.status(201).json(resultado);
    }catch(err){
        console.log(err);
        logger.log("Error en movimientos de caja: " + err.message, "error");
    }
}

async function listado(req, res){
    try{
        const {busqueda = "evento", eventoId, fechaDesde} = req.query;
        //busqueda = evento | fecha
        //si es por fecha devuelve maximo 1000 registros
        if(busqueda === "evento"){
            let evento = eventoId;
            if(evento === undefined || evento === ""){
                const eventos = await db.executeQuery("SELECT id FROM eventos ORDER BY id DESC LIMIT 1");
                if(!eventos.length) return res.status(200).json([]);
                evento = eventos[0].id;
            }
            if((typeof evento !== "string" && typeof evento !== "number") || !/^\d+$/.test(String(evento)) || !Number.isSafeInteger(Number(evento)) || Number(evento) <= 0){
                return res.status(400).json({error: "Seleccione un evento válido"});
            }
            const movimientos = await db.executeQuery("SELECT * FROM movimientosCaja WHERE eventoId = ? ORDER BY id DESC", [Number(evento)]);
            return res.status(200).json(movimientos);
        }
        if(busqueda === "fecha"){
            if(typeof fechaDesde !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)){
                return res.status(400).json({error: "Seleccione una fecha válida"});
            }
            const fecha = new Date(fechaDesde + "T00:00:00.000Z");
            if(Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== fechaDesde){
                return res.status(400).json({error: "Seleccione una fecha válida"});
            }
            const desde = new Date(fechaDesde + "T00:00:00").toISOString();
            const movimientos = await db.executeQuery("SELECT * FROM movimientosCaja WHERE fecha >= ? ORDER BY id DESC LIMIT 1000", [desde]);
            return res.status(200).json(movimientos);
        }
        return res.status(400).json({error: "La búsqueda debe ser por evento o por fecha"});
    }catch(err){
        console.log(err);
        logger.log("Error en movimientos de caja: " + err.message, "error");
    }
}

module.exports = {getHTML, nuevo, listado};
