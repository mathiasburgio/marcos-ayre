const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const app = process.versions.electron ? require("electron").app : null;

let documentsPath = "";
let config = null;

function getDocumentsPath(){
    if(documentsPath) return documentsPath;

    const documentos = app ? app.getPath("documents") : execFileSync("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-Command",
        "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); [Environment]::GetFolderPath('MyDocuments')"
    ], {encoding: "utf8", windowsHide: true}).trim();
    if(!documentos) throw new Error("No se encontró la carpeta Documentos");

    documentsPath = path.resolve(documentos, "ventas-2026");
    return documentsPath;
}

function getConfig(){
    if(config) return config;

    const directory = getDocumentsPath();
    const configPath = path.join(directory, "config.json");
    fs.mkdirSync(directory, {recursive: true});
    const existe = fs.existsSync(configPath);
    const configuracion = existe ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {
        adminHabilitado: true,
        debug: false,
        restore: false,
        port: 3000,
        ayuda: "devtools: http://localhost:3000/control/mostrar-devtools ó presionar Ctrl+Shift+I",
        db: {
            database: "ventas-2026.sqlite"
        }
    };
    if(!configuracion || typeof configuracion !== "object" || Array.isArray(configuracion)){
        throw new Error("El archivo de configuración debe contener un objeto");
    }

    let puerto = configuracion.port ?? 3000;
    if(typeof puerto === "string" && /^\d+$/.test(puerto.trim())) puerto = Number(puerto);
    if(!Number.isInteger(puerto) || puerto < 1 || puerto > 65535){
        throw new Error("El puerto debe ser un número entero entre 1 y 65535");
    }

    const database = typeof configuracion.db?.database === "string" ? configuracion.db.database.trim() : "";
    const configuracionMysql = configuracion.db && (
        Object.hasOwn(configuracion.db, "host") || Object.hasOwn(configuracion.db, "user") || Object.hasOwn(configuracion.db, "password")
    );
    const dbConfig = {
        database: configuracionMysql && !/\.(sqlite|sqlite3|db)$/i.test(database) ? "ventas-2026.sqlite" : (database || "ventas-2026.sqlite")
    };
    let guardar = !existe;
    if(JSON.stringify(configuracion.db) !== JSON.stringify(dbConfig) || configuracion.port !== puerto){
        configuracion.db = dbConfig;
        configuracion.port = puerto;
        guardar = true;
    }
    if(typeof configuracion.sessionSecret !== "string" || configuracion.sessionSecret.length < 32){
        configuracion.sessionSecret = crypto.randomBytes(32).toString("hex");
        guardar = true;
    }
    if(guardar) fs.writeFileSync(configPath, JSON.stringify(configuracion, null, 4));

    config = configuracion;
    return config;
}

module.exports = {
    get config(){
        return getConfig();
    },
    // Ruta completa de Documentos/ventas-2026, también con Documentos redirigido.
    get documentsPath(){
        return getDocumentsPath();
    },
    get version(){
        return app ? app.getVersion() : require("../package.json").version;
    },
    get isPackage(){
        return app ? app.isPackaged : false;
    },
    get ip(){
        for(const interfaces of Object.values(os.networkInterfaces())){
            for(const direccion of interfaces || []){
                if(!direccion.internal && (direccion.family === "IPv4" || direccion.family === 4)){
                    return direccion.address;
                }
            }
        }
        return "127.0.0.1";
    },
    get domain(){
        return os.hostname();
    }
};
