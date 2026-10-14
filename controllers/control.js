const fs = require("fs");
const path = require("path");
const {randomUUID} = require("crypto");
const db = require("../utils/sqlite");
const sistema = require("../utils/info");
const logger = require("../utils/logger");
const {error, texto} = require("../utils/validaciones");

function ventanaActual(BrowserWindow){
    const ventana = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find(ventana => !ventana.isDestroyed());
    if(!ventana || ventana.isDestroyed()) throw error("No hay una ventana de la aplicación disponible", 503);
    return ventana;
}

async function hacerBackup(req, res){
    try{
        // Genera el respaldo y abre su carpeta en la PC servidor.
        const {shell} = require("electron");
        const carpeta = path.join(sistema.documentsPath, "backups");
        fs.mkdirSync(carpeta, {recursive: true});
        const archivo = `ventas-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.sqlite`;
        await db.makeBackup(path.join(carpeta, archivo));
        const aviso = await shell.openPath(carpeta);
        if(aviso) logger.log("El backup se creó pero no se pudo abrir su carpeta: " + aviso, "error");
        res.status(200).json({success: true, archivo, carpeta, aviso: aviso || undefined});
    }catch(err){
        console.log(err);
        logger.log("Error en control: " + err.message, "error");
    }
}

async function hacerRestore(req, res){
    try{
        // La restauración debe estar habilitada expresamente en config.json.
        if(sistema.config.restore !== true) throw error("Debe habilitar restore: true en config.json para restaurar la base de datos", 403);
        const {dialog, BrowserWindow} = require("electron");
        const seleccion = await dialog.showOpenDialog(ventanaActual(BrowserWindow), {
            title: "Restaurar base de datos",
            properties: ["openFile"],
            filters: [{name: "Base de datos SQLite", extensions: ["sqlite", "sqlite3", "db"]}]
        });
        if(seleccion.canceled || !seleccion.filePaths.length) return res.status(200).json({success: false, cancelado: true});
        await db.restoreBackup(seleccion.filePaths[0]);
        res.status(200).json({success: true});
    }catch(err){
        console.log(err);
        logger.log("Error en control: " + err.message, "error");
    }
}

function verificarSesion(req, res){
    const usuario = req.session?.data;
    if(!usuario) return res.status(200).json({sesion: false});
    res.status(200).json({sesion: true, usuario});
}

async function subirArchivo(req, res){
    const file = req.files?.file;
    try{
        if(!file) throw error("Debe subir una imagen en el campo file");
        const carpeta = texto(req.body?.carpeta, "Carpeta", {max: 250});
        const base = path.resolve(sistema.documentsPath);
        const destino = path.resolve(base, carpeta);
        await fs.promises.mkdir(destino, {recursive: true});
        const archivo = path.join(destino, file.filename);
        if(path.resolve(file.path) !== archivo) await fs.promises.rename(file.path, archivo);
        const ruta = path.relative(base, archivo).split(path.sep).join("/");
        res.status(201).json({success: true, archivo: {nombre: file.filename, mimetype: file.mimetype, size: file.size, ruta,
            url: ruta.startsWith("imagenes/") ? "/" + ruta.split("/").map(encodeURIComponent).join("/") : null}});
    }catch(err){
        console.log(err);
        logger.log("Error en control: " + err.message, "error");
    }
}

function info(req, res){
    try{
        // El secreto de firma de las sesiones no forma parte de la información pública.
        const {sessionSecret, ...config} = sistema.config;
        res.status(200).json({config, documentsPath: sistema.documentsPath, version: sistema.version,
            isPackage: sistema.isPackage, ip: sistema.ip, domain: sistema.domain});
    }catch(err){
        console.log(err);
        logger.log("Error en control: " + err.message, "error");
    }
}

function obtenerIP(req, res){
    try{
        res.status(200).json({ip: sistema.ip, domain: sistema.domain});
    }catch(err){
        console.log(err);
        logger.log("Error en control: " + err.message, "error");
    }
}

function mostrarDevTools(req, res){
    try{
        const {BrowserWindow} = require("electron");
        ventanaActual(BrowserWindow).webContents.openDevTools();
        res.status(200).json({success: true});
    }catch(err){
        console.log(err);
        logger.log("Error en control: " + err.message, "error");
    }
}

function abrirVentana(req, res){
    try{
        const url = req.url.split("?")[1];
        if(!url) throw new Error("URL no proporcionada");
        const {shell} = require("electron");
        shell.openExternal(decodeURIComponent(url));
        res.status(200).json({success: true});
    }catch(err){
        console.log(err);
        logger.log("Error en control: " + err.message, "error");
    }
}

module.exports = {hacerBackup, hacerRestore, verificarSesion, subirArchivo, info, mostrarDevTools, obtenerIP, abrirVentana};
