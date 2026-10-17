const {isIPv4} = require("net");
const os = require("os");
const {error} = require("./validaciones");

function resolverDestinoImpresion({destino="servidor", ip}={}, direccionCliente="", interfaces=os.networkInterfaces()){
    if(!["local", "servidor", "ip"].includes(destino)) throw error("Seleccione una impresora válida en Preferencias de interfaz");
    if(destino === "servidor") return null;

    const direccion = String(destino === "local" ? direccionCliente : ip || "").trim().replace(/^::ffff:/i, "");
    if(destino === "local" && direccion === "::1") return null;
    if(!isIPv4(direccion) || Number(direccion.split(".")[0]) === 0 || Number(direccion.split(".")[0]) >= 224){
        throw error(destino === "local" ? "No se pudo identificar una PC local con impresora IPv4" : "Ingrese una dirección IPv4 válida para la PC con impresora");
    }
    const esEstaPC = direccion.startsWith("127.") || Object.values(interfaces).some(lista => (lista || []).some(item => item.address === direccion));
    if(esEstaPC) return null;

    return {ip: direccion};
}

module.exports = {resolverDestinoImpresion};
