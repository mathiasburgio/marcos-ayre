const { BrowserWindow } = require("electron"); //requerido para listar impresoras  
const { ThermalPrinter, PrinterTypes } = require("node-thermal-printer");
const { exec } = require("child_process");
const sudo = require("@vscode/sudo-prompt");
const util = require('util');
const execPromise = util.promisify(exec);

const logger = require("./logger");
const fs = require("fs");
const path = require("path");
const info = require("./info");

function pad(text, length, align = "left") {
    text = String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (text.length > length) {
        text = length > 3
            ? text.substring(0, length - 3) + "..."
            : text.substring(0, length);
    }

    if (align === "right") return text.padStart(length, " ");
    if (align === "center") {
        let left = Math.floor((length - text.length) / 2);
        let right = length - text.length - left;
        return " ".repeat(left) + text + " ".repeat(right);
    }

    return text.padEnd(length, " ");
}

async function print({printerName=null, job=null, charsPerLine=null, interfaz=null, soloGenerar=false} = {}) {
    try{
        let debugStr = "";
/*         const win = BrowserWindow.getAllWindows()[0];
        const printers = await win.webContents.getPrintersAsync();
        
        if (!printerName) {
            const def = printers.find(p => p.isDefault);
            printerName = def?.name;
        } */
        charsPerLine = Number(charsPerLine || info.config.printer?.charsPerLine || 58);
        if(charsPerLine < 32) charsPerLine = 32; //mínimo 32, porque con menos no se ve bien
        if(charsPerLine > 128) charsPerLine = 128; //máximo 128, porque con más no se ve bien

        const c = info.config;
        const interface = interfaz || c?.printer?.interface || `printer:${printerName}`;
        debugStr += `
        <div><b>Fecha: </b>${new Date().toLocaleString()}</div>
        <div><b>Usando impresora: </b>${printerName || c?.printer?.name}</div>
        <div><b>Interfaz: </b>${interface}</div>
        <div><b>Tamaño (caracteres): </b>${charsPerLine}</div>
        <br><br>`;

        const printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            width: charsPerLine,
            interface: soloGenerar ? null : interface,
            //interface: `printer:${printerName}`,
            characterSet: 'SLOVENIA', // <--- Agrega esto
            removeSpecialCharacters: false,
        });

        //console.log(job);

        for (const item of job) {
    
            switch (item.type) {
    
                case "line": {
                    const texto = String(item.text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if(item.grande) printer.setTextQuadArea();
                    printer.bold(!!item.bold);
    
                    if (item.align === "center") printer.alignCenter();
                    else if (item.align === "right") printer.alignRight();
                    else printer.alignLeft();
    
                    debugStr += `<div style='text-align: ${item.align || "left"}; ${item.bold ? "font-weight: bold;" : ""} ${item.grande ? "font-size: 2em;" : ""}'>${texto}</div>`;
                    printer.println(texto);
                    if(item.grande) printer.setTextNormal();
                    break;
                }
    
                case "table":
                    printer.alignLeft();
    
                    item.items.forEach(row => {
                        const line = item.structure.map(col => {
                            let text = row[col.key] ?? "";
                            return pad(text, col.width, col.align);
                        }).join("");
    
                        debugStr += `<div style='text-align: left;'>${line}</div>`;
                        printer.println(line);
                    });
    
                    break;
    
                case "newline":
                    for (let i = 0; i < item.lines; i++) {
                        debugStr += `<br>`;
                        printer.newLine();
                    }
                    break;
    
                case "separator": {
                    const separador = String(item.char ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").repeat(charsPerLine);
                    debugStr += `<div style='text-align: left;'>${separador}</div>`;
                    printer.println(separador);
                    break;
                }
                
                case "image":
                    if (item.align === "center") printer.alignCenter();
                    else if (item.align === "right") printer.alignRight();
                    else printer.alignLeft();

                    let buffer = Buffer.from(
                        item.base64.replace(/^data:image\/\w+;base64,/, ""),
                        "base64"
                    );

                    debugStr += `<div style='text-align: ${item.align || "left"};'><img src='data:image/png;base64,${buffer.toString("base64")}' /></div>`;
                    await printer.printImageBuffer(buffer); 
                    break;

                case "cut":
                    debugStr += `<div style='text-align: center;'>--- CORTE ✂️ ---</div>`;
                    printer.cut();
                    break;
            }
        }

        if(soloGenerar){
            const buffer = Buffer.concat([Buffer.from([0x1b, 0x40]), printer.getBuffer()]);
            return {ok: true, base64: buffer.toString("base64")};
        }

        fs.writeFileSync(path.join(info.documentsPath, "debug-print-job.html"), `
            <html>
                <style>
                    body{
                        font-family: monospace;
                        /* white-space: pre-wrap; */
                        width: ${charsPerLine}ch;
                        max-width: ${charsPerLine}ch;
                        overflow-wrap: break-word;
                    }
                </style>
                <body>${debugStr}</body>
            </html>`, 
        "utf-8");
        await printer.execute();

        return { ok: true };
    }catch(err){
        logger.log("Error en print job:", err);
        return { ok: false, error: err.message };
    }
}
async function getPrinters(){
    const win = BrowserWindow.getAllWindows()[0];
    return await win.webContents.getPrintersAsync();
}

// comparte la impresora por la red y la asigna a LPT1 para que node-thermal-printer pueda usarla sin importar su nombre real
//esta version requiere {exec}
async function setupPrinterAutomation(lptNumber, printerName) {
    const shareName = "TicketeraMateflix";
    
    try {
        logger.log(`Configurando ${printerName}...`);

        // 1. Compartir la impresora usando PowerShell
        // Usamos un nombre fijo (shareName) para que sea predecible
        await execPromise(`powershell -Command "Set-Printer -Name '${printerName}' -Shared $true -ShareName '${shareName}'"`);

        // 2. Eliminar mapeos previos de LPT1 para evitar conflictos
        await execPromise(`net use LPT${lptNumber} /delete /y`).catch(() => {}); 

        // 3. Mapear a LPT1 usando la ruta UNC
        // Usamos 127.0.0.1 para asegurar que apunte a la propia máquina
        await execPromise(`net use LPT${lptNumber} \\\\127.0.0.1\\${shareName} /Persistent:Yes`);

        logger.log("Configuración exitosa.");
        return { ok: true };
    } catch (error) {
        logger.log("Error en la automatización:", error);
        return { ok: false, error: error.message };
    }
}

// Elevación de permisos con la versión compatible con Node 24.
function execSudoPromise(command) {
    return new Promise((resolve, reject) => {
        sudo.exec(command, {name: "Sistema gestion POS"}, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

async function setupPrinterAutomationV2(lptNumber, printerName) {
    const shareName = "Ticketera";
    
    try {
        logger.log(`Configurando ${printerName}...`);

        // 1. Compartir la impresora usando PowerShell
        // Requiere aceptar la solicitud de permisos de administrador de Windows.
        logger.log("Solicitando permisos de administrador para compartir la impresora...");
        await execSudoPromise(`powershell -NoProfile -NonInteractive -Command "$ErrorActionPreference = 'Stop'; Set-Printer -Name '${printerName}' -Shared $true -ShareName '${shareName}'"`);
        logger.log("Impresora compartida en red con éxito.");

        // 2. Eliminar mapeos previos 
        // ✅ NO REQUIERE ADMIN: Usamos tu execPromise normal. 
        await execPromise(`net use LPT${lptNumber} /delete /y`, {windowsHide: true}).catch(() => {});

        // 3. Mapear a LPT usando la ruta UNC
        // ✅ NO REQUIERE ADMIN: Vital usar el exec normal para que el LPT quede asociado a la sesión del usuario actual.
        await execPromise(`net use LPT${lptNumber} \\\\127.0.0.1\\${shareName} /Persistent:Yes`, {windowsHide: true});

        logger.log(`Configuración exitosa: ${printerName} mapeada a LPT${lptNumber}.`);
        return { ok: true };
    } catch (error) {
        // Si el usuario le da a "No" en el cartelito de permisos, caerá directamente acá.
        logger.log("Error en la automatización:", error);
        return { ok: false, error: error.message || "El usuario canceló los permisos o falló el comando." };
    }
}
module.exports = { print, getPrinters, setupPrinterAutomation, setupPrinterAutomationV2 };
