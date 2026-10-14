const info = require("./info");
const path = require("path");
const fs = require("fs");
let logDir = "";


const log = (message, ...args) => {
    try{
        if(!logDir) throw new Error("El directorio de logs no está inicializado. Llama a logger.init(directory) antes de usar logger.log()");
        const yearMonth = new Date().toISOString().slice(0, 7); // formato YYYY-MM
        const logFile = path.join(logDir, `log-${yearMonth}.txt`);
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
        const logMessage = `[${new Date().toISOString()}] ${message} ${args.length ? JSON.stringify(args) : ""}`;
        if(!info.isPackage) console.log(logMessage, ...args);
    
        fs.appendFileSync(logFile, logMessage + "\n");
    }catch(err){
        console.error("Error al escribir en el log:", err);
    }
}

const getLog = (yearMonth=null) => {
    try{
        if(!logDir) throw new Error("El directorio de logs no está inicializado. Llama a logger.init(directory) antes de usar logger.getLog()");
        if(!yearMonth) yearMonth = new Date().toISOString().slice(0, 7); // formato YYYY-MM
        const logFile = path.join(logDir, `log-${yearMonth}.txt`);
        if (!fs.existsSync(logFile)) return null;
        const logContent = fs.readFileSync(logFile, "utf-8");
        return logContent;
    }catch(err){
        console.error("Error al leer el log:", err);
        return null;
    }
}

module.exports = {
    init: (directory)=>{
        logDir = directory;
    },
    log,
    getLog
};
