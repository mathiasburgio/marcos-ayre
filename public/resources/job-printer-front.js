class PrintJob {
    constructor({ paper = 58, printerName = null } = {}) {
        this.job = [];
        this.paper = paper;
        this.size = paper === 80 ? 48 : 32;
        this.printerName = printerName;
        this.images = new Map();
        
    }

    async preloadImages(url){
        if(this.images.has(url)) return this.images.get(url);
        let base64 = await this.imageUrlToBase64(url);
        this.images.set(url, base64);
        return base64;
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

    addCut() {
        this.job.push({
            type: "cut"
        });
    }

    addImage({path, align = "center"} = {}) {
        if(!this.images.has(path)) throw new Error("La imagen no fue precargada. Usa preloadImages(url) antes de agregarla al trabajo.");
        this.job.push({
            type: "image",
            align: align,
            base64: this.images.get(path)
        });
    }

    /*
        TODO:
        - permitir asignar tamaño
        - permitir asignar intensidad de dithering (intensidad)
    */
    async imageUrlToBase64(url, intensidad = 0.05) { //intensidad 0 a 1
        try{
            const resp = await fetch(url);
            const blob = await resp.blob();
            const img = await createImageBitmap(blob);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const MAX_WIDTH = 200;
            const MAX_HEIGHT = 100;
            const scaleSize = Math.min(MAX_WIDTH / img.width, MAX_HEIGHT / img.height, 1);
            canvas.width = Math.max(1, Math.round(img.width * scaleSize));
            canvas.height = Math.max(1, Math.round(img.height * scaleSize));

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Matriz de Bayer 4x4 para dispersión equilibrada
            const bayer = [
                [ 0, 8, 2, 10],
                [12, 4, 14, 6],
                [ 3, 11, 1, 9],
                [15, 7, 13, 5]
            ];

            // Mapeamos la intensidad (0 = más blanco, 1 = más negro)
            // Ajustamos el factor para que incluso el negro puro tenga huecos
            const factor = intensidad * 16; 

            for (let i = 0; i < data.length; i += 4) {
                const x = (i / 4) % canvas.width;
                const y = Math.floor((i / 4) / canvas.width);
                
                // Brillo de 0 a 15 para comparar con la matriz
                const r = data[i], g = data[i+1], b = data[i+2];
                const gray = (0.299 * r + 0.587 * g + 0.114 * b) / 16;

                // Si el valor de la matriz es mayor al brillo ajustado por intensidad, pintamos blanco
                // Esto garantiza que incluso en negros (gray ≈ 0) haya puntos blancos
                const threshold = bayer[x % 4][y % 4];
                const val = (gray + factor > threshold) ? 255 : 0;

                data[i] = data[i + 1] = data[i + 2] = val;
            }

            ctx.putImageData(imageData, 0, 0);
            //document.querySelector("body").appendChild(canvas); // para debug, mostrar el canvas con la imagen procesada
            return canvas.toDataURL('image/png');
        }catch(err){
            console.error("Error descargando o procesando la imagen:", err);
        }
    }

    async test(versionName="mateflix") {
        this.addLine({ text: versionName.toUpperCase(), bold: true, align: "center" });
        this.addSeparator();

        this.addLine({ text: "Transacción Nº 123" });

        this.addSeparator();

        this.addTable(
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

        this.addSeparator();

        this.addLine({ text: "TOTAL: $1800", bold: true, align: "right" });

        this.addSeparator();

        await this.preloadImages(`./resources/${versionName}-icono-256x256.png`);
        this.addImage({path: `./resources/${versionName}-icono-256x256.png`, align: "center"});
        
        this.addCut();

        const resp = await this.print();
        console.log(resp);
    }

    // =========================
    // 🚀 ENVIAR
    // =========================
    async print() {
        if (window.electronAPI) {
            return await window.electronAPI.printJob({
                job: this.job,
                //paper: this.paper,
                //printerName: this.printerName
            });
        } else {
            console.warn("No está en Electron");
        }
    }
}
