const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {PNG} = require("pngjs");
const {ThermalPrinter, PrinterTypes} = require("node-thermal-printer");

function cargar(archivo, dependencias, globales={}){
    const contexto = vm.createContext({module: {exports: {}}, console, Buffer, ...globales,
        require: nombre => Object.hasOwn(dependencias, nombre) ? dependencias[nombre] : require(nombre)
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", archivo), "utf8"), contexto);
    return contexto.module.exports;
}

test("RawBT genera ESC/POS completo sin ejecutar impresión ni guardar archivos", async () => {
    let ejecutados = 0, archivos = 0;
    const interfaces = [], buffers = [];
    class Termica extends ThermalPrinter{
        constructor(opciones){super(opciones); interfaces.push(opciones.interface);}
        async execute(){ejecutados++; buffers.push(this.getBuffer());}
    }
    const impresor = cargar("utils/job-printer-back.js", {
        electron: {}, "@vscode/sudo-prompt": {},
        "node-thermal-printer": {ThermalPrinter: Termica, PrinterTypes},
        "./info": {config: {printer: {interface: "simulada"}}, documentsPath: "C:/simulado"},
        "./logger": {log: () => {}}, fs: {writeFileSync: () => archivos++}
    });
    const png = new PNG({width: 8, height: 1});
    png.data.fill(0);
    for(let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
    const job = [
        {type: "line", text: "REIMPRESION", bold: true, grande: true, align: "center"},
        {type: "line", text: "2 Consumiciones", align: "left"},
        {type: "table", items: [{nombre: "Pan francés", cantidad: 2}], structure: [{key: "nombre", width: 24}, {key: "cantidad", width: 8, align: "right"}]},
        {type: "separator", char: "-"},
        {type: "image", base64: "data:image/png;base64," + PNG.sync.write(png).toString("base64"), align: "center"},
        {type: "newline", lines: 3}, {type: "cut"}
    ];
    const resultado = await impresor.print({job, charsPerLine: 32, soloGenerar: true});
    assert.equal(resultado.ok, true);
    assert.equal(ejecutados, 0);
    assert.equal(archivos, 0);
    assert.equal(interfaces[0], null);
    const comandos = Buffer.from(resultado.base64, "base64");
    assert.deepEqual(Array.from(comandos.subarray(0, 2)), [0x1b, 0x40]);
    assert.ok(comandos.includes(Buffer.from("2 Consumiciones")));
    assert.ok(comandos.includes(Buffer.from([0x1b, 0x21, 0x30])));
    assert.ok(comandos.includes(Buffer.from([0x1d, 0x56])));
    assert.equal((await impresor.print({job, charsPerLine: 32})).ok, true);
    assert.deepEqual(comandos.subarray(2), buffers[0]);
    assert.equal(ejecutados, 1);
});

test("La preparación RawBT funciona sin impresora configurada y valida el trabajo", async () => {
    const recibidos = [];
    const impresion = cargar("controllers/impresion.js", {
        "../utils/info": {config: {}}, "../utils/validaciones": require("../utils/validaciones"),
        "../utils/job-printer-back": {print: async trabajo => {recibidos.push(trabajo); return {ok: true, base64: "G0BA"};}}
    });
    const trabajo = {job: [{type: "line", text: "2 Gaseosas"}], charsPerLine: 32};
    assert.equal((await impresion.prepararRawBT(trabajo)).base64, "G0BA");
    assert.equal(recibidos[0].soloGenerar, true);
    await assert.rejects(impresion.prepararRawBT({job: [], charsPerLine: 32}), {status: 400});
    assert.equal(recibidos.length, 1);
    const control = cargar("controllers/control.js", {
        "../utils/sqlite": {}, "../utils/info": {config: {}}, "../utils/logger": {log: () => {}},
        "../utils/validaciones": require("../utils/validaciones"), "../utils/destino-impresion": require("../utils/destino-impresion"),
        "./impresion": impresion
    });
    const res = {codigo: 200, status(codigo){this.codigo = codigo; return this;}, json(datos){this.datos = datos; return this;}};
    await control.imprimirTicket({body: {...trabajo, destino: "rawbt"}}, res);
    assert.equal(res.codigo, 200);
    assert.equal(res.datos.base64, "G0BA");
});

function prepararFrontend(userAgent="Android", resultado={ok: true, base64: "G0BA"}){
    const envios = [];
    const contexto = vm.createContext({
        console, navigator: {userAgent}, window: {location: {href: ""}, electronAPI: {imprimirTicket: () => {throw Error("No debe imprimir en la PC");}}},
        localStorage: {getItem: clave => clave === "printerLocation" ? "rawbt" : null},
        menu: {solicitarRawBT: () => {throw Error("No debe solicitar confirmación");}},
        $: {ajax: async opciones => {envios.push(JSON.parse(opciones.data)); return resultado;}}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/resources/PrinterJob.js"), "utf8") + "\nglobalThis.PrinterJob = PrinterJob;", contexto);
    return {impresion: new contexto.PrinterJob(), envios, ventana: contexto.window};
}

test("Android abre directamente RawBT sin solicitar confirmación ni confirmar impresión física", async () => {
    const {impresion, envios, ventana} = prepararFrontend();
    impresion.addLine({text: "2 Gaseosas"});
    const resultado = await impresion.print();
    assert.equal(envios[0].destino, "rawbt");
    assert.equal(envios[0].job[0].text, "2 Gaseosas");
    assert.equal(ventana.location.href, "intent:base64,G0BA#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;");
    assert.equal(resultado.rawbt, true);
    assert.equal(resultado.pendiente, undefined);
    assert.equal(envios.length, 1);
});

test("RawBT rechaza otros dispositivos y respuestas inválidas sin ofrecer un enlace", async () => {
    const desktop = prepararFrontend("Windows");
    await assert.rejects(desktop.impresion.print(), /Android/);
    assert.equal(desktop.envios.length, 0);
    const invalido = prepararFrontend("Android", {ok: true, base64: '<script>alert(1)</script>'});
    await assert.rejects(invalido.impresion.print(), /ticket válido/);
    assert.equal(invalido.ventana.location.href, "");
});

test("Un error al abrir RawBT no provoca reintentos ni duplicados", async () => {
    const {impresion, envios, ventana} = prepararFrontend();
    let intentos = 0;
    Object.defineProperty(ventana.location, "href", {set: () => {intentos++; throw new Error("Intent bloqueado");}});
    await assert.rejects(impresion.print(), /Intent bloqueado/);
    assert.equal(envios.length, 1);
    assert.equal(intentos, 1);
});
