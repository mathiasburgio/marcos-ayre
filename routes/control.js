const express = require("express")
const router = express.Router()
const permisos = require("../utils/permisos-middleware")
const subirImagen = require("../utils/multer-middleware")
const control = require("../controllers/control")

router.get("/control/obtener-ip", permisos({login: true, admin: true, resp: "json"}), control.obtenerIP);
router.post("/control/hacer-backup", permisos({login: true, admin: true, esServidor: true, resp: "json"}), control.hacerBackup);
router.post("/control/hacer-restore", permisos({login: true, admin: true, esServidor: true, resp: "json"}), control.hacerRestore);
router.get("/control/verificar-sesion", permisos({login: false, resp: "json"}), control.verificarSesion);
router.post("/control/seleccionar-caja", permisos({login: true, resp: "json"}), control.seleccionarCaja);
router.get("/control/info", permisos({login: true, admin: true, resp: "json"}), control.info);
router.post("/control/subir-archivo", permisos({login: true, admin: true, resp: "json"}), subirImagen, control.subirArchivo);
router.post("/control/mostrar-devtools", permisos({login: false, admin: false, esServidor: true, resp: "json"}), control.mostrarDevTools);
router.get("/control/mostrar-devtools", permisos({login: false, admin: false, esServidor: true, resp: "json"}), control.mostrarDevTools);
router.get("/control/abrir-ventana", permisos({login: true, admin: true, esServidor: true, resp: "json"}), control.abrirVentana);

module.exports = router;
