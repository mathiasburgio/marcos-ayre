const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {randomUUID} = require("crypto");
const info = require("./info");
const logger = require("./logger");

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        try{
            const temp = path.join(info.documentsPath, "temp");
            fs.mkdirSync(temp, {recursive: true});
            callback(null, temp);
        }catch(err){
            callback(err);
        }
    },
    filename: (req, file, callback) => {
        const tipo = file.mimetype.slice("image/".length).toLowerCase();
        const extensiones = {jpeg: ".jpg", "svg+xml": ".svg", "x-icon": ".ico", "vnd.microsoft.icon": ".ico"};
        const extension = extensiones[tipo] || (/^[a-z0-9]{1,10}$/.test(tipo) ? "." + tipo : ".img");
        callback(null, randomUUID() + extension);
    }
});

const subir = multer({
    storage,
    limits: {fileSize: 1024 * 1024, files: 1},
    fileFilter: (req, file, callback) => {
        if(typeof file.mimetype !== "string" || !file.mimetype.startsWith("image/")){
            return callback(Object.assign(new Error("Solo se permiten archivos de imagen"), {status: 400}));
        }
        callback(null, true);
    }
}).single("file");

module.exports = (req, res, next) => {
    subir(req, res, err => {
        if(err){
            logger.log("Error al subir imagen: " + err.message, "error");
            const grande = err.code === "LIMIT_FILE_SIZE";
            const mensaje = grande ? "La imagen no puede superar 1 MB" :
                (err instanceof multer.MulterError ? "Debe subir una sola imagen en el campo file" :
                    (err.status ? err.message : "No se pudo subir la imagen"));
            return res.status(grande ? 413 : (err instanceof multer.MulterError ? 400 : err.status || 500)).json({error: mensaje});
        }
        req.files = req.file ? {file: req.file} : {};
        next();
    });
};
