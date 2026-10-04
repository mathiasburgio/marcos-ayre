const express = require("express")
const router = express.Router()
const permisos = require("../utils/permisos-middleware")
const rateLimit = require("../utils/rate-limit-middleware")
const index = require("../controllers/index")

router.get("/", permisos({login: false, admin:false, resp: "html"}), rateLimit({windowMs: 5 * 60 * 1000, max: 5}), index.getHTML);
router.post("/login", permisos({login: false, admin: false, resp: "json"}), index.login);
router.post("/logout", permisos({login: false, admin: false, resp: "json"}), index.logout);
router.get("/logout", permisos({login: false, admin: false, resp: "html"}), index.logout);

module.exports = router;