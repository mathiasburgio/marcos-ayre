const express = require("express")
const router = express.Router()
const permisos = require("../utils/permisos-middleware")
const ventas = require("../controllers/ventas")

router.get("/ventas", permisos({login: true, admin: false, resp: "html"}), ventas.getHTML);
router.post("/ventas/concretar", permisos({login: true, admin: false, resp: "json"}), ventas.concretarVenta);

router.post("/ventas/buscar", permisos({login: true, admin: false, resp: "json"}), ventas.buscar);

module.exports = router;
