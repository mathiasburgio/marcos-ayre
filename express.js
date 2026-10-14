const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const fs = require("fs");
const path = require("path");
const { config, documentsPath: directory } = require("./utils/info");
const permisos = require("./utils/permisos-middleware");

const sessionsPath = path.join(directory, "sesiones");
fs.mkdirSync(sessionsPath, {recursive: true});

const servidor = express();
servidor.disable("x-powered-by");
servidor.set("view engine", "ejs");
servidor.set("views", path.join(__dirname, "public", "views"));

servidor.use((req, res, next) => {
    req.folder = directory;
    next();
});

servidor.use(bodyParser.json({limit: "1mb"}));
servidor.use(bodyParser.urlencoded({extended: true, limit: "1mb"}));
servidor.use(bodyParser.text({type: "text/*", limit: "1mb"}));
// Limita los demás cuerpos, incluso cuando no tienen Content-Type.
servidor.use(bodyParser.raw({type: req => !req.is("multipart/form-data"), limit: "1mb"}));
servidor.use(session({
    name: "ventas2026.sid",
    secret: config.sessionSecret,
    store: new FileStore({path: sessionsPath, ttl: 24 * 60 * 60}),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false, // Electron se conecta al servidor HTTP local.
        maxAge: 24 * 60 * 60 * 1000
    }
}));

servidor.use("/resources", express.static(path.join(__dirname, "public", "resources")));
servidor.use("/js", express.static(path.join(__dirname, "public", "js")));
servidor.use("/css", express.static(path.join(__dirname, "public", "css")));
servidor.use("/imagenes", permisos({login: true, resp: "html"}), express.static(path.join(directory, "imagenes")));

// Los routers ya incluyen sus prefijos (/usuarios, /productos, etc.).
const routesPath = path.join(__dirname, "routes");
for(const file of fs.readdirSync(routesPath).sort()){
    if(!file.endsWith(".js")) continue;
    try{
        const router = require(path.join(routesPath, file));
        if(typeof router !== "function") throw new Error("El archivo no exporta un router");
        servidor.use(router);
    }catch(error){
        console.warn(`No se pudo cargar la ruta ${file}: ${error.message}`);
    }
}

module.exports = servidor;
