const express = require("express")
const router = express.Router()
const permisos = require("../utils/permisos-middleware")
const ventas = require("../controllers/ventas")

router.get("/mesas/listado", permisos({login: true, admin: false, resp: "json"}), ventas.listadoMesas);
router.post("/mesas/nuevo", permisos({login: true, admin: true, resp: "json"}), ventas.crearMesa);
router.post("/mesas/editar", permisos({login: true, admin: false, resp: "json"}), ventas.editarMesa);
router.post("/mesas/cobrar", permisos({login: true, admin: false, resp: "json"}), ventas.cobrarMesa);

module.exports = router;
