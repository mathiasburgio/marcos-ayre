const express = require("express")
const router = express.Router()
const permisos = require("../utils/permisos-middleware")
const rateLimit = require("../utils/rate-limit-middleware")
const inicio = require("../controllers/inicio")

router.get(["/", "/inicio"], permisos({login: false, admin:false, resp: "html"}), inicio.getHTML);
router.post("/inicio/iniciar-sesion", permisos({login: false, admin: false, resp: "json"}), rateLimit({windowMs: 5 * 60 * 1000, max: 20}), inicio.iniciarSesion);
router.post("/inicio/cerrar-sesion", permisos({login: false, admin: false, resp: "json"}), inicio.cerrarSesion);
router.get("/inicio/cerrar-sesion", permisos({login: false, admin: false, resp: "html"}), inicio.cerrarSesion);

module.exports = router;
