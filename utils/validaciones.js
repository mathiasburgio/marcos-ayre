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

function entero(valor, campo, {opcional=false, negativo=false}={}){
    if(opcional && (valor === undefined || valor === null || valor === "" || (typeof valor === "string" && !valor.trim()))) return 0;
    if(typeof valor !== "number" && typeof valor !== "string") throw error(`${campo} debe ser un número`);
    const cadena = String(valor).trim();
    if(!(negativo ? /^-?\d+$/ : /^\d+$/).test(cadena)) throw error(`${campo} debe ser un número entero${negativo ? "" : " no negativo"}`);
    const resultado = Number(cadena);
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
    const resultado = Number(BigInt(precio) * BigInt(cantidad));
    if(!Number.isSafeInteger(resultado)) throw error("El subtotal está fuera de rango");
    return resultado;
}

module.exports = {error, texto, identificador, entero, sumar, subtotal};
