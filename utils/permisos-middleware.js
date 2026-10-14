

const permisos = ({login, admin, esServidor, resp}) => {
    return (req, res, next) => {
        if (login && !req.session?.data) {
            if (resp === "json") return res.status(403).json({error: "Sin permisos para esta acción"});
            else return res.status(403).send("Sin permisos para esta acción");
        }
        if (admin && !req.session?.data?.esAdmin) {
            if (resp === "json") return res.status(403).json({error: "Sin permisos para esta acción"});
            else return res.status(403).send("Sin permisos para esta acción");
        }
        if (esServidor && !req.session?.data?.esServidor) {
            if (resp === "json") return res.status(403).json({error: "Sin permisos para esta acción"});
            else return res.status(403).send("Sin permisos para esta acción");
        }
        next();
    };
};

module.exports = permisos;
