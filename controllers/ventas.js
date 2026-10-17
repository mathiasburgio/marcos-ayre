const db = require("../utils/sqlite");
const logger = require("../utils/logger");
const {error, texto, identificador, entero, sumar, subtotal} = require("../utils/validaciones");

function ultimoEvento(consultar){
    const eventos = consultar("SELECT * FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = '' ORDER BY id DESC LIMIT 1");
    if(!eventos.length) throw error("Debe activar un evento antes de registrar ventas o mesas", 409);
    return eventos[0];
}

function obtenerMesa(consultar, mesaId, eventoId){
    const mesas = consultar("SELECT * FROM mesas WHERE id = ? AND eventoId = ?", [mesaId, eventoId]);
    if(!mesas.length) throw error("La mesa no existe en el evento activo", 404);
    return mesas[0];
}

function prepararProductos(productos){
    if(!Array.isArray(productos) || !productos.length || productos.length > 1000){
        throw error("Debe enviar entre 1 y 1000 productos");
    }
    return productos.map(producto => {
        if(!producto || typeof producto !== "object") throw error("Producto no válido");
        const nombre = texto(producto.nombre, "Nombre del producto");
        const precio = entero(producto.precio, "Precio");
        const costo = entero(producto.costo, "Costo");
        const cantidad = entero(producto.cantidad, "Cantidad");
        if(cantidad <= 0) throw error("La cantidad debe ser mayor que cero");
        return {nombre, precio, costo, cantidad, subtotal: subtotal(precio, cantidad)};
    });
}

function concretarVenta(req, res){
    const cajaNumero = req.session?.data?.cajaNumero;
    if(![1, 2, 3, 4].includes(cajaNumero) || Number(req.body?.cajaNumero) !== cajaNumero){
        return res.status(400).json({error: "Seleccione una caja antes de registrar ventas"});
    }
    try{
        const datos = req.body || {};
        const productos = prepararProductos(datos.productos);
        const total = sumar(...productos.map(producto => entero(producto.subtotal, "Subtotal")));
        const usuarioEmail = req.session?.data?.email;
        if(!usuarioEmail) throw error("Debe iniciar sesión", 403);
        const tieneMesa = datos.mesaId !== undefined && datos.mesaId !== null && datos.mesaId !== "" && datos.mesaId !== 0 && datos.mesaId !== "0";
        const mesaId = tieneMesa ? identificador(datos.mesaId, "Mesa") : 0;
        const efectivo = entero(datos.efectivo, "Efectivo", {opcional: true});
        const transferencia = entero(datos.transferencia, "Transferencia", {opcional: true});
        const pagado = sumar(efectivo, transferencia);
        if(tieneMesa && pagado !== 0) throw error("Las ventas de una mesa se cobran desde cobrarMesa");
        if(!tieneMesa && pagado !== total){
            throw error("El pago debe coincidir con el total de la venta");
        }

        const resultado = db.transaction(consultar => {
            const evento = ultimoEvento(consultar);
            const existencias = productos.map(producto => {
                const coincidencias = consultar("SELECT id FROM productos WHERE nombre = ? AND eliminado = 0 LIMIT 2", [producto.nombre]);
                if(coincidencias.length !== 1) throw error(`No se pudo identificar de forma única el producto ${producto.nombre}`, 409);
                return {id: coincidencias[0].id, cantidad: producto.cantidad};
            });

            let mesa = null;
            let venta = null;
            if(tieneMesa){
                const mesas = consultar("SELECT * FROM mesas WHERE id = ?", [mesaId]);
                if(mesas.length && mesas[0].eventoId !== evento.id) throw error("La mesa pertenece a un evento anterior", 409);
                if(!mesas.length){
                    consultar("INSERT INTO mesas (id, eventoId, numero, nombre) VALUES (?, ?, ?, ?)", [mesaId, evento.id, String(mesaId), `Mesa ${mesaId}`]);
                }
                mesa = obtenerMesa(consultar, mesaId, evento.id);
                if(mesa.cerrada) return {status: 409, error: "La mesa ya está cerrada. Seleccione la mesa disponible nuevamente"};
                const productosMesa = JSON.parse(mesa.productos || "[]");
                const turno = productosMesa.reduce((maximo, producto) => Math.max(maximo, producto.turno), 0) + 1;
                if(!Number.isSafeInteger(turno)) throw error("No se pudo asignar el turno del pedido", 500);
                const timestamp = Date.now();
                productosMesa.push(...productos.map(producto => ({...producto, timestamp, turno})));
                const totalMesa = sumar(Math.round(Number(mesa.total) || 0), total);
                consultar("UPDATE mesas SET total = ?, productos = ? WHERE id = ?", [totalMesa, JSON.stringify(productosMesa), mesaId]);
                mesa = obtenerMesa(consultar, mesaId, evento.id);
            }else{
                const numeroGlobal = db.setContador("numeroGlobal", "incr", consultar);
                if(!Number.isSafeInteger(numeroGlobal)) throw error("No se pudo asignar el número global de la venta", 500);
                const numeroEvento = db.setContador(`ventas_numeroEvento_${evento.id}`, "incr", consultar);
                if(!Number.isSafeInteger(numeroEvento)) throw error("No se pudo asignar el número de la venta en el evento", 500);
                const fecha = new Date().toISOString();
                const insercion = consultar(`
                    INSERT INTO ventas (eventoId, fecha, numeroGlobal, numeroEvento, productos, total, usuarioEmail, efectivo, transferencia, cajaNumero)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [evento.id, fecha, numeroGlobal, numeroEvento, JSON.stringify(productos), total, usuarioEmail, efectivo, transferencia, cajaNumero]);
                venta = consultar("SELECT * FROM ventas WHERE id = ?", [insercion.insertId])[0];
                venta.productos = productos;
            }
            for(const producto of existencias){
                // El stock puede quedar negativo; se registra igualmente la venta.
                consultar("UPDATE productos SET stock = ROUND(COALESCE(stock, 0) - ?, 0) WHERE id = ?", [producto.cantidad, producto.id]);
            }
            return {success: true, venta, mesa};
        });
        if(resultado.error) return res.status(resultado.status).json({error: resultado.error});
        res.status(201).json(resultado);
    }catch(err){
        console.log(err);
        logger.log("Error en ventas: " + err.message, "error");
    }
}

function cobrarMesa(req, res){
    const cajaNumero = req.session?.data?.cajaNumero;
    if(![1, 2, 3, 4].includes(cajaNumero) || Number(req.body?.cajaNumero) !== cajaNumero){
        return res.status(400).json({error: "Seleccione una caja antes de cobrar mesas"});
    }
    try{
        const datos = req.body || {};
        const mesaId = identificador(datos.mesaId, "Mesa");
        const efectivo = entero(datos.efectivo, "Efectivo", {opcional: true});
        const transferencia = entero(datos.transferencia, "Transferencia", {opcional: true});
        if(sumar(efectivo, transferencia) <= 0) throw error("Debe indicar un importe a cobrar mayor que cero");
        const resultado = db.transaction(consultar => {
            const evento = ultimoEvento(consultar);
            const mesa = obtenerMesa(consultar, mesaId, evento.id);
            if(mesa.cerrada) return {status: 409, error: "La mesa ya está cerrada"};
            const nuevoEfectivo = sumar(Math.round(Number(mesa.efectivo) || 0), efectivo);
            const nuevaTransferencia = sumar(Math.round(Number(mesa.transferencia) || 0), transferencia);
            const total = Math.round(Number(mesa.total) || 0);
            const saldo = total - sumar(nuevoEfectivo, nuevaTransferencia);
            if(saldo < 0) return {status: 400, error: "El cobro supera el saldo de la mesa"};
            if(saldo > 0) return {status: 400, error: "Complete el saldo de la mesa antes de confirmar"};
            consultar("UPDATE mesas SET efectivo = ?, transferencia = ?, cerrada = 1, cajaNumero = ? WHERE id = ?", [nuevoEfectivo, nuevaTransferencia, cajaNumero, mesaId]);
            consultar("INSERT INTO mesas (eventoId, numero, nombre) VALUES (?, ?, ?)", [evento.id, mesa.numero, `Mesa ${mesa.numero}`]);
            return {success: true, mesa: obtenerMesa(consultar, mesaId, evento.id), saldo};
        });
        if(resultado.error) return res.status(resultado.status).json({error: resultado.error});
        res.status(200).json(resultado);
    }catch(err){
        console.log(err);
        logger.log("Error en ventas: " + err.message, "error");
    }
}

function datosMesa(datos){
    return {
        nombre: texto(datos.nombre, "Nombre de la mesa"),
        numero: texto(typeof datos.numero === "number" ? String(datos.numero) : datos.numero, "Número de la mesa", {max: 50}),
        telefono: texto(datos.telefono, "Teléfono", {opcional: true, max: 50})
    };
}

function crearMesa(req, res){
    try{
        const datos = datosMesa(req.body || {});
        const mesa = db.transaction(consultar => {
            const evento = ultimoEvento(consultar);
            if(consultar("SELECT id FROM mesas WHERE eventoId = ? AND numero = ? AND cerrada = 0", [evento.id, datos.numero]).length){
                throw error("Ya existe una mesa con ese número en el evento activo", 409);
            }
            const resultado = consultar("INSERT INTO mesas (eventoId, nombre, numero, telefono) VALUES (?, ?, ?, ?)", [evento.id, datos.nombre, datos.numero, datos.telefono]);
            return obtenerMesa(consultar, resultado.insertId, evento.id);
        });
        res.status(201).json({success: true, mesa});
    }catch(err){
        console.log(err);
        logger.log("Error en ventas: " + err.message, "error");
    }
}

function editarMesa(req, res){
    try{
        const mesaId = identificador(req.body?.mesaId, "Mesa");
        const mesa = db.transaction(consultar => {
            const evento = ultimoEvento(consultar);
            const mesaAnterior = obtenerMesa(consultar, mesaId, evento.id);
            if(mesaAnterior.cerrada) return {status: 409, error: "No se puede modificar una mesa cerrada"};
            const datos = datosMesa({...mesaAnterior, ...req.body});
            if(consultar("SELECT id FROM mesas WHERE eventoId = ? AND numero = ? AND id != ? AND cerrada = 0", [evento.id, datos.numero, mesaId]).length){
                throw error("Ya existe una mesa con ese número en el evento activo", 409);
            }
            consultar("UPDATE mesas SET nombre = ?, numero = ?, telefono = ? WHERE id = ?", [datos.nombre, datos.numero, datos.telefono, mesaId]);
            const mesaActual = obtenerMesa(consultar, mesaId, evento.id);
            consultar("INSERT INTO bitacora (fecha, usuarioEmail, clave, detalle, eventoId) VALUES (?, ?, ?, ?, COALESCE((SELECT id FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = '' ORDER BY id DESC LIMIT 1), 0))", [new Date().toISOString(), req.session.data.email, "modificar_mesa", `Se modificó la mesa ${mesaActual.numero} (ID ${mesaId}); nombre anterior: ${mesaAnterior.nombre}, teléfono anterior: ${mesaAnterior.telefono}; nombre nuevo: ${mesaActual.nombre}, teléfono nuevo: ${mesaActual.telefono}`]);
            return mesaActual;
        });
        if(mesa.error) return res.status(mesa.status).json({error: mesa.error});
        res.status(200).json({success: true, mesa});
    }catch(err){
        console.log(err);
        logger.log("Error en ventas: " + err.message, "error");
    }
}

async function listadoMesas(req, res){
    try{
        const mesas = db.transaction(consultar => {
            const eventos = consultar("SELECT id, mesas FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = '' ORDER BY id DESC LIMIT 1");
            if(!eventos.length) return [];
            const evento = eventos[0];
            for(let numero = 1; numero <= Number(evento.mesas); numero++){
                consultar("INSERT INTO mesas (eventoId, numero, nombre, telefono) SELECT ?, ?, ?, '' WHERE NOT EXISTS (SELECT id FROM mesas WHERE eventoId = ? AND numero = ? AND cerrada = 0)", [evento.id, String(numero), `Mesa ${numero}`, evento.id, String(numero)]);
            }
            return consultar("SELECT * FROM mesas WHERE eventoId = ? AND cerrada = 0 ORDER BY CAST(numero AS INTEGER), id", [evento.id]);
        });
        res.status(200).json(mesas);
    }catch(err){
        console.log(err);
        logger.log("Error en ventas: " + err.message, "error");
    }
}

async function buscar(req, res){
    try{
        const condiciones = ["eventoId = (SELECT id FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = '' ORDER BY id DESC LIMIT 1)"];
        const parametros = [];
        if(req.body?.id !== undefined && req.body.id !== ""){
            condiciones.push("id = ?");
            parametros.push(identificador(req.body.id));
        }
        const ventas = await db.executeQuery(`SELECT * FROM ventas WHERE ${condiciones.join(" AND ")} ORDER BY id DESC LIMIT 100`, parametros);
        res.status(200).json(ventas.map(venta => ({...venta, productos: JSON.parse(venta.productos)})));
    }catch(err){
        console.log(err);
        logger.log("Error en ventas: " + err.message, "error");
    }
    if(!res.headersSent) res.status(500).json({error: "No se pudieron buscar las ventas"});
}

async function getHTML(req, res){
    try{
        const eventos = await db.executeQuery("SELECT * FROM eventos WHERE activo = 1 AND fechaInicio != '' AND fechaFin = '' ORDER BY id DESC LIMIT 1");
        res.status(200).render("layouts/dashboard", {
            title: "Ventas",
            page: "../pages/ventas",
            script: "../../js/ventas.js",
            usuario: req.session.data,
            evento: eventos[0] || null
        });
    }catch(err){
        console.log(err);
        logger.log("Error al abrir ventas: " + err.message, "error");
    }
}

module.exports = {concretarVenta, cobrarMesa, crearMesa, editarMesa, listadoMesas, buscar, getHTML};
