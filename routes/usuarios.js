const express = require("express")
const router = express.Router()
const permisos = require("../utils/permisos-middleware")
const usuarios = require("../controllers/usuarios")

router.get("/usuarios", permisos({login: true, admin:true, resp: "html"}), usuarios.getHTML);
router.get("/usuarios/listado", permisos({login: true, admin: false, resp: "json"}), usuarios.listado);

router.post("/usuarios/nuevo", permisos({login: true, admin: true, resp: "json"}), usuarios.nuevo);
router.post("/usuarios/modificar", permisos({login: true, admin: true, resp: "json"}), usuarios.modificar);
router.post("/usuarios/eliminar", permisos({login: true, admin: true, resp: "json"}), usuarios.eliminar);
router.post("/usuarios/asignar-contrasena", permisos({login: true, admin: true, resp: "json"}), usuarios.asignarContrasena);

module.exports = router;