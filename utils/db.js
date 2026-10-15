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
        precio INTEGER NOT NULL DEFAULT 0,
        costo INTEGER NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
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
        numeroGlobal INTEGER NOT NULL,
        numeroEvento INTEGER NOT NULL,
        productos TEXT NOT NULL DEFAULT '',
        total INTEGER NOT NULL DEFAULT 0,
        usuarioEmail TEXT NOT NULL DEFAULT '',
        efectivo INTEGER NOT NULL DEFAULT 0,
        transferencia INTEGER NOT NULL DEFAULT 0,
        cajaNumero INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS mesas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventoId INTEGER NOT NULL,
        numero INTEGER NOT NULL,
        nombre TEXT NOT NULL DEFAULT '',
        telefono TEXT NOT NULL DEFAULT '',
        total INTEGER NOT NULL DEFAULT 0,
        efectivo INTEGER NOT NULL DEFAULT 0,
        transferencia INTEGER NOT NULL DEFAULT 0,
        productos TEXT NOT NULL DEFAULT '',
        cajaNumero INTEGER NOT NULL DEFAULT 1,
        cerrada INTEGER NOT NULL DEFAULT 0 CHECK (cerrada IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS movimientosCaja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventoId INTEGER NOT NULL,
        fecha TEXT NOT NULL DEFAULT '',
        numeroGlobal INTEGER NOT NULL,
        numeroEvento INTEGER NOT NULL,
        usuarioEmail TEXT NOT NULL DEFAULT '',
        tipo TEXT NOT NULL DEFAULT '',
        detalle TEXT NOT NULL DEFAULT '',
        efectivo INTEGER NOT NULL DEFAULT 0,
        transferencia INTEGER NOT NULL DEFAULT 0,
        cajaNumero INTEGER NOT NULL DEFAULT 1
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
        eventoId INTEGER NOT DEFAULT 0,
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
