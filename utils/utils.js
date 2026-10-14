const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
/* const { add } = require('node-7z'); */
const crypto = require("crypto");

//cacheo accesos a process.env
const ENCRYPT_FILE_PASSWORD = process.env.ENCRYPT_FILE_PASSWORD;
const CRYPTO_PARAMS= {
    ALGORITHM: process.env.CRYPTO_ALGORITHM,
    ENC_KEY: process.env.CRYPTO_ENC_KEY,
    IV: process.env.CRYPTO_IV,
};

function encryptString(str, prefix=false){
    str = str.toString().trim();
    if(str == ""){return "";}
    let cipher = crypto.createCipheriv(CRYPTO_PARAMS.ALGORITHM, CRYPTO_PARAMS.ENC_KEY, CRYPTO_PARAMS.IV);
    let encrypted = cipher.update(str, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted + (prefix ? "__ENC__" : "");
}
function decryptString(str, prefix=false){
    str = str.toString().trim();
    if(prefix && str.substring(str.length - 7) != "__ENC__") return null;
    str = str.substring(0,str.length - 7);
    if(str == ""){return "";}
    let decipher = crypto.createDecipheriv(CRYPTO_PARAMS.ALGORITHM, CRYPTO_PARAMS.ENC_KEY, CRYPTO_PARAMS.IV);
    let decrypted = decipher.update(str, 'base64', 'utf8');
    return (decrypted + decipher.final('utf8'));
}
async function getPasswordHash(field_password){
    let salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(field_password, salt);
}
async function comparePasswordHash(field_password, bd_password){
    return await bcrypt.compare(field_password, bd_password);
}
function getUUID(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {  
        var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);  
        return v.toString(16);  
    });  
}
function getShortToken(ind){
    let f = Date.now();
    crypto.createHash('sha256').update(`${ind}-${Date.now()}`).digest('hex').slice(0, 8);
}
function getRandomString(length= 8, characters= true, numbers= true){
    let caracteres = ""; 
    if(characters) caracteres += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if(numbers) caracteres += '0123456789';
    
    let cadenaAleatoria = '';
    for (let i = 0; i < length; i++) {
        const indice = Math.floor(Math.random() * caracteres.length);
        cadenaAleatoria += caracteres.charAt(indice);
    }

    return cadenaAleatoria;
}
function simplifyString(str, noSpaces=false){
    str = (str || "").toString();
    str = str.replaceAll("á", "a");
    str = str.replaceAll("é", "e");
    str = str.replaceAll("í", "i");
    str = str.replaceAll("ó", "o");
    str = str.replaceAll("ú", "u");
    str = str.replaceAll("Á", "a");
    str = str.replaceAll("É", "e");
    str = str.replaceAll("Í", "i");
    str = str.replaceAll("Ó", "o");
    str = str.replaceAll("Ú", "u");
    str = str.replaceAll("ñ", "n");
    str = str.replaceAll("Ñ", "n");
    str = str.replace(/[^a-z0-9 -\_\.]/gi, '').toLowerCase().trim();
    if(noSpaces){
        return str.replaceAll(" ", "-")
    }else{
        return str
    }
}
function validateString(str, validator){
    str = (str || "").toString().trim();
    validator = (validator || "").toString().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;

    if(validator == "email" || validator == "mail") return emailRegex.test(str);
    else if(validator == "uuid" || validator == "guid") return uuidRegex.test(str);
    else if(validator == "ip") return ipRegex.test(str);
    else if (validator === "objectid" || validator === "oid") return objectIdRegex.test(str);
    else return null;
}
function encryptFile(finalPath, filePath) {
    return new Promise((resolve, reject) => {
        const encryptStream = add(finalPath, filePath, { password: ENCRYPT_FILE_PASSWORD });
        encryptStream.on('progress', (progress) => {
            //console.log(`Progreso: ${progress.percent}%`);
        });

        encryptStream.on('data', (data) => {
            //console.log(`Archivo procesado: ${data.file}`);
        });

        encryptStream.on('end', () => {
            //console.log(`Archivo cifrado creado exitosamente en: ${encryptedZipPath}`);
            resolve();
        });

        encryptStream.on('error', (err) => {
            reject(err);
        });
    });
}
async function downloadFile(remoteUrl, localPathAndName){
    try{
        const response = await fetch(remoteUrl);
        const writer = fs.createWriteStream(localPathAndName);
        response.body.pipe(writer);

        writer.on('finish', () => {
            // Grabo OK
            //console.log("Descarga completada");
        });
    
        writer.on('error', (err) => {
            errores.push(err)
            //console.error("Error al descargar:", err);
        });
    }catch(err){
        if(process.env.NODE_ENV === "development") console.log("downloadFile ERROR:", err);
        throw err;
    }
}
async function api(url, method='GET', body=null){
    let response = await fetch(url, {
        method: (method === 'POST' ? 'POST' : 'GET'),
        headers:{ 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    let data = await response.json();
    return data;
}
function safeString(str, remove = ["`", "´", "'", '"', "$"], maxLength=255){
    str = (str ?? "").toString();
    remove = Array.isArray(remove) ? remove : [];
    let caracteresARemover = [...new Set(["`", "´", "'", '"', "$", "<", ">", "\\", ...remove])];
    for(let caracter of caracteresARemover){
        if(caracter === null || caracter === undefined) continue;
        str = str.replaceAll(caracter.toString(), "");
    }
    str = str
        .replace(/[\u0000-\u001F\u007F]/g, "") // quita caracteres de control
        .replace(/\s+/g, " ") //quita doble espacio
        .trim();
    if(str.length > maxLength) str = str.substring(0, maxLength);
    return str;
}
async function getFilesInfo(folderPath){
    const archivos = await fs.readdir(folderPath);

    const filesInfo = await Promise.all(
        archivos.map(async (file) => {
            const filePath = path.join(folderPath, file);
            const stats = await fs.stat(filePath);
            return {
                name: file,
                path: filePath,
                mtime: stats.mtime, // Modification time
                birthtime: stats.birthtime, // Creation time
                isFile: stats.isFile(),
                size: stats.size,
            };
        })
    );

    return filesInfo;
}
function decimals(val, dec=2){
    return Number( val.toFixed(dec) );
}
function splitAmountByPercentage(mount, percent, returnBase=false){
    let aux = mount / (1 + (percent / 100));
    return decimals(returnBase ? aux : mount - aux);
}
function reverserPercent(mount, percent){
    let base = splitAmountByPercentage(mount, percent, true);
    return {base: base, percent: mount - base};
}
function arrayToObject(array, keyField) {
    return array.reduce((acc, item) => {
        acc[item[keyField]] = item;
        return acc;
    }, {});
}
//verify if value is number
function getNumber(v, def=null, min = null, max = null){
    if(typeof v == "undefined" || v === "" || v === null) return def;
    if(typeof v != "number" && typeof v != "string") return def;
    if(typeof v == "string"){
        let valor = v.trim();
        if(valor === "" || /e/i.test(valor) || /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(valor) == false) return def;
    }
    let num = Number(v);
    if(Number.isFinite(num) == false) return def;
    if(min !== null && num < min) return min;
    if(max !== null && num > max) return max;
    return num;
}
function getBoolean(v){
    return (v === "true" || v === true || v === "1" || v === 1);
}
module.exports = {
    encryptString,
    decryptString,
    getPasswordHash,
    comparePasswordHash,
    getUUID,
    getShortToken,
    getRandomString,
    simplifyString,
    validateString,
    encryptFile,
    downloadFile,
    api,
    safeString,
    getFilesInfo,
    decimals,
    splitAmountByPercentage,
    reverserPercent,
    getNumber,
    getBoolean,
    arrayToObject
};
