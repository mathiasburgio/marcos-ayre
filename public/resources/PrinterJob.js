class PrinterJob {
    constructor({ paper = 58, printerName = null } = {}) {
        this.job = [];
        this.paper = paper;
        this.size = paper === 80 ? 48 : 32;
        this.printerName = printerName;
    }

    // =========================
    // 🔧 HELPERS
    // =========================
    pad(text, length, align = "left") {
        text = String(text ?? "");

        if (text.length > length) {
            text = length > 3
                ? text.substring(0, length - 3) + "..."
                : text.substring(0, length);
        }

        if (align === "right") return text.padStart(length, " ");
        if (align === "center") {
            let left = Math.floor((length - text.length) / 2);
            let right = length - text.length - left;
            return " ".repeat(left) + text + " ".repeat(right);
        }

        return text.padEnd(length, " ");
    }

    formatColumns(structure, data) {
        return structure.map(col => {
            return this.pad(data[col.key], col.width, col.align);
        }).join("");
    }

    // =========================
    // 🧾 ELEMENTOS
    // =========================

    addLine({ text = "", bold = false, align = "left", grande = false } = {}) {
        this.job.push({
            type: "line",
            text,
            bold,
            align,
            grande
        });
    }

    addTable(items, structure) {
        this.job.push({
            type: "table",
            items,
            structure
        });
    }

    addNewLine(lines = 1) {
        this.job.push({
            type: "newline",
            lines
        });
    }

    addSeparator(char = "-") {
        this.job.push({
            type: "separator",
            char
        });
    }

    // =========================
    // 🚀 ENVIAR
    // =========================
    static validarIP(ip) {
        if(typeof ip !== "string") return false;
        const partes = ip.split(".");
        return partes.length === 4 && partes.every(parte => /^(0|[1-9]\d{0,2})$/.test(parte) && Number(parte) <= 255)
            && Number(partes[0]) > 0 && Number(partes[0]) < 224 && ip !== "255.255.255.255";
    }

    async print() {
        const destino = localStorage.getItem("printerLocation") || "local";
        if(destino === "ninguna") return {ok: true, omitida: true};
        const ip = (localStorage.getItem("printerIP") || "").trim();
        if(!["local", "servidor", "ip", "rawbt"].includes(destino)) throw new Error("Seleccione una impresora en Preferencias de interfaz");
        if(destino === "rawbt" && !/Android/i.test(navigator.userAgent)){
            throw new Error("RawBT requiere un dispositivo Android con la app RawBT y su impresora Bluetooth configuradas");
        }
        if(destino === "ip" && !PrinterJob.validarIP(ip)){
            throw new Error("Ingrese una IP válida para la impresora en Preferencias de interfaz");
        }
        if(destino === "local" && window.electronAPI?.imprimirTicket){
            return await window.electronAPI.imprimirTicket({job: this.job, charsPerLine: this.size});
        }
        const resultado = await $.ajax({
            url: "/control/imprimir-ticket",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({job: this.job, charsPerLine: this.size, destino, ...(destino === "ip" ? {ip} : {})})
        });
        if(destino === "rawbt"){
            if(resultado?.ok !== true || typeof resultado.base64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(resultado.base64) || resultado.base64.length % 4 !== 0){
                throw new Error("El servidor no devolvió un ticket válido para RawBT");
            }
            const url = `intent:base64,${resultado.base64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
            window.location.href = url;
            return {ok: true, rawbt: true};
        }
        return resultado;
    }
}

/*
EJEMPLO
    const job = new PrintJob({ paper: 58 });

    job.addLine({ text: "MATEFLIX", bold: true, align: "center" });
    job.addSeparator();

    job.addLine({ text: "Transacción Nº 123" });

    job.addSeparator();

    job.addTable(
        [
            { nombre: "Pan francés", cantidad: 2, subtotal: 1000 },
            { nombre: "Facturas surtidas", cantidad: 1, subtotal: 800 }
        ],
        [
            { key: "nombre", width: 18, align: "left" },
            { key: "cantidad", width: 4, align: "right" },
            { key: "subtotal", width: 10, align: "right" }
        ]
    );

    job.addSeparator();

    job.addLine({ text: "TOTAL: $1800", bold: true, align: "right" });

    job.print();



*/
