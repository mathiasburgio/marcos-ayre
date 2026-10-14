const express = require("express")
const router = express.Router()
const permisos = require("../utils/permisos-middleware")
const movimientosCaja = require("../controllers/movimientosCaja")

router.get("/movimientosCaja", permisos({login: true, admin: false, resp: "html"}), movimientosCaja.getHTML);
router.get("/movimientosCaja/listado", permisos({login: true, admin: false, resp: "json"}), movimientosCaja.listado);
router.post("/movimientosCaja/nuevo", permisos({login: true, admin: false, resp: "json"}), movimientosCaja.nuevo);

module.exports = router;
