const db = require("../utils/sqlite");
const logger = require("../utils/logger");
const {error, texto, identificador, centavos, sumar, subtotal} = require("../utils/validaciones");

function ultimoEvento(consultar){
    const eventos = consultar("SELECT * FROM eventos ORDER BY id DESC LIMIT 1");
    if(!eventos.length) throw error("Debe crear un evento antes de registrar ventas o mesas", 409);
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
        const precio = centavos(producto.precio, "Precio");
        const costo = centavos(producto.costo, "Costo");
        const cantidad = centavos(producto.cantidad, "Cantidad");
        if(cantidad <= 0) throw error("La cantidad debe ser mayor que cero");
        return {nombre, precio: precio / 100, costo: costo / 100, cantidad: cantidad / 100, subtotal: subtotal(precio, cantidad) / 100};
    });
}

function concretarVenta(req, res){
    try{
        const datos = req.body || {};
        const productos = prepararProductos(datos.productos);
        const total = sumar(...productos.map(producto => centavos(producto.subtotal, "Subtotal")));
        const usuarioEmail = req.session?.data?.email;
        if(!usuarioEmail) throw error("Debe iniciar sesión", 403);
        const tieneMesa = datos.mesaId !== undefined && datos.mesaId !== null && datos.mesaId !== "" && datos.mesaId !== 0 && datos.mesaId !== "0";
        const mesaId = tieneMesa ? identificador(datos.mesaId, "Mesa") : 0;
        const efectivo = centavos(datos.efectivo, "Efectivo", {opcional: true});
        const transferencia = centavos(datos.transferencia, "Transferencia", {opcional: true});
        const pagado = sumar(efectivo, transferencia);
        if(tieneMesa && pagado !== 0) throw error("Las ventas de una mesa se cobran desde cobrarMesa");
        if(!tieneMesa && (pagado > total || total - pagado >= 100)){
            throw error("El pago debe cubrir el total, con una diferencia menor a $1, y no superar el importe de la venta");
        }

        const resultado = db.transaction(consultar => {
            const evento = ultimoEvento(consultar);
            const existencias = productos.map(producto => {
                const coincidencias = consultar("SELECT id FROM productos WHERE nombre = ? AND eliminado = 0 LIMIT 2", [producto.nombre]);
                if(coincidencias.length !== 1) throw error(`No se pudo identificar de forma única el producto ${producto.nombre}`, 409);
                return {id: coincidencias[0].id, cantidad: producto.cantidad};
            });

            let mesa = null;
            let cobrado = 1;
            if(tieneMesa){
                const mesas = consultar("SELECT * FROM mesas WHERE id = ?", [mesaId]);
                if(mesas.length && mesas[0].eventoId !== evento.id) throw error("La mesa pertenece a un evento anterior", 409);
                if(!mesas.length){
                    consultar("INSERT INTO mesas (id, eventoId, numero, nombre) VALUES (?, ?, ?, ?)", [mesaId, evento.id, String(mesaId), `Mesa ${mesaId}`]);
                }
                mesa = obtenerMesa(consultar, mesaId, evento.id);
                const totalMesa = sumar(centavos(mesa.total, "Total de la mesa"), total);
                const pagoMesa = sumar(centavos(mesa.efectivo, "Efectivo de la mesa"), centavos(mesa.transferencia, "Transferencia de la mesa"));
                cobrado = totalMesa - pagoMesa < 100 ? 1 : 0;
                consultar("UPDATE mesas SET total = ?, cobrado = ? WHERE id = ?", [totalMesa / 100, cobrado, mesaId]);
                mesa = obtenerMesa(consultar, mesaId, evento.id);
            }

            const numeros = consultar(`
                SELECT COALESCE(MAX(CAST(numeroGlobal AS INTEGER)), 0) + 1 AS global,
                    COALESCE(MAX(CASE WHEN eventoId = ? THEN CAST(numeroEvento AS INTEGER) END), 0) + 1 AS evento
                FROM ventas
            `, [evento.id])[0];
            const fecha = new Date().toISOString();
            const insercion = consultar(`
                INSERT INTO ventas (eventoId, fecha, numeroGlobal, numeroEvento, productos, total, usuarioEmail, efectivo, transferencia, mesaId, cobrado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [evento.id, fecha, String(numeros.global), String(numeros.evento), JSON.stringify(productos), total / 100, usuarioEmail,
                tieneMesa ? 0 : efectivo / 100, tieneMesa ? 0 : transferencia / 100, mesaId, cobrado]);
            for(const producto of existencias){
                // El stock puede quedar negativo; se registra igualmente la venta.
                consultar("UPDATE productos SET stock = ROUND(stock - ?, 2) WHERE id = ?", [producto.cantidad, producto.id]);
            }
            const venta = consultar("SELECT * FROM ventas WHERE id = ?", [insercion.insertId])[0];
            venta.productos = productos;
            return {success: true, venta, mesa};
        });
        res.status(201).json(resultado);
    }catch(err){
        console.log(err);
        logger.log("Error en ventas: " + err.message, "error");
    }
}

function cobrarMesa(req, res){
    try{
        const datos = req.body || {};
        const mesaId = identificador(datos.mesaId, "Mesa");
        const efectivo = centavos(datos.efectivo, "Efectivo", {opcional: true});
        const transferencia = centavos(datos.transferencia, "Transferencia", {opcional: true});
        if(sumar(efectivo, transferencia) <= 0) throw error("Debe indicar un importe a cobrar mayor que cero");
        const resultado = db.transaction(consultar => {
            const evento = ultimoEvento(consultar);
            const mesa = obtenerMesa(consultar, mesaId, evento.id);
            if(mesa.cobrado) throw error("La mesa ya está cobrada", 409);
            const nuevoEfectivo = sumar(centavos(mesa.efectivo, "Efectivo de la mesa"), efectivo);
            const nuevaTransferencia = sumar(centavos(mesa.transferencia, "Transferencia de la mesa"), transferencia);
            const total = centavos(mesa.total, "Total de la mesa");
            const saldo = total - sumar(nuevoEfectivo, nuevaTransferencia);
            if(saldo < 0) throw error("El cobro supera el saldo de la mesa");
            const cobrado = saldo < 100 ? 1 : 0;
            consultar("UPDATE mesas SET efectivo = ?, transferencia = ?, cobrado = ? WHERE id = ?", [nuevoEfectivo / 100, nuevaTransferencia / 100, cobrado, mesaId]);
            if(cobrado) consultar("UPDATE ventas SET cobrado = 1 WHERE mesaId = ? AND eventoId = ?", [mesaId, evento.id]);
            return {success: true, mesa: obtenerMesa(consultar, mesaId, evento.id), saldo: saldo / 100};
        });
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
            if(consultar("SELECT id FROM mesas WHERE eventoId = ? AND numero = ?", [evento.id, datos.numero]).length){
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
        const datos = datosMesa(req.body || {});
        const mesa = db.transaction(consultar => {
            const evento = ultimoEvento(consultar);
            obtenerMesa(consultar, mesaId, evento.id);
            if(consultar("SELECT id FROM mesas WHERE eventoId = ? AND numero = ? AND id != ?", [evento.id, datos.numero, mesaId]).length){
                throw error("Ya existe una mesa con ese número en el evento activo", 409);
            }
            consultar("UPDATE mesas SET nombre = ?, numero = ?, telefono = ? WHERE id = ?", [datos.nombre, datos.numero, datos.telefono, mesaId]);
            return obtenerMesa(consultar, mesaId, evento.id);
        });
        res.status(200).json({success: true, mesa});
    }catch(err){
        console.log(err);
        logger.log("Error en ventas: " + err.message, "error");
    }
}

async function listadoMesas(req, res){
    try{
        const mesas = await db.executeQuery("SELECT * FROM mesas WHERE eventoId = (SELECT MAX(id) FROM eventos) ORDER BY numero, id");
        res.status(200).json(mesas);
    }catch(err){
        console.log(err);
        logger.log("Error en ventas: " + err.message, "error");
    }
}

async function buscar(req, res){
    try{
        const condiciones = ["eventoId = (SELECT MAX(id) FROM eventos)"];
        const parametros = [];
        for(const campo of ["mesaId", "id"]){
            if(req.body?.[campo] !== undefined && req.body[campo] !== ""){
                condiciones.push(`${campo} = ?`);
                parametros.push(identificador(req.body[campo], campo));
            }
        }
        const ventas = await db.executeQuery(`SELECT * FROM ventas WHERE ${condiciones.join(" AND ")} ORDER BY id DESC LIMIT 500`, parametros);
        res.status(200).json(ventas.map(venta => ({...venta, productos: JSON.parse(venta.productos)})));
    }catch(err){
        console.log(err);
        logger.log("Error en ventas: " + err.message, "error");
    }
}

async function getHTML(req, res){
    try{
        const eventos = await db.executeQuery("SELECT * FROM eventos ORDER BY id DESC LIMIT 1");
        const ventas = await db.executeQuery("SELECT * FROM ventas WHERE eventoId = (SELECT MAX(id) FROM eventos) ORDER BY id DESC LIMIT 100");
        const mesas = await db.executeQuery("SELECT * FROM mesas WHERE eventoId = (SELECT MAX(id) FROM eventos) ORDER BY numero, id");
        res.status(200).render("pages/ventas", {title: "Ventas", usuario: req.session.data, evento: eventos[0] || null, ventas, mesas});
    }catch(err){
        console.log(err);
        logger.log("Error al abrir ventas: " + err.message, "error");
    }
}

module.exports = {concretarVenta, cobrarMesa, crearMesa, editarMesa, listadoMesas, buscar, getHTML};
