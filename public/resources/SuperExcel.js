class SuperExcel{
    constructor(){
        this.columnsLetters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
        this.currentFile = null;
    }
    //<--CREATION-->
    createFile(sheetNames=["datos"]){
        if(typeof sheetNames == "string") sheetNames = [sheetNames];
        this.currentFile = new ExcelJS.Workbook();
        sheetNames.forEach(sheetName=>{
            this.currentFile.addWorksheet(sheetName);
        })
        return this.currentFile;
    }
    loadFromUrl(url){
        return new Promise(resolve=>{
            fetch(url)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => {
                // Carga el archivo en el libro de Excel
                const workbook = new ExcelJS.Workbook();
                return workbook.xlsx.load(arrayBuffer);
            }).then(ret=>{
                this.currentFile = ret;
                resolve(this.currentFile);
            })
        })
    }
    //<--END CREATION-->

    //<--READING-->
    //columnId debe contener la columna en la cual se almacena un identificador unico. Ej en producto podria ser "codigo de barras"
    //en props se puede pasar {A: "nombre", B: "Precio"}
    readFileAsObject({sheetName="", startRow=1, endRow=10, startColumn=1, endColumn=10, columnId="A", props={}}){
        let sheet = this.currentFile.getWorksheet(sheetName);
        let errors = [];

        //convierto las props a uppercase
        Object.keys(props).forEach(prop=>{
            props[prop.toUpperCase()] = props[prop];
            delete props[prop.toLowerCase()];//elimino las props en lowerCase
        })

        let _startColumn = startColumn;
        if(isNaN(_startColumn)) this.columnToInt(_startColumn);
        let _endColumn = endColumn;
        if(isNaN(_endColumn)) this.columnToInt(_endColumn);

        let ret = {};
        for(let row = startRow; row <= endRow; row++){
            let obj = {};
            obj._row = row;
            let id = null;

            for(let col = _startColumn; col <= _endColumn; col++){
                let letter = this.intToColumn(col);
                let cell = sheet.getCell(letter + row);
                let value = cell.value;
                if(props[letter]){
                    obj[ props[letter] ] = value;
                }else{
                    obj[letter] = value;
                }
                if(letter == columnId) id = value;
            }

            if(typeof ret[columnId] != "undefined"){
                errors.push(`Fila <b>${ret[columnId]._row}</b> y <b>${obj._row}</b> comparten identificador`);
            }else{
                ret[id] = obj;
            }
        }
        return {errors, ret};
    }
    readFileAsArray({sheetName="", startRow=1, endRow=10, startColumn=1, endColumn=10}){
        let sheet = this.currentFile.getWorksheet(sheetName);

        let _startColumn = startColumn;
        if(isNaN(_startColumn)) this.columnToInt(_startColumn);
        let _endColumn = endColumn;
        if(isNaN(_endColumn)) this.columnToInt(_endColumn);

        let ret = [];
        for(let row = startRow; row <= endRow; row++){
            let obj = [];
            for(let col = _startColumn; col <= _endColumn; col++){
                let letter = this.intToColumn(col);
                let cell = sheet.getCell(letter + row);
                let value = cell.value;
                obj.push(value);
            }
            ret.push(obj);
        }
        return ret;
    }
    readFileAsArrayOfObjects({sheetName="", startRow=1, endRow=10, startColumn=1, endColumn=10, props={}}){
        let sheet = this.currentFile.getWorksheet(sheetName);

        //convierto las props a uppercase
        Object.keys(props).forEach(prop=>{
            props[prop.toUpperCase()] = props[prop];
            delete props[prop.toLowerCase()];//elimino las props en lowerCase
        })

        let _startColumn = startColumn;
        if(isNaN(_startColumn)) this.columnToInt(_startColumn);
        let _endColumn = endColumn;
        if(isNaN(_endColumn)) this.columnToInt(_endColumn);

        let ret = [];
        for(let row = startRow; row <= endRow; row++){
            let obj = {};
            obj._row = row;

            for(let col = _startColumn; col <= _endColumn; col++){
                let letter = this.intToColumn(col);
                let cell = sheet.getCell(letter + row);
                let value = cell.value;
                if(props[letter]){
                    obj[ props[letter] ] = value;
                }else{
                    obj[letter] = value;
                }
            }

            ret.push(obj);
        }
        return ret;
    }
    //<--READING-->
    
    //<--EDITION-->
    setHeader(cell, value){
        cell.fill = {
            type: 'pattern',
            pattern:'solid',
            fgColor:{argb:'3F7FBF'}
        };
        cell.font = {
            name: 'Arial',
            family: 4,
            size: 12,
            color: { argb: 'FFFFFF' },
            underline: false,
            bold: true
        };
        cell.border = {
            top: {style:'thin', color: {argb:'FFFFFF'}},
            left: {style:'thin', color: {argb:'FFFFFF'}},
            bottom: {style:'thin', color: {argb:'FFFFFF'}},
            right: {style:'thin', color: {argb:'FFFFFF'}}
        };
        //cambio el ancho de la columna
        let column = cell._column;
        column.width = 30;
        cell.value = value;
    }
    columnToInt(columnHeader){
        return this.columnsLetters.indexOf( columnHeader.toLowerCase() );
    }
    intToColumn(index){
        return this.columnsLetters[index].toUpperCase();
    }
    writeTable(arrayOfObjects, startCell=null){
        if(Array.isArray(arrayOfObjects) == false){
            console.error("arrayOfObjects debe ser un array de objects"); 
            return;
        }
        if(startCell === null){
            console.error("startCell debe ser un workSheet().getCell()"); 
            return;
        }
        if(arrayOfObjects.length == 0){
            console.error("El array esta vacio");
            return;
        }

        let currentRow = startCell.row;
        let currentColumn = this.columnToInt(startCell._column.letter);
        let cc = 0;
        for(let prop in arrayOfObjects[0]){
            let cell = this.currentFile.getWorksheet(startCell.worksheet.name).getCell(this.intToColumn(currentColumn + cc) + currentRow.toString());
            this.setHeader(cell, prop);
            cc++;
        }

        currentRow += 1;//aumento por el encabezado
        for(let item of arrayOfObjects){
            currentColumn = this.columnToInt(startCell._column.letter);
            let cellOffset = 0;
            for(let prop in item){
                let val = item[prop];
                let cell = this.currentFile.getWorksheet(startCell.worksheet.name).getCell(this.intToColumn(currentColumn + cellOffset) + currentRow.toString());
                cell.value = val.toString();
                cellOffset++;
            }
            currentRow++;
        }
    }
    writeTableFromHTMLTable(querySelector, startCell=null){
        if(typeof querySelector != "string"){
            console.error("querySelector debe ser un string"); 
            return;
        }
        if(startCell === null){
            console.error("startCell debe ser un workSheet().getCell()"); 
            return;
        }

        let currentRow = startCell.row;
        let currentColumn = this.columnToInt(startCell._column.letter);
        $(querySelector).find("thead th").each((ind, ev)=>{
            let htmlCell = $(ev);
            let cell = this.currentFile.getWorksheet(startCell.worksheet.name).getCell(this.intToColumn(currentColumn + ind) + currentRow.toString());
            this.setHeader(cell, htmlCell.text());
        })

        currentRow += 1;//aumento por el encabezado
        $(querySelector).find("tbody tr").each((ind, ev)=>{
            let htmlRow = $(ev);
            currentColumn = this.columnToInt(startCell._column.letter);
            htmlRow.find("td").each((ind, ev)=>{
                let cell = this.currentFile.getWorksheet(startCell.worksheet.name).getCell(this.intToColumn(currentColumn + ind) + currentRow.toString());
                cell.value = htmlCell.text();
            })
            currentRow += 1;
        })

    }
    //<--END EDITION-->

    //<--EXPORT-->
    exportFile(name, modalAfterDownload=true){
        this.currentFile.xlsx.writeBuffer().then(function(buffer){
            if(typeof saveAs == "undefined"){
                console.log("falta saveAs")
                alert("Falta el archivo saveAs"); 
                return;
            }
            saveAs(new Blob([buffer],{type:"application/vnd.ms-excel;charset=utf-8"}), name + '.xlsx');
            if(modalAfterDownload) modal.message("Archivo exportado con éxito.");
        });
    }
    //<--END EXPORT-->
}