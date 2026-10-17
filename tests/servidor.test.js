const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {EventEmitter} = require("node:events");
const {obtenerModoServidor} = require("../utils/modo-servidor");

function cargar(archivo, dependencias, globales={}){
    const contexto = vm.createContext({module: {exports: {}}, __dirname: path.dirname(path.resolve(archivo)), console, ...globales,
        require: nombre => Object.hasOwn(dependencias, nombre) ? dependencias[nombre] : require(nombre)
    });
    vm.runInContext(fs.readFileSync(archivo, "utf8"), contexto);
    return contexto.module.exports;
}

test("servidor distingue localhost de la IP central y rechaza direcciones inválidas", () => {
    for(const servidor of [undefined, "localhost", "127.0.0.1", " LOCALHOST "]){
        assert.equal(obtenerModoServidor({servidor, port: 3000}).esServidor, true);
    }
    assert.deepEqual(obtenerModoServidor({servidor: "192.168.1.10", port: 4000}), {
        host: "192.168.1.10", esServidor: false, url: "http://192.168.1.10:4000/"
    });
    for(const servidor of ["", null, {}, "http://192.168.1.10", "192.168.1.10:3000", "192.168.1.999", "0.0.0.0", "224.1.1.1"]){
        assert.throws(() => obtenerModoServidor({servidor, port: 3000}), /servidor/);
    }
});

test("La lectura de config agrega servidor a archivos anteriores y conserva la IP configurada", () => {
    for(const servidor of [undefined, "192.168.1.10"]){
        const config = {servidor, port: 3000, db: {database: "ventas.sqlite"}, sessionSecret: "s".repeat(64), licencia: "conservar"};
        const guardados = [];
        const info = cargar("utils/info.js", {
            "./modo-servidor": {obtenerModoServidor},
            fs: {mkdirSync: () => {}, existsSync: () => true, readFileSync: () => JSON.stringify(config), writeFileSync: (archivo, datos) => guardados.push(JSON.parse(datos))},
            child_process: {execFileSync: () => "C:/documentos-simulados"}
        }, {process: {versions: {}}});
        assert.equal(info.config.servidor, servidor || "127.0.0.1");
        assert.equal(info.config.licencia, "conservar");
        assert.equal(info.modoServidor.esServidor, !servidor);
        assert.equal(guardados.length, servidor ? 0 : 1);
    }
});

function prepararImpresion(){
    const enviados = [];
    const sistema = {config: {printer: {interface: "\\\\.\\LPT1"}}, modoServidor: obtenerModoServidor({servidor: "192.168.1.10", port: 3000})};
    const impresion = cargar("controllers/impresion.js", {
        "../utils/info": sistema,
        "../utils/validaciones": require("../utils/validaciones"),
        "../utils/job-printer-back": {print: async trabajo => {enviados.push(trabajo); return {ok: true};}}
    }, {URL});
    return {sistema, impresion, enviados};
}
const responder = () => ({codigo: 200, status(codigo){this.codigo = codigo; return this;}, json(datos){this.datos = datos; return this;}});
const trabajo = {job: [{type: "line", text: "2 Consumiciones"}], charsPerLine: 32};

test("El receptor acepta al servidor central y solo imprime en su propia PC", async () => {
    const {impresion, enviados} = prepararImpresion();
    const respuesta = responder();
    await impresion.recibir({socket: {remoteAddress: "::ffff:192.168.1.10"}, headers: {}, body: {...trabajo, destino: "ip", ip: "192.168.1.99"}}, respuesta);
    assert.equal(respuesta.codigo, 200);
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].job[0].text, "2 Consumiciones");
    assert.equal(enviados[0].destino, undefined);
    assert.equal(enviados[0].ip, undefined);
});

test("El receptor bloquea otras PC, otros orígenes y trabajos inválidos", async () => {
    const {sistema, impresion, enviados} = prepararImpresion();
    for(const direccion of ["192.168.1.11", "127.0.0.1"]){
        const respuesta = responder();
        await impresion.recibir({socket: {remoteAddress: direccion}, headers: {}, body: trabajo}, respuesta);
        assert.equal(respuesta.codigo, 403);
    }
    const origen = responder();
    await impresion.recibir({socket: {remoteAddress: "192.168.1.10"}, headers: {origin: "https://otro.ejemplo"}, body: trabajo}, origen);
    assert.equal(origen.codigo, 403);
    for(const body of [{}, {...trabajo, charsPerLine: 0}]){
        const respuesta = responder();
        await impresion.recibir({socket: {remoteAddress: "192.168.1.10"}, headers: {}, body}, respuesta);
        assert.equal(respuesta.codigo, 400);
    }
    sistema.config.printer = undefined;
    const sinImpresora = responder();
    await impresion.recibir({socket: {remoteAddress: "192.168.1.10"}, headers: {}, body: trabajo}, sinImpresora);
    assert.equal(sinImpresora.codigo, 409);
    assert.equal(enviados.length, 0);
});

test("Express cliente solo registra POST de impresión y no carga sesiones, páginas ni SQLite", () => {
    const cargados = [];
    const sistema = {config: {servidor: "192.168.1.10", port: 3000}, documentsPath: "C:/simulado", modoServidor: {esServidor: false}};
    const servidor = cargar("express.js", {
        "./utils/info": sistema,
        "./utils/permisos-middleware": () => {},
        "./controllers/impresion": {recibir: (req, res) => res.json({ok: true})},
        fs: {mkdirSync: () => {throw Error("No debe crear sesiones");}, readdirSync: () => {throw Error("No debe cargar rutas de páginas");}},
        "express-session": () => {cargados.push("sesiones"); throw Error("No debe cargar sesiones");}
    });
    const rutas = servidor.router.stack.filter(capa => capa.route).map(capa => ({ruta: capa.route.path, metodos: Object.keys(capa.route.methods)}));
    assert.deepEqual(rutas, [{ruta: "/control/imprimir-ticket", metodos: ["post"]}]);
    assert.equal(servidor.get("view engine"), undefined);
    assert.deepEqual(cargados, []);
});

async function iniciarInstancia(servidor){
    const acciones = [], handlers = {};
    const config = {servidor, port: 3000, db: {database: "simulada.sqlite"}};
    const info = {config, modoServidor: obtenerModoServidor(config), documentsPath: "C:/simulado", isPackage: true, ip: "192.168.1.10"};
    let iniciado, ventana;
    class Ventana extends EventEmitter{
        constructor(){super(); ventana = this; this.webContents = {mainFrame: {url: ""}};}
        setMenuBarVisibility(){}
        isDestroyed(){return false;}
        async loadURL(url){this.webContents.mainFrame.url = url; acciones.push(["pantalla", url]);}
    }
    cargar("index.js", {
        electron: {app: {whenReady: () => ({then: callback => {iniciado = Promise.resolve().then(callback);}}), on: () => {}, quit: () => {}}, BrowserWindow: Ventana,
            ipcMain: {handle: (nombre, callback) => handlers[nombre] = callback}, shell: {openExternal: async url => acciones.push(["navegador", url])}},
        "./utils/info": info,
        "./utils/sqlite": {connect: async () => {acciones.push(["sqlite"]);}},
        "./utils/logger.js": {init: () => {}, log: () => {}},
        "./controllers/impresion": {imprimirLocal: async datos => {acciones.push(["imprimir", datos]); return {ok: true};}},
        "./express": {listen: (puerto, host) => {
            acciones.push(["escuchar", puerto, host]);
            const http = new EventEmitter();
            Promise.resolve().then(() => http.emit("listening"));
            return http;
        }},
        fs: {existsSync: () => true},
        axios: {}, "node-cron": {}
    }, {URL});
    await iniciado;
    return {acciones, handlers, ventana};
}

test("Arranque cliente abre login y navegación remotos sin conectar SQLite", async () => {
    const {acciones, handlers, ventana} = await iniciarInstancia("192.168.1.10");
    assert.equal(acciones.some(accion => accion[0] === "sqlite"), false);
    assert.deepEqual(acciones.find(accion => accion[0] === "pantalla"), ["pantalla", "http://192.168.1.10:3000/"]);
    const evento = {sender: ventana.webContents, senderFrame: ventana.webContents.mainFrame};
    assert.equal(handlers["entorno-local"](evento).cliente, true);
    assert.equal((await handlers["imprimir-local"](evento, trabajo)).ok, true);
    await assert.rejects(handlers["imprimir-local"]({...evento, senderFrame: {}}, trabajo), /no autorizada/);
    ventana.webContents.mainFrame.url = "https://otro.ejemplo/";
    await assert.rejects(handlers["imprimir-local"](evento, trabajo), /no autorizada/);
});

test("Arranque servidor conserva la conexión a SQLite y las páginas locales", async () => {
    const {acciones} = await iniciarInstancia("localhost");
    assert.equal(acciones.filter(accion => accion[0] === "sqlite").length, 1);
    assert.deepEqual(acciones.find(accion => accion[0] === "pantalla"), ["pantalla", "http://localhost:3000/"]);
});
