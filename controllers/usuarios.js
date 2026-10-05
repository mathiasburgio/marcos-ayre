const fs = require("fs")
const path = require("path")
const db = require("../utils/db")

function getHTML(req, res){
    res.status(200).sendFile(path.join(__dirname, "../views/usuarios.html"))
}

function listado(req, res){
    try{
        const usuarios = db.query("SELECT * FROM usuarios where eliminado != 1")
        res.status(200).json(usuarios)
    }catch(error){
        if(process.env.NODE_ENV === "development") console.error(error)
        res.status(500).json({error: "Error al leer el archivo de usuarios"})
    }
}

function nuevo(req, res){
    try{
        const { nombre, email } = req.body
        const result = db.query("INSERT INTO usuarios (nombre, email) VALUES (?, ?)", [nombre, email])
        res.status(201).json({id: result.insertId, nombre, email})
    }catch(error){
        if(process.env.NODE_ENV === "development") console.error(error)
        res.status(500).json({error: "Error al crear el usuario"})
    }
}

function modificar(req, res){
    try{
        const { id } = req.params
        const { nombre, email } = req.body
        db.query("UPDATE usuarios SET nombre = ?, email = ? WHERE id = ?", [nombre, email, id])
        res.status(200).json({id, nombre, email})
    }catch(error){
        if(process.env.NODE_ENV === "development") console.error(error)
        res.status(500).json({error: "Error al modificar el usuario"})
    }
}

function eliminar(req, res){
    try{
        const { id } = req.params
        db.query("UPDATE usuarios SET eliminado = 1 WHERE id = ?", [id])
        res.status(200).json({id})
    }catch(error){
        if(process.env.NODE_ENV === "development") console.error(error)
        res.status(500).json({error: "Error al eliminar el usuario"})
    }
}

async function asignarContrasena(req, res){
    try{
        const { id } = req.params
        const { contrasena } = req.body
        let usuario = (await db.query("SELECT * FROM usuarios WHERE id = ?", [id])).result[0]
        if(!usuario) throw "Usuario no encontrado"
        if(usuario.esAdmin && usuario.email != req.session.data.email) throw "No se puede cambiar la contraseña de otro administrador"

        await db.query("UPDATE usuarios SET contrasena = ? WHERE id = ?", [contrasena, id])
        res.status(200).json({id})
    }catch(error){
        if(process.env.NODE_ENV === "development") console.error(error)
        res.status(500).json({error: "Error al asignar la contraseña." + error})
    }
}

module.exports = {
    getHTML,
    listado,
    nuevo,
    modificar,
    eliminar,
    asignarContrasena
}