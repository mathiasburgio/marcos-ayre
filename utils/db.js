// Esquema inicial. utils/sqlite.js lo ejecuta al conectar la base de datos.
module.exports = `
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        contrasena TEXT NOT NULL DEFAULT '',
        esAdmin INTEGER NOT NULL DEFAULT 0 CHECK (esAdmin IN (0, 1)),
        eliminado INTEGER NOT NULL DEFAULT 0 CHECK (eliminado IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        imagen TEXT NOT NULL DEFAULT '',
        nombre TEXT NOT NULL DEFAULT '',
        precio DECIMAL(18, 2) NOT NULL DEFAULT 0,
        costo DECIMAL(18, 2) NOT NULL DEFAULT 0,
        stock DECIMAL(18, 2) NOT NULL DEFAULT 0,
        visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
        eliminado INTEGER NOT NULL DEFAULT 0 CHECK (eliminado IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL DEFAULT '',
        nombre TEXT NOT NULL DEFAULT '',
        mesas INTEGER NOT NULL,
        fechaInicio TEXT NOT NULL DEFAULT '',
        fechaFin TEXT NOT NULL DEFAULT '',
        activo INTEGER NOT NULL DEFAULT 0 CHECK (activo IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventoId INTEGER NOT NULL,
        fecha TEXT NOT NULL DEFAULT '',
        numeroGlobal TEXT NOT NULL DEFAULT '',
        numeroEvento TEXT NOT NULL DEFAULT '',
        productos TEXT NOT NULL DEFAULT '',
        total DECIMAL(18, 2) NOT NULL DEFAULT 0,
        usuarioEmail TEXT NOT NULL DEFAULT '',
        efectivo DECIMAL(18, 2) NOT NULL DEFAULT 0,
        transferencia DECIMAL(18, 2) NOT NULL DEFAULT 0,
        mesaId INTEGER NOT NULL DEFAULT 0,
        cobrado INTEGER NOT NULL DEFAULT 0 CHECK (cobrado IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS mesas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventoId INTEGER NOT NULL,
        numero TEXT NOT NULL DEFAULT '',
        nombre TEXT NOT NULL DEFAULT '',
        telefono TEXT NOT NULL DEFAULT '',
        total DECIMAL(18, 2) NOT NULL DEFAULT 0,
        efectivo DECIMAL(18, 2) NOT NULL DEFAULT 0,
        transferencia DECIMAL(18, 2) NOT NULL DEFAULT 0,
        cobrado INTEGER NOT NULL DEFAULT 0 CHECK (cobrado IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS movimientosCaja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventoId INTEGER NOT NULL,
        fecha TEXT NOT NULL DEFAULT '',
        numeroGlobal TEXT NOT NULL DEFAULT '',
        numeroEvento TEXT NOT NULL DEFAULT '',
        usuarioEmail TEXT NOT NULL DEFAULT '',
        tipo TEXT NOT NULL DEFAULT '',
        detalle TEXT NOT NULL DEFAULT '',
        efectivo DECIMAL(18, 2) NOT NULL DEFAULT 0,
        transferencia DECIMAL(18, 2) NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS contadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clave TEXT NOT NULL DEFAULT '',
        valor INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS registros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clave TEXT NOT NULL DEFAULT '',
        valor TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS bitacora (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL DEFAULT '',
        usuarioEmail TEXT NOT NULL DEFAULT '',
        clave TEXT NOT NULL DEFAULT '',
        detalle TEXT NOT NULL DEFAULT ''
    );
`;


//ventas->productos se guardara como
/*
ventas->productos
{
    nombre,
    cantidad,
    precio,
    costo,
    subtotal,
}


*/
