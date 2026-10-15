const { app, BrowserWindow, ipcMain, globalShortcut, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const db = require("./utils/sqlite");
const logger = require("./utils/logger.js");
const { exec } = require("child_process");
const cron = require("node-cron");
const { once } = require("events");
const info = require("./utils/info");

let config = null;

let win;
let servidorHTTP = null;
async function createWindow() {
    try{
        win = new BrowserWindow({
            width: 1600,
            height: 900,
            icon: path.join(__dirname, 'public', 'resources', 'branding', 'ventas.ico'),
            webPreferences: {
                //devTools: configuracion?.debug === true,
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                enableRemoteModule: false,
            },
        });
        logger.log("Aplicacion iniciada");
    
        if(info.isPackage && config.debug !== true){
            win.setMenuBarVisibility(false);
        }else{
            win.setMenuBarVisibility(true);
            setTimeout(()=>{//espero y muestro devtools
                if(win && !win.isDestroyed()) win.webContents.openDevTools();
            },2000);
        }
    
        win.on('closed', () => {
            win = null;
        });

        //conecto a la base de datos
        await db.connect(config.db);

        //inicio el servidor HTTP
        if(!servidorHTTP){
            const servidor = require("./express");
            servidorHTTP = servidor.listen(config.port, "0.0.0.0");
            await once(servidorHTTP, "listening");
            logger.log(`Servidor Express iniciado en http://127.0.0.1:${config.port}/`);
        }

        //cargo pantalla inicial
        await win.loadURL(`http://127.0.0.1:${config.port}/`);


    }catch(e){
        if(servidorHTTP && !servidorHTTP.listening) servidorHTTP = null;
        const mensaje = e.code === "EADDRINUSE" ? `El puerto ${config.port} está ocupado. Cambie port en Documentos/ventas-2026/config.json y vuelva a iniciar.` : e.message;
        logger.log("Error al iniciar la aplicación: " + mensaje, "error");
        if(win && !win.isDestroyed()){
            const texto = mensaje.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
            await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`<html lang="es"><meta charset="UTF-8"><h1>No se pudo iniciar la aplicación</h1><p>${texto}</p></html>`));
        }else{
            dialog.showErrorBox("Error al iniciar la aplicación", mensaje);
            app.quit();
        }
    }
}

app.whenReady().then(async () => {
    //Crea las carpetas neecesarias para el sistema
    try{
        const documentsPath = info.documentsPath;
        let directories = [
            documentsPath, // guarda los archivos de configuracion y datos del sistema
            path.join(documentsPath, "data"), // guarda los productos y configuracion
            path.join(documentsPath, "imagenes"), // guarda las imagenes
            path.join(documentsPath, "logs"),
            path.join(documentsPath, "temp"), // guarda datos temporales
        ];
        directories.forEach(directory=>{
            if(fs.existsSync(directory) == false) fs.mkdirSync( directory, { recursive: true } );
        });
        logger.init(path.join(documentsPath, "logs"));
        config = info.config;
        await createWindow();
    }catch(e){
        logger.log("Error al iniciar la aplicación: " + e.message, "error");
        dialog.showErrorBox("Error al iniciar la aplicación", e.message);
        app.quit();
    }
});

app.on('window-all-closed', async () => {
    if(servidorHTTP?.listening){
        const cerrado = once(servidorHTTP, "close");
        servidorHTTP.close();
        servidorHTTP.closeAllConnections();
        await cerrado;
    }
    app.quit();
});
