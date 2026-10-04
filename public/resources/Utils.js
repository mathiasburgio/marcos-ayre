class Utils{
    constructor(){
        this.isMobile = $(document).width() < 1024;
    }
    isJquery(element){
        return element instanceof jQuery;
    }
    sleep(ms=1000){
        return new Promise(resolve=>{
            setTimeout(()=>resolve(true), ms);
        })
    }
    //pseudonimo
    async wait(ms){ return await this.sleep(ms) }
    sort(ar, prop, asc = true){
        ar.sort((a,b)=>{
            if(asc){
                if(a[prop] > b[prop]) return 1;
                if(a[prop] < b[prop]) return -1;
            }else{
                if(a[prop] > b[prop]) return -1;
                if(a[prop] < b[prop]) return 1;
            }
            return 0;
        });
    }
    getURL(prepend, id, title){
        let aux = this.simplifyString(id + "-" + title);
        return prepend + aux.replaceAll(" ", "-");
    }
    FD(object){
        let fd = new FormData();
        for(let prop in object){
            fd.append(prop, object[prop]);
        }
        return fd;
    }
    decimals(str, dec=2){
        str = str.toString();
        let separador_decimal = ",";
        let a = [];

        if(separador_decimal == "."){
            a = [".", ","];
        }else{
            a = [",", "."];
        }

        str = "" + str;
        str = str.replace(a[0], a[1]);
        if(str == ""){str = 0;}
        return  parseFloat( parseFloat(str).toFixed(dec) );
    }
    getUrlQuery(){
        let params = {};
        window.location.search.substring(1).split("&").forEach(param=>{
            let [key, value] = param.split("=");
            params[key] = value ? value : key;
        });
        return params;
    }
    copyToClipboard(val, contenedor=null){
        if(navigator?.clipboard?.writeText){
            navigator.clipboard.writeText(val);
        }else{
            let conte = document.querySelector("body");
            if(contenedor){
                if(typeof contenedor.length == "undefined"){//querySelector
                    conte = contenedor;
                }else{//jquery
                    conte = contenedor[0];
                }
            }
            let input = document.createElement("input");
            input.id = "textToClipbloar";
            input.value = val;
            conte.appendChild(input);
            input.select();
            document.execCommand("copy");
            input.remove();
        }
    }
    getUUID(){
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {  
            var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);  
            return v.toString(16);  
        });  
    }
    formatNumberWithSeparators(str, sdecimal=",", smiles="."){
        str = str.toString();
        let signo = null;
        if(str.startsWith("-")){
            signo = "-";
            str = str.substring(1);
        }
        let [enteros, decimales] = str.split(".");
        let numeroEntero = enteros.split("");
        numeroEntero.reverse();
        let aux = [];
        let tres = 3;
        numeroEntero.forEach(n=>{
            if(tres == 0){
                tres = 3;
                aux.push(smiles);
            }
            aux.push(n);
            tres--;
        })
        aux.reverse();

        if(decimales){
            return (signo ? "-" : "") + aux.join("") + sdecimal + decimales;
        }else{
            return (signo ? "-" : "") + aux.join("");//devuelvo sin decimales
            //return aux.join("") + sdecimal + "00"; //fuerza a devolver 2 decimales
        }
    }
    formatNumber(str, dec=0){
        str = str.toString();
        let v = dec >= 0 ? this.decimals(str, dec) : parseInt(str);
        return this.formatNumberWithSeparators(v);
    }
    getOptions({ar, text, value=null, selected=null}){
        let htmlOptions = "";
        for(let item of ar){
            let _selected = false;
            let _text;
            let _value;
            if(typeof item == "object"){
                _text = item[text];
                _value = value ? item[value] : _text;
            }else{
                _text = item;
                _value = item;
            }
            if(typeof text == "function") _text = text(item);

            if(selected === _value) _selected = true;
            htmlOptions += `<option value='${_value}' ${_selected ? "selected" : ""}>${_text}</option>`;
        }
        return htmlOptions;
    }
    getRandomString(length= 8, characters= true, numbers= true){
        let caracteres = ""; 
        if(characters) caracteres += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if(numbers) caracteres += '0123456789';
        
        let cadenaAleatoria = '';
        for (let i = 0; i < length; i++) {
            const indice = Math.floor(Math.random() * caracteres.length);
            cadenaAleatoria += caracteres.charAt(indice);
        }
    
        return cadenaAleatoria;
    }
    simplifyString(str, noSpaces=false){
        str = (str || "").toString();
        str = str.replaceAll("á", "a");
        str = str.replaceAll("é", "e");
        str = str.replaceAll("í", "i");
        str = str.replaceAll("ó", "o");
        str = str.replaceAll("ú", "u");
        str = str.replaceAll("Á", "a");
        str = str.replaceAll("É", "e");
        str = str.replaceAll("Í", "i");
        str = str.replaceAll("Ó", "o");
        str = str.replaceAll("Ú", "u");
        str = str.replaceAll("ñ", "n");
        str = str.replaceAll("Ñ", "n");
        str = str.replace(/[^a-z0-9 _\-.]/gi, '').toLowerCase().trim();
        str = str.replaceAll("  ", " ");//quita el doble espacio
        if(noSpaces){
            return str.replaceAll(" ", "-")
        }else{
            return str
        }
    }
    validateString(str, validator){
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    
        if(validator == "email" || validator == "mail") return emailRegex.test(str);
        else if(validator == "uuid" || validator == "guid") return uuidRegex.test(str);
        else if(validator == "ip") return ipRegex.test(str);
        else return null;
    }
    uploadFile(url, file,  params){
        return new Promise((resolve, reject)=>{
            let formData = new FormData();
            formData.append("file", file);
            for(let prop in params){
                formData.append(prop, params[prop]);
            }
            $.ajax({
                url: url,
                type: "POST",
                data: formData,
                processData: false,
                contentType: false,
                success: (response) => {
                    resolve(response);
                },
                error: (err) => {
                    reject(err);
                }
            });
        })
    }
    uploadFileWithProgress({url, file, onProgress, onFinish}){
        const xhr = new XMLHttpRequest();
    
        xhr.open("POST", url, true);
        
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress(percentComplete);
            }
        };
    
        xhr.onload = () => {
            if (xhr.status === 200 && onFinish) {
                onFinish(null, xhr.responseText);
            } else if (onFinish) {
                onFinish(new Error(`Upload failed with status ${xhr.status}`));
            }
        };
    
        xhr.onerror = () => {
            if (onFinish) onFinish(new Error("An error occurred during the upload"));
        };
    
        const formData = new FormData();
        formData.append("file", file);
        
        xhr.send(formData);
    }
    uploadButton({url, input, button, onFinish=null}){
        let _input = (input instanceof jQuery == false) ? $(input) : input;
        let _button = (button instanceof jQuery == false) ? $(button) : button;
        
        let file = _input[0].files[0];
        if(!file) return;

        _button.prop("disabled", true);
        _button.append(`<span name='upload-progress'>0%</span>`);
        let spanProgress = _button.find("[name='upload-progress']");
        
        this.uploadFileWithProgress({
            url, 
            file, 
            onProgress: p =>{
                spanProgress.html(p.toFixed(0) + "%");
            },
            onFinish: (ret, responseText) => {
                if(onFinish) onFinish(ret, responseText);
            }
        })
    }
    saveFile(content, name= "file.txt", type= "text/plain;charset=utf-8",) {
        let blob = new Blob([content], { type: type });
        saveAs(blob, name);
    }
    async ping(timeout=3000){
        try{
            let resp = await $.get({ 
                url: "/ping",
                timeout: timeout
            })
            if(resp === "pong") return true;
        }catch(err){
            return false;
        }finally{
            return false;
        }
    }
    arrayToObject(ar, id){
        if(typeof id == "undefined" || id === null) throw "arrayToObject param id must be and STRING or FUNCTION";
        let ret = {};
        if(typeof id == "function"){//a funcion debe retornar cual debe ser la "key" del objeto
            ar.forEach(item=>{
                ret[ id(item) ] = item;
            });
        }else{//se utiliza un campo del objeto como key. Ej "_id", "barcode", "dni"
            ar.forEach(item=>{
                ret[ item[id] ] = item;
            });
        }
        return ret;
    }
    bindShowPasswordEvent( buttonElement, inputElement ){
        const _showPassword = (show=null) => {
            if(show === null){//toggle
                _showPassword( inputElement.prop("type") == "password" )
            }else if(show === true){
                buttonElement.find("i").addClass("fa-eye").removeClass("fa-eye-slash");
                buttonElement.addClass("btn-warning").removeClass("btn-light");
                inputElement.prop("type", "text");
            }else if(show === false){
                buttonElement.find("i").addClass("fa-eye-slash").removeClass("fa-eye");
                buttonElement.addClass("btn-light").removeClass("btn-warning");
                inputElement.prop("type", "password");
            }else{
                
            }
        }
        if(this.isMobile){
            buttonElement.click(ev=>{
                _showPassword(null);
            })
        }else{
            buttonElement.mousedown(ev=>{
                _showPassword(true);
            }).mouseup(ev=>{
                _showPassword(false);
            }).mouseleave(ev=>{
                _showPassword(false);
            })
        }
        
    }
    async getQR({text, size=128, color="#000000", background="#ffffff"}, container=null, sleep=200){
        $("#qr-temp").remove();
        $("body").append(`<div id='qr-temp' class='d-none'></div>`);
        let qrcode = new QRCode("qr-temp", {
            text: text,
            width: size,
            height: size,
            colorDark : color,
            colorLight : background,
            correctLevel : QRCode.CorrectLevel.H
        });
        let img = $("#qr-temp img");
        img.attr("title", text);
        
        //tarda en dibujarse, por lo q espero y remuevo el display:block
        if(sleep > 0) await this.sleep(sleep);
        img.css("display", "");
        
        if(container) container.html(img);
        return { qrcode, img };
    }
    getBarcode(text, container=null){
        $("#barcode-temp").remove();
        $("body").append(`<img id='barcode-temp' class='d-none'>`);
        $("#barcode-temp").JsBarcode(text, {displayValue: false});
        let img = $("#barcode-temp");
        img.attr("title", text);
        if(container){
            container.html( img );
            container.find("img").removeClass("d-none");
        }
        img.removeAttr("id");
        return img;
    }
    scrollTo(element){
        let $target = null; 
        if(element instanceof jQuery){
            $target = element;
        }else{
            $target = $(element);
        }
        if(!$target.length) return;
        $('html, body').animate({
            scrollTop: $target.offset().top
        }, 500);
    }
    splitAmountByPercentage(mount, percent, returnBase=false){
        let aux = mount / (1 + (percent / 100));
        return this.decimals(returnBase ? aux : mount - aux);
    }
    reverserPercent(mount, percent){
        let base = this.splitAmountByPercentage(mount, percent, true);
        return {base: base, percent: mount - base};
    }
    
    //verify if value is number
    getNumber(v, def=null){
        if(typeof v == "undefined" || v === "" || v === null) return def;
        if(typeof v != "number" && typeof v != "string") return def;
        if(typeof v == "string"){
            let valor = v.trim();
            if(valor === "" || /e/i.test(valor) || /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(valor) == false) return def;
        }
        let num = Number(v);
        return Number.isFinite(num) ? num : def;
    }
    getBoolean(v){
        return (v === "true" || v === true || v === "1" || v === 1);
    }

    setLocalData(key, value){
        if(typeof value == "object") value = JSON.stringify(value);
        key = key + "-" + primordial.emprendimiento.eid + "-" + primordial.usuario.email;
        localStorage.setItem(key, value);
    }
    getLocalData(key){
        key = key + "-" + primordial.emprendimiento.eid + "-" + primordial.usuario.email;
        let value = localStorage.getItem(key);
        return value;
    }
    //dado un elemento y un evento, comprueba si se apretaron la cantidad de veces en el intervalo de tiempo
    checkBarcodeScanner({inputElement, event, interval, taps, callback}={event:"keydown", interval:350, taps:6, callback:null}){
        if(!this.isJquery(inputElement)) inputElement = $(inputElement);

        let timerFromInitKey = true;//eso hace que el timer inicie desde la primera tecla
        
        inputElement.on(event, ev=>{
            let ele = $(ev.currentTarget);
            let v = ev.key.toString();
            let isNumber = /^\d$/.test(v);
            let isLetter = /^[a-zA-Z]$/.test(v);
            let char = String.fromCharCode(ev.which);
            let buffer = ele.data("buffer") || "";

            if(v === "Enter"){
                if(buffer.length >= taps && callback){
                    ele.data("buffer", "");
                    callback(buffer);
                }
            }else if(v.length === 1 && (isNumber || isLetter)){
                buffer += v;
                ele.data("buffer", buffer);
            }

            if(timerFromInitKey == false || (timerFromInitKey == true && buffer.length == 1)){
                if(ele.data("timer")) clearTimeout(ele.data("timer"));
                ele.data("timer", setTimeout(()=>{
                    ele.data("buffer", "");
                }, interval));
            }
        });
    }
    debounce(func, wait, immediate) {
        let timeout;
        return function (...args) {
            const context = this;
            const callNow = immediate && !timeout;

            clearTimeout(timeout);

            timeout = setTimeout(() => {
                timeout = null;
                if (!immediate) {
                    func.apply(context, args);
                }
            }, wait);

            if (callNow) {
                func.apply(context, args);
            }
        };
    }

    sendWhatsapp(telefono, texto){
        const url = `https://api.whatsapp.com/send/?phone=${telefono}&text=${encodeURIComponent(texto)}`;

        $('<a>', {
            href: url,
            target: '_blank',
            rel: 'noopener noreferrer'
        })
        .appendTo('body')
        .get(0)
        .click();
    }
}
