const db = require("../utils/sqlite");
const logger = require("../utils/logger");
const {entero} = require("../utils/validaciones");

async function getHTML(req, res){
    try{
        const eventos = await db.executeQuery("SELECT id, nombre, fecha, fechaInicio, fechaFin, activo FROM eventos ORDER BY activo DESC, id DESC");
        const eventoEnCurso = eventos.some(evento => Number(evento.activo) === 1 && !!evento.fechaInicio && !evento.fechaFin);
        res.status(200).render("layouts/dashboard", {title: "Movimientos de caja", page: "../pages/movimientosCaja", script: "../../js/movimientosCaja.js", usuario: req.session.data, eventos, eventoEnCurso});
    }catch(err){
        console.log(err);
        logger.log("Error en movimientos de caja: " + err.message, "error");
    }
}

function nuevo(req, res){
    try{
        const datos = req.body || {};
        const cajaNumero = typeof datos.cajaNumero === "string" && /^[1-4]$/.test(datos.cajaNumero) ? Number(datos.cajaNumero) : datos.cajaNumero;
        if(![1, 2, 3, 4].includes(cajaNumero)) return res.status(400).json({error: "Seleccione una caja del 1 al 4"});
        if(datos.tipo !== "ingreso" && datos.tipo !== "egreso") return res.status(400).json({error: "El tipo debe ser ingreso o egreso"});
        const detalle = typeof datos.detalle === "string" ? datos.detalle.trim() : "";
        if(!detalle || detalle.length > 500) return res.status(400).json({error: "El detalle es obligatorio y debe tener hasta 500 caracteres"});
        for(const campo of ["efectivo", "transferencia"]){
            try{
                entero(datos[campo], campo === "efectivo" ? "Efectivo" : "Transferencia");
            }catch(err){
                return res.status(400).json({error: err.message});
            }
        }
        const efectivo = Number(datos.efectivo);
        const transferencia = Number(datos.transferencia);
        if(!Number.isSafeInteger(efectivo + transferencia) || efectivo + transferencia <= 0){
            return res.status(400).json({error: "El importe total debe ser mayor que cero y estar dentro del rango permitido"});
        }
        const resultado = db.transaction(consultar => {
            const eventos = consultar("SELECT id, fechaInicio, fechaFin FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = '' ORDER BY id DESC LIMIT 1");
            const evento = eventos[0];
            if(!evento?.fechaInicio || evento.fechaFin){
                return {error: "Solo se pueden registrar ingresos o egresos cuando hay un evento en curso"};
            }
            const numeroGlobal = db.setContador("numeroGlobal", "incr", consultar);
            if(!Number.isSafeInteger(numeroGlobal)) throw new Error("No se pudo asignar el número global del movimiento de caja");
            const numeroEvento = db.setContador(`movimientosCaja_numeroEvento_${evento.id}`, "incr", consultar);
            const fecha = new Date().toISOString();
            const insercion = consultar(`
                INSERT INTO movimientosCaja (eventoId, fecha, numeroGlobal, numeroEvento, usuarioEmail, tipo, detalle, efectivo, transferencia, cajaNumero)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [evento.id, fecha, numeroGlobal, numeroEvento, req.session.data.email,
                datos.tipo, detalle, efectivo, transferencia, cajaNumero]);
            const movimiento = consultar("SELECT * FROM movimientosCaja WHERE id = ?", [insercion.insertId])[0];
            consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle, eventoId) VALUES (?, ?, ?, ?, COALESCE((SELECT id FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = '' ORDER BY id DESC LIMIT 1), 0))", [fecha, req.session.data.email, `movimiento_caja_${datos.tipo}`, `Movimiento global ${numeroGlobal} del evento ${numeroEvento}, caja ${cajaNumero}: ${detalle}; efectivo $${efectivo}, transferencia $${transferencia}`]);
            return movimiento;
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
        const cajaNumero = req.query.cajaNumero === undefined || req.query.cajaNumero === "" ? 0
            : typeof req.query.cajaNumero === "string" && /^[1-4]$/.test(req.query.cajaNumero) ? Number(req.query.cajaNumero) : NaN;
        if(![0, 1, 2, 3, 4].includes(cajaNumero)) return res.status(400).json({error: "Seleccione una caja válida"});
        let evento = req.query.eventoId;
        if(evento === undefined || evento === ""){
            const eventos = await db.executeQuery("SELECT id FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = '' ORDER BY id DESC LIMIT 1");
            if(!eventos.length) return res.status(200).json([]);
            evento = eventos[0].id;
        }
        if((typeof evento !== "string" && typeof evento !== "number") || !/^\d+$/.test(String(evento)) || !Number.isSafeInteger(Number(evento)) || Number(evento) <= 0){
            return res.status(400).json({error: "Seleccione un evento válido"});
        }
        const filtroCaja = cajaNumero ? " AND cajaNumero = ?" : "";
        const parametros = cajaNumero ? [Number(evento), cajaNumero] : [Number(evento)];
        const movimientos = await db.executeQuery(`SELECT * FROM movimientosCaja WHERE eventoId = ?${filtroCaja} ORDER BY id DESC`, parametros);
        res.status(200).json(movimientos);
    }catch(err){
        console.log(err);
        logger.log("Error en movimientos de caja: " + err.message, "error");
    }
}

module.exports = {getHTML, nuevo, listado};
