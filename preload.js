const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    isElectron: true,
    obtenerEntorno: () => ipcRenderer.invoke("entorno-local"),
    imprimirTicket: trabajo => ipcRenderer.invoke("imprimir-local", trabajo),
    configurarImpresora: () => ipcRenderer.invoke("configurar-impresora-local"),
    abrirNavegador: url => ipcRenderer.invoke("abrir-navegador-local", url)
});
