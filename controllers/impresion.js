const fs = require("fs");
const path = require("path");
const sistema = require("../utils/info");
const {error} = require("../utils/validaciones");

function validarTrabajo({job, charsPerLine}={}){
    if(!Array.isArray(job) || !job.length || job.length > 1000) throw error("Trabajo de impresión no válido");
    if(!Number.isInteger(charsPerLine) || charsPerLine < 32 || charsPerLine > 128) throw error("El ancho de impresión debe estar entre 32 y 128 caracteres");
    return {job, charsPerLine};
}

async function imprimirLocal(datos){
    const trabajo = validarTrabajo(datos);
    if(!sistema.config.printer?.interface) throw error("Configure la impresora térmica en esta PC antes de imprimir", 409);
    const resultado = await require("../utils/job-printer-back").print(trabajo);
    if(!resultado.ok) throw error(resultado.error || "No se pudo imprimir el ticket", 500);
    return resultado;
}

async function prepararRawBT(datos){
    const trabajo = validarTrabajo(datos);
    const resultado = await require("../utils/job-printer-back").print({...trabajo, soloGenerar: true});
    if(!resultado.ok) throw error(resultado.error || "No se pudo preparar el ticket para RawBT", 500);
    return resultado;
}

async function instalarLocal(){
    const impresor = require("../utils/job-printer-back");
    const impresoras = await impresor.getPrinters();
    const termica = impresoras.find(impresora => impresora.name.toLowerCase() === "termica");
    if(!termica) throw error('Instale la impresora en Windows con el nombre "termica" antes de continuar');
    const resultado = await impresor.setupPrinterAutomationV2(1, termica.name);
    if(!resultado.ok) throw error(resultado.error || "No se pudo configurar la impresora térmica", 500);
    const config = {...sistema.config, printer: {
        ...sistema.config.printer, name: termica.name, interface: "\\\\.\\LPT1",
        charsPerLine: sistema.config.printer?.charsPerLine || 58
    }};
    fs.writeFileSync(path.join(sistema.documentsPath, "config.json"), JSON.stringify(config, null, 4));
    sistema.config.printer = config.printer;
    return {success: true, printer: config.printer};
}

async function recibir(req, res){
    const direccion = String(req.socket.remoteAddress || "").replace(/^::ffff:/i, "");
    if(direccion !== sistema.modoServidor.host) return res.status(403).json({error: "Solo el servidor configurado puede enviar trabajos de impresión"});
    if(req.headers.origin && req.headers.origin !== new URL(sistema.modoServidor.url).origin){
        return res.status(403).json({error: "Origen de impresión no autorizado"});
    }
    try{
        res.status(200).json(await imprimirLocal(req.body));
    }catch(err){
        res.status(err.status || 500).json({error: err.message || "No se pudo imprimir el ticket"});
    }
}

module.exports = {validarTrabajo, imprimirLocal, prepararRawBT, instalarLocal, recibir};
