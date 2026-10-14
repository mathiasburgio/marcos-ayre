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
        if(conexion.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'retiros'").get() &&
            !conexion.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'movimientosCaja'").get()){
            conexion.exec("ALTER TABLE retiros RENAME TO movimientosCaja");
        }
        conexion.exec(require("./db"));
        const columnasMovimientos = conexion.prepare("PRAGMA table_info(movimientosCaja)").all().map(columna => columna.name);
        if(!columnasMovimientos.includes("tipo")){
            conexion.exec("ALTER TABLE movimientosCaja ADD COLUMN tipo TEXT NOT NULL DEFAULT 'egreso'");
        }
        if(!columnasMovimientos.includes("fecha")){
            conexion.exec("ALTER TABLE movimientosCaja ADD COLUMN fecha TEXT NOT NULL DEFAULT ''");
        }
        if(conexion.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'retiros'").get()){
            const columnasRetiros = conexion.prepare("PRAGMA table_info(retiros)").all().map(columna => columna.name);
            const fecha = columnasRetiros.includes("fecha") ? "fecha" : "''";
            const tipo = columnasRetiros.includes("tipo") ? "tipo" : "'egreso'";
            conexion.exec(`
                INSERT INTO movimientosCaja (eventoId, numeroGlobal, numeroEvento, usuarioEmail, detalle, efectivo, transferencia, fecha, tipo)
                SELECT eventoId, numeroGlobal, numeroEvento, usuarioEmail, detalle, efectivo, transferencia, ${fecha}, ${tipo} FROM retiros
            `);
            conexion.exec("DROP TABLE retiros");
        }
        // Migra las bases anteriores: el último evento es siempre el activo.
        if(conexion.prepare("PRAGMA table_info(eventos)").all().some(columna => columna.name === "cerrado")){
            conexion.exec("ALTER TABLE eventos DROP COLUMN cerrado");
        }
        conexion.exec("UPDATE eventos SET activo = CASE WHEN id = (SELECT MAX(id) FROM eventos) THEN 1 ELSE 0 END");
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
        const rows = await executeQuery("SELECT * FROM contador WHERE clave = ?", [clave]);
        if(rows.length === 1) return rows[0].valor;
        else return null;
    }catch(err){
        logger.log("Error al obtener contador:", err);
        return null;
    }
}

async function setContador(clave, valor="incr"){
    if(typeof valor == "string" && (valor[0] == "+" || valor[0] == "-")){
        if(/^[+-]\d+(?:\.\d+)?$/.test(valor) == false) throw "Valor no válido para contador";
        const aux = Number(valor);
        if(Number.isFinite(aux) == false) throw "Valor no válido para contador";
        const rows = await executeQuery("UPDATE contador SET valor = valor + ? WHERE clave = ? RETURNING valor", [aux, clave]);
        valor = rows.length === 1 ? rows[0].valor : null;
    }else if(valor == "incr"){
        const rows = await executeQuery("UPDATE contador SET valor = valor + 1 WHERE clave = ? RETURNING valor", [clave]);
        valor = rows.length === 1 ? rows[0].valor : null;
    }else if(valor == "decr"){
        const rows = await executeQuery("UPDATE contador SET valor = valor - 1 WHERE clave = ? RETURNING valor", [clave]);
        valor = rows.length === 1 ? rows[0].valor : null;
    }else if(typeof valor === "string" && /^\d+(?:\.\d+)?$/.test(valor)){
        valor = Number(valor);
        if(Number.isFinite(valor) == false) throw "Valor no válido para contador";
        const rows = await executeQuery("UPDATE contador SET valor = ? WHERE clave = ? RETURNING valor", [valor, clave]);
        valor = rows.length === 1 ? rows[0].valor : null;
    }else if(typeof valor === "number"){
        if(Number.isFinite(valor) == false) throw "Valor no válido para contador";
        const rows = await executeQuery("UPDATE contador SET valor = ? WHERE clave = ? RETURNING valor", [valor, clave]);
        valor = rows.length === 1 ? rows[0].valor : null;
    }else{
        throw "Valor no válido para contador";
    }
    return valor;
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
            productos: ["id", "imagen", "nombre", "precio", "costo", "stock", "visible", "eliminado"],
            eventos: ["id", "fecha", "nombre", "mesas", "activo"],
            ventas: ["id", "eventoId", "fecha", "numeroGlobal", "numeroEvento", "productos", "total", "usuarioEmail", "efectivo", "transferencia", "mesaId", "cobrado"],
            mesas: ["id", "eventoId", "numero", "nombre", "telefono", "total", "efectivo", "transferencia", "cobrado"],
            movimientosCaja: ["id", "eventoId", "numeroGlobal", "numeroEvento", "usuarioEmail", "detalle", "efectivo", "transferencia"]
        };
        for(const [tabla, esperadas] of Object.entries(columnasEsperadas)){
            if(!tablas.includes(tabla)) continue; // El esquema inicial crea las tablas de versiones anteriores.
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
