

const permisos = ({login, admin, resp}) => {
    return (req, res, next) => {
        if (login && !req.session.user) {
            if (resp === "json") return res.status(403).json({error: "Sin permisos para esta acción"});
            else return res.status(403).send("Sin permisos para esta acción");
        }
        if (admin && !req.session.user?.isAdmin) {
            if (resp === "json") return res.status(403).json({error: "Sin permisos para esta acción"});
            else return res.status(403).send("Sin permisos para esta acción");
        }
        next();
    };
};

module.exports = permisos;