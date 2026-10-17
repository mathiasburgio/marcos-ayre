const {isIPv4} = require("net");

function obtenerModoServidor(config){
    const servidor = config.servidor === undefined ? "127.0.0.1" : config.servidor;
    if(typeof servidor !== "string") throw new Error("servidor debe contener localhost o la IP del servidor");
    const host = servidor.trim().toLowerCase();
    if(host !== "localhost" && (!isIPv4(host) || Number(host.split(".")[0]) === 0 || Number(host.split(".")[0]) >= 224)){
        throw new Error("servidor debe contener localhost o una dirección IPv4 válida, sin http:// ni puerto");
    }
    return {host, esServidor: host === "localhost" || host === "127.0.0.1", url: `http://${host}:${config.port}/`};
}

module.exports = {obtenerModoServidor};
