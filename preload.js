const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    isElectron: true,
    //abrirVentana: (url) => ipcRenderer.send("abrir-ventana", url)
});