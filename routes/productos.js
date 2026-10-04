const express = require("express")
const router = express.Router()
const permisos = require("../utils/permisos-middleware")
const productos = require("../controllers/productos")

router.get("/productos", permisos({login: true, admin:true, resp: "html"}), productos.getHTML);
router.get("/productos/listado", permisos({login: true, admin: false, resp: "json"}), productos.listado);

router.post("/productos/nuevo", permisos({login: true, admin: true, resp: "json"}), productos.nuevo);
router.post("/productos/modificar", permisos({login: true, admin: true, resp: "json"}), productos.modificar);
router.post("/productos/eliminar", permisos({login: true, admin: true, resp: "json"}), productos.eliminar);

module.exports = router;