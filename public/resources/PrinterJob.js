class PrintJob {
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

    addLine({ text = "", bold = false, align = "left" } = {}) {
        this.job.push({
            type: "line",
            text,
            bold,
            align
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
    async print() {
        if (window.electronAPI) {
            return await window.electronAPI.imprimir({
                job: this.job,
                paper: this.paper,
                printerName: this.printerName
            });
        } else {
            console.warn("No está en Electron");
        }
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