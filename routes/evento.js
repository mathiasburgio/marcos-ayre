const express = require("express")
const router = express.Router()
const permisos = require("../utils/permisos-middleware")
const eventos = require("../controllers/eventos")

router.get("/eventos", permisos({login: true, admin: true, resp: "html"}), eventos.getHTML);
router.get("/eventos/listado", permisos({login: true, admin: true, resp: "json"}), eventos.listado);
router.get("/eventos/resumen", permisos({login: true, admin: true, resp: "json"}), eventos.resumen);
router.post("/eventos/nuevo", permisos({login: true, admin: true, resp: "json"}), eventos.nuevo);
router.post("/eventos/modificar", permisos({login: true, admin: true, resp: "json"}), eventos.modificar);
router.post("/eventos/activar", permisos({login: true, admin: true, resp: "json"}), eventos.activar);
router.post("/eventos/cerrar", permisos({login: true, admin: true, resp: "json"}), eventos.cerrar);

module.exports = router;
