const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {resolverDestinoImpresion} = require("../utils/destino-impresion");

const interfaces = {red: [{address: "192.168.1.10"}]};

test("Servidor y Local en la misma PC usan la impresora configurada", () => {
    assert.equal(resolverDestinoImpresion({}, "192.168.1.20", interfaces), null);
    for(const direccion of ["127.0.0.1", "::1", "::ffff:127.0.0.1", "192.168.1.10"]){
        assert.equal(resolverDestinoImpresion({destino: "local"}, direccion, interfaces), null);
    }
    assert.equal(resolverDestinoImpresion({destino: "ip", ip: "192.168.1.10"}, "", interfaces), null);
});

test("Local identifica al cliente por el socket; Asignar IP usa la dirección elegida", () => {
    assert.deepEqual(resolverDestinoImpresion({destino: "local", ip: "192.168.1.99"}, "::ffff:192.168.1.20", interfaces), {
        ip: "192.168.1.20"
    });
    assert.deepEqual(resolverDestinoImpresion({destino: "ip", ip: "192.168.1.30"}, "192.168.1.20", interfaces), {
        ip: "192.168.1.30"
    });
});

test("El destino solo admite IPv4 válidas, sin rutas ni puertos arbitrarios", () => {
    for(const ip of ["", "servidor", "192.168.1.300", "192.168.1.2:3000", "http://192.168.1.2", "192.168.1.2/otro", "192.168.1.2\\otro", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1"]){
        assert.throws(() => resolverDestinoImpresion({destino: "ip", ip}, "", interfaces), {status: 400});
    }
    assert.throws(() => resolverDestinoImpresion({destino: "otro"}, "", interfaces), {status: 400});
    assert.throws(() => resolverDestinoImpresion({destino: "local"}, "2001:db8::1", interfaces), {status: 400});
});

test("PrinterJob toma las preferencias vigentes y bloquea una IP inválida antes de enviar", async () => {
    const preferencias = new Map();
    const envios = [];
    const contexto = vm.createContext({
        window: {},
        localStorage: {getItem: clave => preferencias.get(clave) || null},
        $: {ajax: async opciones => {envios.push(JSON.parse(opciones.data)); return {ok: true};}}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/resources/PrinterJob.js"), "utf8") + "\nglobalThis.PrinterJob = PrinterJob;", contexto);
    const impresion = new contexto.PrinterJob();
    impresion.addLine({text: "2 Gaseosa"});
    await impresion.print();
    assert.equal(envios[0].destino, "local");
    preferencias.set("printerLocation", "servidor");
    await impresion.print();
    assert.equal(envios[1].destino, "servidor");
    preferencias.set("printerLocation", "ip");
    preferencias.set("printerIP", "192.168.1.30");
    await impresion.print();
    assert.equal(envios[2].ip, "192.168.1.30");
    assert.equal(envios[2].job[0].text, "2 Gaseosa");
    preferencias.set("printerIP", "192.168.1.999");
    await assert.rejects(impresion.print(), /IP válida/);
    assert.equal(envios.length, 3);
    const locales = [];
    contexto.window.electronAPI = {imprimirTicket: async trabajo => {locales.push(trabajo); return {ok: true};}};
    preferencias.set("printerLocation", "local");
    await impresion.print();
    assert.equal(locales[0].job[0].text, "2 Gaseosa");
    assert.equal(envios.length, 3);
});

test("Sin impresora omite tickets y pruebas sin HTTP, IPC, RawBT ni carga de imágenes", async () => {
    const contexto = vm.createContext({
        localStorage: {getItem: () => "ninguna"},
        window: {electronAPI: {imprimirTicket: () => {throw new Error("No debe usar IPC");}}},
        $: {ajax: () => {throw new Error("No debe enviar HTTP");}},
        fetch: () => {throw new Error("No debe cargar imágenes");}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/resources/PrinterJob.js"), "utf8"), contexto);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/resources/job-printer-front.js"), "utf8") + "\nglobalThis.PrintJob = PrintJob;", contexto);
    const impresion = new contexto.PrintJob();
    impresion.addLine({text: "Ticket"});
    impresion.addCut();
    assert.equal((await impresion.print()).omitida, true);
    assert.equal((await new contexto.PrintJob().test()).omitida, true);
});

test("El controlador imprime en el destino sin exigir una impresora en el servidor", async () => {
    const envios = [];
    let falloRemoto = false;
    const sistema = {config: {port: 3000}};
    const contexto = vm.createContext({module: {exports: {}}, console, require: nombre => {
        if(nombre === "../utils/sqlite") return {};
        if(nombre === "../utils/info") return sistema;
        if(nombre === "../utils/logger") return {log: () => {}};
        if(nombre === "./impresion") return {
            validarTrabajo: require("../controllers/impresion").validarTrabajo,
            imprimirLocal: async () => {throw Object.assign(new Error("Sin impresora configurada"), {status: 409});}
        };
        if(nombre === "axios") return {post: async (url, trabajo, opciones) => {
            envios.push({url, trabajo, opciones});
            if(falloRemoto) throw new Error("Sin conexión");
            return {data: {ok: true}};
        }};
        if(nombre === "../utils/job-printer-back") return {print: async datos => {envios.push(datos); return {ok: true};}};
        if(nombre.startsWith("../utils/")) return require(nombre);
        return require(nombre);
    }});
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../controllers/control.js"), "utf8"), contexto);
    const imprimirTicket = contexto.module.exports.imprimirTicket;
    const responder = () => ({codigo: 200, status(codigo){this.codigo = codigo; return this;}, json(datos){this.datos = datos; return this;}});
    const cuerpo = {job: [{type: "line", text: "2 Gaseosa"}], charsPerLine: 32, destino: "ip", ip: "192.0.2.30"};
    const respuesta = responder();
    await imprimirTicket({body: cuerpo, socket: {remoteAddress: "192.0.2.20"}}, respuesta);
    assert.equal(respuesta.codigo, 200);
    assert.equal(envios[0].url, "http://192.0.2.30:3000/control/imprimir-ticket");
    assert.equal(envios[0].trabajo.job[0].text, "2 Gaseosa");
    assert.equal(envios[0].trabajo.destino, undefined);
    assert.equal(envios[0].opciones.maxRedirects, 0);
    const sinConfigurar = responder();
    await imprimirTicket({body: {...cuerpo, destino: "servidor"}}, sinConfigurar);
    assert.equal(sinConfigurar.codigo, 409);
    const invalida = responder();
    await imprimirTicket({body: {...cuerpo, ip: "192.0.2.30/otro"}}, invalida);
    assert.equal(invalida.codigo, 400);
    assert.equal(envios.length, 1);
    falloRemoto = true;
    const desconectada = responder();
    await imprimirTicket({body: cuerpo}, desconectada);
    assert.equal(desconectada.codigo, 502);
    assert.equal(envios.length, 2);
});

test("El impresor térmico recibe la interfaz elegida sin modificar la configuración", async () => {
    const configuracion = {printer: {interface: "\\\\.\\LPT1", name: "termica"}};
    const interfacesUsadas = [];
    let enviados = 0;
    class ImpresoraSimulada{
        constructor(opciones){interfacesUsadas.push(opciones.interface);}
        alignLeft(){}
        bold(){}
        println(){}
        async execute(){enviados++;}
    }
    const contexto = vm.createContext({module: {exports: {}}, console, require: nombre => {
        if(nombre === "electron") return {};
        if(nombre === "node-thermal-printer") return {ThermalPrinter: ImpresoraSimulada, PrinterTypes: {EPSON: "epson"}};
        if(nombre === "@vscode/sudo-prompt") return {};
        if(nombre === "./info") return {config: configuracion, documentsPath: "C:/prueba-simulada"};
        if(nombre === "./logger") return {log: () => {}};
        if(nombre === "fs") return {writeFileSync: () => {}};
        return require(nombre);
    }});
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../utils/job-printer-back.js"), "utf8"), contexto);
    const print = contexto.module.exports.print;
    const job = [{type: "line", text: "2 Gaseosa"}];
    const remoto = await print({job, charsPerLine: 32, interfaz: "\\\\192.168.1.30\\Ticketera"});
    const servidor = await print({job, charsPerLine: 32});
    assert.equal(remoto.ok, true);
    assert.equal(servidor.ok, true);
    assert.deepEqual(interfacesUsadas, ["\\\\192.168.1.30\\Ticketera", "\\\\.\\LPT1"]);
    assert.equal(configuracion.printer.interface, "\\\\.\\LPT1");
    assert.equal(enviados, 2);
});
