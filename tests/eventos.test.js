const test = require("node:test");
const assert = require("node:assert/strict");
const {DatabaseSync} = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function preparar(){
    const conexion = new DatabaseSync(":memory:");
    conexion.exec(require("../utils/db"));
    const respaldos = [];
    const consultar = (sql, parametros=[]) => {
        const sentencia = conexion.prepare(sql);
        if(/^\s*SELECT/i.test(sql)) return sentencia.all(...parametros).map(fila => ({...fila}));
        const resultado = sentencia.run(...parametros);
        return {insertId: Number(resultado.lastInsertRowid), affectedRows: Number(resultado.changes)};
    };
    const db = {
        executeQuery: async (sql, parametros) => consultar(sql, parametros),
        transaction: callback => {
            conexion.exec("BEGIN IMMEDIATE");
            try{
                const resultado = callback(consultar);
                conexion.exec("COMMIT");
                return resultado;
            }catch(err){
                conexion.exec("ROLLBACK");
                throw err;
            }
        },
        setContador: () => {throw new Error("Un evento no debe incrementar contadores de caja");},
        makeBackup: async archivo => respaldos.push({archivo, eventos: consultar("SELECT * FROM eventos")})
    };
    const contexto = vm.createContext({module: {exports: {}}, console, require: nombre => {
        if(nombre === "../utils/sqlite") return db;
        if(nombre === "../utils/logger") return {log: () => {}};
        if(nombre === "../utils/info") return {documentsPath: "C:/prueba-simulada/ventas-2026"};
        if(nombre === "fs") return {mkdirSync: () => {}};
        if(nombre.startsWith("../utils/")) return require(nombre);
        return require(nombre);
    }});
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../controllers/eventos.js"), "utf8"), contexto);
    const llamar = async (accion, body={}, query={}) => {
        const res = {codigo: 200, status(codigo){this.codigo = codigo; return this;}, json(datos){this.datos = datos; return this;}};
        await contexto.module.exports[accion]({body, query, session: {data: {email: "admin@ejemplo.com"}}}, res);
        return res;
    };
    return {conexion, consultar, respaldos, llamar};
}

test("Crear, abrir y cerrar eventos conserva movimientos y contadores, y mantiene el resumen", async t => {
    const {conexion, consultar, respaldos, llamar} = preparar();
    t.after(() => conexion.close());
    const nuevo = await llamar("nuevo", {fecha: "2026-10-16", nombre: "Evento de prueba", mesas: 4});
    assert.equal(nuevo.codigo, 201);
    assert.equal(consultar("SELECT COUNT(*) AS cantidad FROM movimientosCaja")[0].cantidad, 0);
    const eventoId = nuevo.datos.id;
    const abierto = await llamar("activar", {eventoId});
    assert.equal(abierto.codigo, 200);
    assert.equal(abierto.datos.activo, 1);
    assert.equal(consultar("SELECT COUNT(*) AS cantidad FROM movimientosCaja")[0].cantidad, 0);
    for(const caja of [1, 2, 3, 4]){
        const producto = {nombre: "Consumición", cantidad: caja, precio: 1000, costo: 400, subtotal: caja * 1000};
        consultar("INSERT INTO ventas (eventoId, numeroGlobal, numeroEvento, productos, total, efectivo, transferencia, cajaNumero) VALUES (?, ?, ?, ?, ?, 500, ?, ?)", [eventoId, caja, caja, JSON.stringify([producto]), caja * 1000, caja * 1000 - 500, caja]);
        const productoMesa = {...producto, cantidad: caja * 2, subtotal: caja * 2000, turno: 1};
        consultar("INSERT INTO mesas (eventoId, numero, productos, total, efectivo, transferencia, cajaNumero, cerrada) VALUES (?, ?, ?, ?, 1000, ?, ?, 1)", [eventoId, caja, JSON.stringify([productoMesa]), caja * 2000, caja * 2000 - 1000, caja]);
    }
    consultar("INSERT INTO movimientosCaja (eventoId, numeroGlobal, numeroEvento, tipo, detalle, efectivo, cajaNumero) VALUES (?, 44, 7, 'ingreso', 'Aporte manual', 999, 1)", [eventoId]);
    consultar("INSERT INTO contadores (clave, valor) VALUES ('numeroGlobal', 44)");
    consultar("INSERT INTO contadores (clave, valor) VALUES (?, 7)", [`movimientosCaja_numeroEvento_${eventoId}`]);
    const movimientosPrevios = consultar("SELECT * FROM movimientosCaja");
    const contadoresPrevios = consultar("SELECT * FROM contadores");
    const cerrado = await llamar("cerrar", {eventoId});
    assert.equal(cerrado.codigo, 200);
    assert.equal(cerrado.datos.activo, 0);
    assert.ok(cerrado.datos.fechaFin);
    assert.deepEqual(consultar("SELECT * FROM movimientosCaja"), movimientosPrevios);
    assert.deepEqual(consultar("SELECT * FROM contadores"), contadoresPrevios);
    assert.deepEqual(consultar("SELECT clave, eventoId FROM bitacora").map(fila => fila.clave), ["nuevo_evento", "iniciar_evento", "cerrar_evento"]);
    assert.equal(consultar("SELECT eventoId FROM bitacora WHERE clave = 'cerrar_evento'")[0].eventoId, eventoId);
    assert.equal(respaldos.length, 2);
    assert.match(respaldos[1].archivo, /finalizado-evento_de_prueba-\d+\.sqlite$/);
    assert.equal(respaldos[1].eventos[0].activo, 0);
    const resumen = await llamar("resumen", {}, {eventoId: String(eventoId)});
    assert.equal(resumen.codigo, 200);
    assert.equal(resumen.datos.cantidadVentas, 8);
    assert.equal(resumen.datos.montoTotal, 30000);
    assert.equal(resumen.datos.efectivo, 6000);
    assert.equal(resumen.datos.transferencia, 24000);
    const segundoCierre = await llamar("cerrar", {eventoId});
    assert.equal(segundoCierre.codigo, 409);
    assert.equal(respaldos.length, 2);
    assert.deepEqual(consultar("SELECT * FROM movimientosCaja"), movimientosPrevios);
});

test("El cierre sigue bloqueado cuando hay mesas pendientes de cobro", async t => {
    const {conexion, consultar, respaldos, llamar} = preparar();
    t.after(() => conexion.close());
    consultar("INSERT INTO eventos (id, nombre, mesas, activo, fechaInicio) VALUES (1, 'Evento activo', 1, 1, '2026-10-16T12:00:00.000Z')");
    consultar("INSERT INTO mesas (eventoId, numero, total, productos) VALUES (1, 1, 1000, '[]')");
    const respuesta = await llamar("cerrar", {eventoId: 1});
    assert.equal(respuesta.codigo, 409);
    assert.match(respuesta.datos.error, /mesa pendiente/);
    assert.equal(consultar("SELECT activo FROM eventos WHERE id = 1")[0].activo, 1);
    assert.equal(consultar("SELECT COUNT(*) AS cantidad FROM movimientosCaja")[0].cantidad, 0);
    assert.equal(respaldos.length, 0);
});
