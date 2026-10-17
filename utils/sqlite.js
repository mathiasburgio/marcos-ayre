const { DatabaseSync, backup } = require("node:sqlite");
const fs = require("fs");
const path = require("path");
const info = require("./info");
const { getPasswordHash } = require("./utils");
const logger = process.versions.electron && fs.existsSync(path.join(__dirname, "logger.js")) ? require("./logger.js") : console;
let connection = null;
let databasePath = "";
let respaldoEnCurso = false;

const conf = {
    database: "ventas-2026.sqlite"
};

function prepararEsquema(conexion){
    conexion.exec("BEGIN IMMEDIATE");
    try{
        conexion.exec(require("./db"));
        conexion.exec("COMMIT");
    }catch(err){
        conexion.exec("ROLLBACK");
        throw err;
    }
}

async function connect(preConf=null){
    try{
        if(respaldoEnCurso) throw new Error("Hay un respaldo o una restauración en curso");
        const nextConf = {...conf, ...preConf};
        if(typeof nextConf.database !== "string" || !nextConf.database.trim() ||
            nextConf.database === "." || nextConf.database === ".." || /[\\/:<>"|?*]/.test(nextConf.database)){
            throw new Error("El nombre de la base de datos no es válido");
        }

        const directory = info.documentsPath;
        fs.mkdirSync(directory, {recursive: true});
        const nextPath = path.join(directory, nextConf.database);
        const nextConnection = new DatabaseSync(nextPath, {timeout: 5000});
        try{
            prepararEsquema(nextConnection);
            // Crea el administrador inicial únicamente si todavía no hay usuarios.
            if(!nextConnection.prepare("SELECT id FROM usuarios LIMIT 1").get()){
                const contrasena = await getPasswordHash("123456789");
                nextConnection.prepare(`
                    INSERT INTO usuarios (nombre, email, contrasena, esAdmin, eliminado)
                    SELECT ?, ?, ?, 1, 0
                    WHERE NOT EXISTS (SELECT 1 FROM usuarios)
                `).run("Administrador", "admin@admin.com", contrasena);
            }
        }catch(err){
            nextConnection.close();
            throw err;
        }
        if(connection) connection.close();
        connection = nextConnection;
        databasePath = nextPath;
        Object.assign(conf, nextConf);
        console.log("Conexión a la base de datos establecida");
    }catch(err){
        console.error("Error al conectar a la base de datos:", err);
        logger.log("Error al conectar a la base de datos:", err);
        throw err;
    }
}

const ejecutarConsulta = (query, params=[]) => {
    try {
        if(!connection) throw new Error("No hay conexión a la base de datos");
        if(respaldoEnCurso) throw new Error("Hay un respaldo o una restauración en curso");
        const statement = connection.prepare(query);
        if(statement.columns().length) return statement.all(...params);
        const result = statement.run(...params);
        return {insertId: result.lastInsertRowid, affectedRows: result.changes};
    } catch (err) {
        logger.log("Error al ejecutar la consulta:", err);
        throw err;
    }
};

const executeQuery = async (query, params=[]) => ejecutarConsulta(query, params);

// El callback es sincrónico: ninguna petición puede intercalarse entre BEGIN y
// COMMIT usando esta conexión. Para operaciones asincrónicas, preparar antes los datos.
function transaction(operacion){
    if(!connection) throw new Error("No hay conexión a la base de datos");
    if(respaldoEnCurso) throw new Error("Hay un respaldo o una restauración en curso");
    connection.exec("BEGIN IMMEDIATE");
    try{
        const resultado = operacion(ejecutarConsulta);
        if(resultado && typeof resultado.then === "function") throw new Error("La transacción debe ser sincrónica");
        connection.exec("COMMIT");
        return resultado;
    }catch(err){
        connection.exec("ROLLBACK");
        throw err;
    }
}

function disconnect(){
    if(respaldoEnCurso) throw new Error("Hay un respaldo o una restauración en curso");
    if(connection) connection.close();
    connection = null;
    databasePath = "";
}

const getRegistro = async (clave) => {
    try{
        const rows = await executeQuery("SELECT * FROM registro WHERE clave = ?", [clave]);
        if(rows.length === 1) return rows[0].valor;
        else return null;
    }catch(err){
        logger.log("Error al obtener registro:", err);
        return null;
    }
}

const setRegistro = async (clave, valor) => {
    const rows = await executeQuery("SELECT clave FROM registro WHERE clave = ?", [clave]);
    if(rows.length){
        await executeQuery("UPDATE registro SET valor = ? WHERE clave = ?", [valor, clave]);
    }else{
        await executeQuery("INSERT INTO registro (clave, valor) VALUES (?, ?)", [clave, valor]);
    }
    return true;
}

async function getContador(clave){
    try{
        const rows = await executeQuery("SELECT * FROM contadores WHERE clave = ? ORDER BY id LIMIT 1", [clave]);
        if(rows.length === 1) return rows[0].valor;
        else return 0;
    }catch(err){
        logger.log("Error al obtener contador:", err);
        return null;
    }
}

function setContador(clave, valor="incr", consultar=null){
    if(!consultar) return transaction(consulta => setContador(clave, valor, consulta));
    let incrementar = false;
    if(valor === "incr" || valor === "decr"){
        valor = valor === "incr" ? 1 : -1;
        incrementar = true;
    }else if(typeof valor === "string" && /^[+-]\d+$/.test(valor)){
        valor = Number(valor);
        incrementar = true;
    }else if(typeof valor === "string" && /^\d+$/.test(valor)){
        valor = Number(valor);
    }
    if(!Number.isSafeInteger(valor)) throw "Valor no válido para contador";
    const rows = consultar("SELECT id, valor FROM contadores WHERE clave = ? ORDER BY id LIMIT 1", [clave]);
    const nuevoValor = incrementar ? (rows[0]?.valor ?? 0) + valor : valor;
    if(!Number.isSafeInteger(nuevoValor)) throw "Valor no válido para contador";
    if(rows.length){
        consultar("UPDATE contadores SET valor = ? WHERE id = ?", [nuevoValor, rows[0].id]);
    }else{
        consultar("INSERT INTO contadores (clave, valor) VALUES (?, ?)", [clave, nuevoValor]);
    }
    return nuevoValor;
}

const restoreBackup = async (input) => {
    if(!connection) throw new Error("No hay conexión a la base de datos");
    if(respaldoEnCurso) throw new Error("Hay un respaldo o una restauración en curso");
    if(path.resolve(input).toLowerCase() === path.resolve(databasePath).toLowerCase()){
        throw new Error("El respaldo no puede ser la base de datos en uso");
    }

    let source = null;
    respaldoEnCurso = true;
    try{
        source = new DatabaseSync(input, {readOnly: true});
        const rows = source.prepare("PRAGMA integrity_check").all();
        if(rows.length !== 1 || rows[0].integrity_check !== "ok"){
            throw new Error("El respaldo no es una base de datos SQLite válida");
        }
        const tablas = source.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(tabla => tabla.name);
        if(!tablas.includes("usuarios")) throw new Error("El respaldo no corresponde a la base de datos del sistema");
        const columnasEsperadas = {
            usuarios: ["id", "nombre", "email", "contrasena", "esAdmin", "eliminado"],
            productos: ["id", "imagen", "nombre", "precio", "costo", "stock", "visible", "prioridad", "eliminado"],
            eventos: ["id", "fecha", "nombre", "mesas", "fechaInicio", "fechaFin", "activo"],
            ventas: ["id", "eventoId", "fecha", "numeroGlobal", "numeroEvento", "productos", "total", "usuarioEmail", "efectivo", "transferencia", "cajaNumero"],
            mesas: ["id", "eventoId", "numero", "nombre", "telefono", "total", "efectivo", "transferencia", "productos", "cajaNumero", "cerrada"],
            movimientosCaja: ["id", "eventoId", "fecha", "numeroGlobal", "numeroEvento", "usuarioEmail", "tipo", "detalle", "efectivo", "transferencia", "cajaNumero"],
            contadores: ["id", "clave", "valor"],
            registros: ["id", "clave", "valor"],
            bitacora: ["id", "eventoId", "fecha", "usuarioEmail", "clave", "detalle"]
        };
        for(const [tabla, esperadas] of Object.entries(columnasEsperadas)){
            if(!tablas.includes(tabla)) throw new Error(`El respaldo no tiene la tabla ${tabla}`);
            const columnas = source.prepare(`PRAGMA table_info(${tabla})`).all().map(columna => columna.name);
            if(esperadas.some(columna => !columnas.includes(columna))) throw new Error(`El respaldo tiene una tabla ${tabla} incompatible`);
        }
        connection.close();
        connection = null;
        await backup(source, databasePath);
        return true;
    }catch(err){
        logger.log(err, "restoreBackup");
        throw err;
    }finally{
        try{
            if(source) source.close();
            if(!connection){
                connection = new DatabaseSync(databasePath, {timeout: 5000});
                prepararEsquema(connection);
            }
        }finally{
            respaldoEnCurso = false;
        }
    }
}

const makeBackup = async (output) => {
    if(!connection) throw new Error("No hay conexión a la base de datos");
    if(respaldoEnCurso) throw new Error("Hay un respaldo o una restauración en curso");
    if(path.resolve(output).toLowerCase() === path.resolve(databasePath).toLowerCase()){
        throw new Error("El respaldo no puede sobrescribir la base de datos en uso");
    }

    respaldoEnCurso = true;
    try{
        await backup(connection, output);
        console.log("Backup terminado");
    }catch(err){
        logger.log(err, "makeBackup");
        throw err;
    }finally{
        respaldoEnCurso = false;
    }
}

module.exports = {
    connect,
    disconnect,
    executeQuery,
    transaction,
    getRegistro,
    setRegistro,
    getContador,
    setContador,
    restoreBackup,
    makeBackup
};
