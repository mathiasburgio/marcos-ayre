const express = require("express")
const router = express.Router()
const permisos = require("../utils/permisos-middleware")
const mesas = require("../controllers/mesas")

router.get("/mesas/listado", permisos({login: true, admin: false, resp: "json"}), mesas.listado);
router.post("/mesas/editar", permisos({login: true, admin: false, resp: "json"}), mesas.nuevo);
router.post("/mesas/cobrar", permisos({login: true, admin: false, resp: "json"}), mesas.nuevo);

module.exports = router;