function error(mensaje, status=400){
    return Object.assign(new Error(mensaje), {status});
}

function texto(valor, campo, {opcional=false, max=200}={}){
    if(opcional && (valor === undefined || valor === null || valor === "")) return "";
    if(typeof valor !== "string") throw error(`${campo} debe ser un texto`);
    const resultado = valor.trim();
    if((!opcional && !resultado) || resultado.length > max){
        throw error(`${campo} es obligatorio y debe tener hasta ${max} caracteres`);
    }
    return resultado;
}

function identificador(valor, campo="ID"){
    if(typeof valor !== "number" && (typeof valor !== "string" || !/^\d+$/.test(valor.trim()))){
        throw error(`${campo} debe ser un entero positivo`);
    }
    const numero = Number(valor);
    if(!Number.isSafeInteger(numero) || numero <= 0) throw error(`${campo} debe ser un entero positivo`);
    return numero;
}

// Importes y cantidades con dos decimales se calculan como enteros para evitar
// que los errores de punto flotante cambien el saldo de una mesa.
function centavos(valor, campo, {opcional=false}={}){
    if(opcional && (valor === undefined || valor === null || valor === "" || (typeof valor === "string" && !valor.trim()))) return 0;
    if(typeof valor !== "number" && typeof valor !== "string") throw error(`${campo} debe ser un número`);
    const cadena = String(valor).trim();
    if(!/^\d+(?:\.\d{1,2})?$/.test(cadena)) throw error(`${campo} debe ser un número no negativo con hasta dos decimales`);
    const [entero, fraccion=""] = cadena.split(".");
    const resultado = Number(BigInt(entero) * 100n + BigInt(fraccion.padEnd(2, "0")));
    if(!Number.isSafeInteger(resultado)) throw error(`${campo} está fuera de rango`);
    return resultado;
}

function sumar(...valores){
    const resultado = valores.reduce((total, valor) => total + BigInt(valor), 0n);
    const numero = Number(resultado);
    if(!Number.isSafeInteger(numero)) throw error("El total está fuera de rango");
    return numero;
}

function subtotal(precio, cantidad){
    const resultado = Number((BigInt(precio) * BigInt(cantidad) + 50n) / 100n);
    if(!Number.isSafeInteger(resultado)) throw error("El subtotal está fuera de rango");
    return resultado;
}

module.exports = {error, texto, identificador, centavos, sumar, subtotal};
