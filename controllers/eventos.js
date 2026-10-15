const db = require("../utils/sqlite");
const logger = require("../utils/logger");
const fs = require("fs");
const path = require("path");
const info = require("../utils/info");
const {sumar} = require("../utils/validaciones");

async function getHTML(req, res){
    try{
        res.status(200).render("layouts/dashboard", {title: "Eventos", page: "../pages/eventos", script: "../../js/eventos.js", usuario: req.session.data});
    }catch(err){
        console.log(err);
        logger.log("Error en eventos: " + err.message, "error");
    }
}

async function listado(req, res){
    try{
        const eventos = await db.executeQuery("SELECT * FROM eventos ORDER BY id DESC");
        res.status(200).json(eventos);
    }catch(err){
        console.log(err);
        logger.log("Error en eventos: " + err.message, "error");
    }
}

async function resumen(req, res){
    try{
        const eventoId = typeof req.query.eventoId === "string" && /^\d+$/.test(req.query.eventoId) ? Number(req.query.eventoId) : NaN;
        if(!Number.isSafeInteger(eventoId) || eventoId <= 0) return res.status(400).json({error: "Evento no válido"});
        const cajaNumero = req.query.cajaNumero === undefined || req.query.cajaNumero === "" ? 0
            : typeof req.query.cajaNumero === "string" && /^[1-4]$/.test(req.query.cajaNumero) ? Number(req.query.cajaNumero) : NaN;
        if(![0, 1, 2, 3, 4].includes(cajaNumero)) return res.status(400).json({error: "Seleccione una caja válida"});
        const eventos = await db.executeQuery("SELECT id, fecha, nombre, fechaFin FROM eventos WHERE id = ?", [eventoId]);
        if(!eventos.length) return res.status(404).json({error: "Evento no encontrado"});
        if(!eventos[0].fechaFin) return res.status(409).json({error: "El resumen está disponible cuando el evento está finalizado"});
        const filtroCaja = cajaNumero ? " AND cajaNumero = ?" : "";
        const parametros = cajaNumero ? [eventoId, cajaNumero] : [eventoId];
        const ventas = await db.executeQuery(`SELECT productos, total, efectivo, transferencia FROM ventas WHERE eventoId = ?${filtroCaja}`, parametros);
        const mesas = await db.executeQuery(`SELECT productos, total, efectivo, transferencia FROM mesas WHERE eventoId = ?${filtroCaja}`, parametros);
        const cantidadVentas = ventas.length + mesas.reduce((cantidad, mesa) => cantidad + new Set(JSON.parse(mesa.productos || "[]").map(producto => producto.turno)).size, 0);
        let montoTotal = 0;
        let efectivo = 0;
        let transferencia = 0;
        const productosAgrupados = new Map();
        [...ventas, ...mesas].forEach(venta => {
            montoTotal += Math.round(Number(venta.total) || 0);
            efectivo += Math.round(Number(venta.efectivo) || 0);
            transferencia += Math.round(Number(venta.transferencia) || 0);
            JSON.parse(venta.productos || "[]").forEach(producto => {
                const nombre = String(producto.nombre || "");
                const cantidad = Math.round(Number(producto.cantidad) || 0);
                const costoAcumulado = Math.round(Number(producto.costo) || 0) * cantidad;
                const precioAcumulado = producto.subtotal !== undefined ? Math.round(Number(producto.subtotal) || 0) : Math.round(Number(producto.precio) || 0) * cantidad;
                const acumulado = productosAgrupados.get(nombre) || {nombre, cantidad: 0, costoAcumulado: 0, precioAcumulado: 0};
                acumulado.cantidad += cantidad;
                acumulado.costoAcumulado += costoAcumulado;
                acumulado.precioAcumulado += precioAcumulado;
                productosAgrupados.set(nombre, acumulado);
            });
        });
        const productos = Array.from(productosAgrupados.values()).map(producto => ({
            nombre: producto.nombre,
            cantidad: producto.cantidad,
            costoAcumulado: producto.costoAcumulado,
            precioAcumulado: producto.precioAcumulado,
            ganancia: producto.precioAcumulado - producto.costoAcumulado
        }));
        res.status(200).json({
            evento: eventos[0],
            cantidadVentas,
            montoTotal,
            montoTotalGanado: productos.reduce((total, producto) => total + producto.ganancia, 0),
            efectivo,
            transferencia,
            productos
        });
    }catch(err){
        console.log(err);
        logger.log("Error en resumen de eventos: " + err.message, "error");
    }
}

async function nuevo(req, res){
    try{
        const datos = req.body || {};
        const fecha = typeof datos.fecha === "string" ? datos.fecha.trim() : "";
        const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
        const mesas = typeof datos.mesas === "string" && /^\d+$/.test(datos.mesas) ? Number(datos.mesas) : datos.mesas;
        const fechaValidada = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T00:00:00.000Z`) : null;
        if(!fechaValidada || !Number.isFinite(fechaValidada.getTime()) || fechaValidada.toISOString().slice(0, 10) !== fecha){
            return res.status(400).json({error: "Ingrese una fecha válida"});
        }
        if(!nombre || nombre.length > 200) return res.status(400).json({error: "El nombre es obligatorio y debe tener hasta 200 caracteres"});
        if(!Number.isSafeInteger(mesas) || mesas < 0) return res.status(400).json({error: "La cantidad de mesas debe ser un entero igual o mayor que cero"});
        const activos = await db.executeQuery("SELECT id FROM eventos WHERE activo = 1 LIMIT 1");
        if(activos.length) return res.status(409).json({error: "Cierre el evento activo antes de agregar otro"});
        const carpeta = path.join(path.dirname(info.documentsPath), "respaldos");
        fs.mkdirSync(carpeta, {recursive: true});
        const nombreSimplificado = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_").toLowerCase() || "evento";
        await db.makeBackup(path.join(carpeta, `previo-${nombreSimplificado}-${Date.now()}.sqlite`));
        const resultado = db.transaction(consultar => {
            if(consultar("SELECT id FROM eventos WHERE activo = 1 LIMIT 1").length){
                return {status: 409, error: "Cierre el evento activo antes de agregar otro"};
            }
            const insercion = consultar("INSERT INTO eventos (fecha, nombre, mesas, fechaInicio, fechaFin, activo) VALUES (?, ?, ?, '', '', 0)", [fecha, nombre, mesas]);
            consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [new Date().toISOString(), req.session.data.email, "nuevo_evento", `Se creó el evento ${nombre} (ID ${insercion.insertId}) con ${mesas} mesas`]);
            return consultar("SELECT * FROM eventos WHERE id = ?", [insercion.insertId])[0];
        });
        if(resultado.error) return res.status(resultado.status).json({error: resultado.error});
        res.status(201).json(resultado);
    }catch(err){
        console.log(err);
        logger.log("Error en eventos: " + err.message, "error");
    }
}

function modificar(req, res){
    try{
        const datos = req.body || {};
        const eventoId = typeof datos.eventoId === "string" && /^\d+$/.test(datos.eventoId) ? Number(datos.eventoId) : datos.eventoId;
        const fecha = typeof datos.fecha === "string" ? datos.fecha.trim() : "";
        const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
        const mesas = typeof datos.mesas === "string" && /^\d+$/.test(datos.mesas) ? Number(datos.mesas) : datos.mesas;
        if(!Number.isSafeInteger(eventoId) || eventoId <= 0) return res.status(400).json({error: "Evento no válido"});
        const fechaValidada = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T00:00:00.000Z`) : null;
        if(!fechaValidada || !Number.isFinite(fechaValidada.getTime()) || fechaValidada.toISOString().slice(0, 10) !== fecha){
            return res.status(400).json({error: "Ingrese una fecha válida"});
        }
        if(!nombre || nombre.length > 200) return res.status(400).json({error: "El nombre es obligatorio y debe tener hasta 200 caracteres"});
        if(!Number.isSafeInteger(mesas) || mesas < 0) return res.status(400).json({error: "La cantidad de mesas debe ser un entero igual o mayor que cero"});
        const resultado = db.transaction(consultar => {
            const eventos = consultar("SELECT * FROM eventos WHERE id = ?", [eventoId]);
            if(!eventos.length) return {status: 404, error: "Evento no encontrado"};
            if(eventos[0].activo) return {status: 409, error: "No se puede modificar un evento activo"};
            consultar("UPDATE eventos SET fecha = ?, nombre = ?, mesas = ? WHERE id = ?", [fecha, nombre, mesas, eventoId]);
            consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [new Date().toISOString(), req.session.data.email, "modificar_evento", `Se modificó el evento ${nombre} (ID ${eventoId}) con fecha ${fecha} y ${mesas} mesas`]);
            return consultar("SELECT * FROM eventos WHERE id = ?", [eventoId])[0];
        });
        if(resultado.error) return res.status(resultado.status).json({error: resultado.error});
        res.status(200).json(resultado);
    }catch(err){
        console.log(err);
        logger.log("Error en eventos: " + err.message, "error");
    }
}

function activar(req, res){
    try{
        const eventoId = typeof req.body?.eventoId === "string" && /^\d+$/.test(req.body.eventoId) ? Number(req.body.eventoId) : req.body?.eventoId;
        if(!Number.isSafeInteger(eventoId) || eventoId <= 0) return res.status(400).json({error: "Evento no válido"});
        const ahora = new Date().toISOString();
        const resultado = db.transaction(consultar => {
            const eventos = consultar("SELECT * FROM eventos WHERE id = ?", [eventoId]);
            if(!eventos.length) return {status: 404, error: "Evento no encontrado"};
            if(eventos[0].fechaFin) return {status: 409, error: "No se puede activar un evento que ya fue cerrado"};
            const activos = consultar("SELECT id FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = ''");
            if(activos.some(evento => Number(evento.id) !== eventoId)) return {status: 409, error: "Cierre el evento activo antes de activar otro"};
            const iniciarEvento = Number(eventos[0].activo) !== 1 || !eventos[0].fechaInicio;
            consultar("UPDATE eventos SET activo = 1, fechaInicio = CASE WHEN fechaInicio = '' THEN ? ELSE fechaInicio END, fechaFin = '' WHERE id = ?", [ahora, eventoId]);
            if(iniciarEvento) consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [ahora, req.session.data.email, "iniciar_evento", `Se inició el evento ${eventos[0].nombre} (ID ${eventoId})`]);
            return consultar("SELECT * FROM eventos WHERE id = ?", [eventoId])[0];
        });
        if(resultado.error) return res.status(resultado.status).json({error: resultado.error});
        res.status(200).json(resultado);
    }catch(err){
        console.log(err);
        logger.log("Error en eventos: " + err.message, "error");
    }
}

async function cerrar(req, res){
    try{
        const eventoId = typeof req.body?.eventoId === "string" && /^\d+$/.test(req.body.eventoId) ? Number(req.body.eventoId) : req.body?.eventoId;
        if(!Number.isSafeInteger(eventoId) || eventoId <= 0) return res.status(400).json({error: "Evento no válido"});
        const resultado = db.transaction(consultar => {
            const eventos = consultar("SELECT * FROM eventos WHERE id = ?", [eventoId]);
            if(!eventos.length) return {status: 404, error: "Evento no encontrado"};
            if(!eventos[0].activo || !eventos[0].fechaInicio || eventos[0].fechaFin) return {status: 409, error: "El evento no está activo"};
            const mesasPendientes = consultar("SELECT COUNT(*) AS cantidad FROM mesas WHERE eventoId = ? AND cerrada = 0 AND total > 0", [eventoId])[0].cantidad;
            if(mesasPendientes){
                return {status: 409, error: `No se puede cerrar el evento: quedan ${mesasPendientes} ${mesasPendientes === 1 ? "mesa pendiente" : "mesas pendientes"} de cobro`};
            }
            const fechaFin = new Date().toISOString();
            const ventas = consultar("SELECT cajaNumero, efectivo, transferencia FROM ventas WHERE eventoId = ?", [eventoId]);
            const mesas = consultar("SELECT cajaNumero, efectivo, transferencia FROM mesas WHERE eventoId = ?", [eventoId]);
            for(const cajaNumero of [1, 2, 3, 4]){
                for(const [detalle, registros, medio] of [
                    ["Ventas directas efectivo", ventas, "efectivo"],
                    ["Ventas directas transferencia", ventas, "transferencia"],
                    ["Ventas mesas efectivo", mesas, "efectivo"],
                    ["Ventas mesas transferencia", mesas, "transferencia"]
                ]){
                    const pagos = registros.filter(registro => registro.cajaNumero === cajaNumero && registro[medio] > 0);
                    const importe = pagos.reduce((total, registro) => sumar(total, registro[medio]), 0);
                    const efectivo = medio === "efectivo" ? importe : 0;
                    const transferencia = medio === "transferencia" ? importe : 0;
                    const detalleMovimiento = `${detalle} (cantidad ${pagos.length})`;
                    const numeroGlobal = db.setContador("numeroGlobal", "incr", consultar);
                    const numeroEvento = db.setContador(`movimientosCaja_numeroEvento_${eventoId}`, "incr", consultar);
                    consultar(`
                        INSERT INTO movimientosCaja (eventoId, fecha, numeroGlobal, numeroEvento, usuarioEmail, tipo, detalle, efectivo, transferencia, cajaNumero)
                        VALUES (?, ?, ?, ?, ?, 'ingreso', ?, ?, ?, ?)
                    `, [eventoId, fechaFin, numeroGlobal, numeroEvento, req.session.data.email, detalleMovimiento, efectivo, transferencia, cajaNumero]);
                    consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [fechaFin, req.session.data.email, "movimiento_caja_ingreso", `Movimiento global ${numeroGlobal} del evento ${numeroEvento}, caja ${cajaNumero}: ${detalleMovimiento}; efectivo $${efectivo}, transferencia $${transferencia}`]);
                }
            }
            consultar("UPDATE eventos SET activo = 0, fechaFin = ? WHERE id = ?", [fechaFin, eventoId]);
            consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle) VALUES (?, ?, ?, ?)", [fechaFin, req.session.data.email, "cerrar_evento", `Se cerró el evento ${eventos[0].nombre} (ID ${eventoId})`]);
            return consultar("SELECT * FROM eventos WHERE id = ?", [eventoId])[0];
        });
        if(resultado.error) return res.status(resultado.status).json({error: resultado.error});
        const carpeta = path.join(path.dirname(info.documentsPath), "respaldos");
        fs.mkdirSync(carpeta, {recursive: true});
        const nombreSimplificado = resultado.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_").toLowerCase() || "evento";
        await db.makeBackup(path.join(carpeta, `finalizado-${nombreSimplificado}-${Date.now()}.sqlite`));
        res.status(200).json(resultado);
    }catch(err){
        console.log(err);
        logger.log("Error en eventos: " + err.message, "error");
    }
}

module.exports = {getHTML, listado, resumen, nuevo, modificar, activar, cerrar};
