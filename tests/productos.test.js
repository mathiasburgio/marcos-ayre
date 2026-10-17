const test = require("node:test");
const assert = require("node:assert/strict");
const {DatabaseSync} = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function preparar(){
    const conexion = new DatabaseSync(":memory:");
    conexion.exec(require("../utils/db"));
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
        }
    };
    const contexto = vm.createContext({module: {exports: {}}, console, require: nombre => {
        if(nombre === "../utils/sqlite") return db;
        if(nombre === "../utils/logger") return {log: () => {}};
        return require(nombre);
    }});
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../controllers/productos.js"), "utf8"), contexto);
    const llamar = async (accion, body={}) => {
        const res = {codigo: 200, status(codigo){this.codigo = codigo; return this;}, json(datos){this.datos = datos; return this;}};
        await contexto.module.exports[accion]({body, session: {data: {email: "admin@ejemplo.com"}}}, res);
        return res;
    };
    return {conexion, consultar, llamar};
}

const productoBase = {nombre: "Consumición", precio: 2000, costo: 1000, stock: 10, visible: 1};

test("El alta conserva prioridades 1 a 10 y asigna 5 cuando se omite", async t => {
    const {conexion, llamar, consultar} = preparar();
    t.after(() => conexion.close());
    for(let prioridad = 1; prioridad <= 10; prioridad++){
        const respuesta = await llamar("nuevo", {...productoBase, nombre: `Producto ${prioridad}`, prioridad: String(prioridad)});
        assert.equal(respuesta.codigo, 201);
        assert.equal(respuesta.datos.prioridad, prioridad);
    }
    const respuesta = await llamar("nuevo", productoBase);
    assert.equal(respuesta.datos.prioridad, 5);
    consultar("INSERT INTO productos (nombre) VALUES ('Valor predeterminado del esquema')");
    assert.equal(consultar("SELECT prioridad FROM productos WHERE nombre = 'Valor predeterminado del esquema'")[0].prioridad, 5);
});

test("La edición permite cambiar prioridad con evento activo y conserva el stock", async t => {
    const {conexion, llamar, consultar} = preparar();
    t.after(() => conexion.close());
    const creado = await llamar("nuevo", {...productoBase, prioridad: 10});
    consultar("INSERT INTO eventos (nombre, mesas, activo, fechaInicio) VALUES ('Evento en curso', 1, 1, '2026-10-16T12:00:00.000Z')");
    const datos = {...productoBase, productoId: creado.datos.id, prioridad: 1};
    delete datos.stock;
    const editado = await llamar("modificar", datos);
    assert.equal(editado.codigo, 200);
    assert.equal(editado.datos.prioridad, 1);
    assert.equal(editado.datos.stock, productoBase.stock);
    delete datos.prioridad;
    assert.equal((await llamar("modificar", datos)).datos.prioridad, 1);
    assert.match(consultar("SELECT detalle FROM bitacora WHERE clave = 'modificar_producto' ORDER BY id LIMIT 1")[0].detalle, /prioridad 10 → 1/);
});

test("Prioridades inválidas no crean ni modifican productos", async t => {
    const {conexion, llamar, consultar} = preparar();
    t.after(() => conexion.close());
    const creado = await llamar("nuevo", {...productoBase, prioridad: 5});
    for(const prioridad of [0, 11, -1, 1.5, "", null, true, "alta"]){
        assert.equal((await llamar("nuevo", {...productoBase, nombre: "Otro", prioridad})).codigo, 400);
        assert.equal((await llamar("modificar", {...productoBase, productoId: creado.datos.id, prioridad})).codigo, 400);
    }
    assert.equal(consultar("SELECT COUNT(*) AS cantidad FROM productos")[0].cantidad, 1);
    assert.equal(consultar("SELECT prioridad FROM productos")[0].prioridad, 5);
});

test("Ventas muestra primero prioridades altas, conserva el orden alfabético en empates y oculta no visibles", async t => {
    const {conexion, llamar} = preparar();
    t.after(() => conexion.close());
    for(const [nombre, prioridad, visible] of [["Baja", 10, 1], ["Media B", 5, 1], ["Alta", 1, 1], ["Media A", 5, 1], ["Oculto", 1, 0], ["Segunda", 2, 1]]){
        assert.equal((await llamar("nuevo", {...productoBase, nombre, prioridad, visible})).codigo, 201);
    }
    const listado = await llamar("listado");
    const contexto = vm.createContext({console, localStorage: {getItem: () => null}, $: {getJSON: async () => listado.datos}});
    const fuente = fs.readFileSync(path.join(__dirname, "../public/js/ventas.js"), "utf8").replace("var ventas = new Ventas();", "globalThis.Ventas = Ventas;");
    vm.runInContext(fuente, contexto);
    const ventas = new contexto.Ventas(false);
    let listadoActualizado = false;
    ventas.listarProductos = () => {listadoActualizado = true;};
    await ventas.obtenerProductos();
    assert.deepEqual(Array.from(ventas.productos, producto => producto.nombre), ["Alta", "Segunda", "Media A", "Media B", "Baja"]);
    assert.equal(listadoActualizado, true);
});
