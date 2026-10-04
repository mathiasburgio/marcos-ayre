const express = require("express")
const router = express.Router()
const permisos = require("../utils/permisos-middleware")
const eventos = require("../controllers/eventos")

router.get("/eventos", permisos({login: true, admin: true, resp: "json"}), eventos.getHTML);
router.post("/eventos/nuevo", permisos({login: true, admin: true, resp: "json"}), eventos.nuevo);
router.post("/eventos/modificar", permisos({login: true, admin: true, resp: "json"}), eventos.modificar);
router.post("/eventos/cerrar", permisos({login: true, admin: true, resp: "json"}), eventos.cerrar);

module.exports = router;