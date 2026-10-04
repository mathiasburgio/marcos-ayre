/**
 * how to use
 * let imagine = new Imagine({
 *  parentElement: $("#image-selector"),
 *  defaultImage: "/public/images/no-image.jpg",
 *  callback: (ret) => {
 *      //ret = {inputFile, posProcessing}
 *      let imagePath = uploadFunction(ret.posProcessing);
 *      imagine.setImagePath(imagePath)
 *  }
 * })
 */
class Imagine{
    constructor({container=null, maxWidth=900, maxHeight=900, defaultImage="", resizeOnSelect=true, callback=null}){
        this.value = "";
        this.data = {
            inputFile: null,
            posProcessing: null
        };
        this._container = null;
        this.maxWidth = maxWidth;
        this.maxHeight = maxHeight;
        this.defaultImage = defaultImage;
        this.resizeOnSelect = resizeOnSelect;
        this.callback = callback || null;

        if(!this.callback) throw "Imagine error -> no callback asigned";

        if(typeof container == "string") this._container = $(container);
        if(container instanceof jQuery) this._container = container;
        if(container instanceof Element) this._container = $(container);

        let html = `<div class="border" style="width:120px; height:120px; position:relative; overflow:hidden">
                        <input type="file" accept="image/jpeg,image/png" style="position:absolute; top: -100px;">
                        <div class="row text-center cp pt-1 px-1">
                            <div class="col">
                                <button class="btn btn-primary btn-sm btn-block" name="select-image">📸</button>
                            </div>
                            <div class="col">
                                <button class="btn btn-danger btn-sm btn-block" name="remove-image">✖</button>
                            </div>
                        </div>
                        <div class="text-center p-2" style="width:120px; height: calc(120px - 31px);">
                            <img style="max-width:100%; max-height:100%">
                        </div>
                    </div>`;

        this._container.html(html);

        this._container.find("[name='select-image']").on("click", ev =>{
            this._container.find("input").click();
        });

        this._container.find("[name='remove-image']").on("click", ev =>{
            this.value = "";
            this.clearValue();
        });

        this._container.find("[type='file']").change(ev=>{
            let inp = $(ev.currentTarget);
            let file = inp[0]?.files[0];
            if(!file) return;
            if(["image/jpeg", "image/jpg", "image/png"].includes(file.type) == false){
                inp.val("");
                if(typeof menu !== "undefined") menu.toast({level: "warning", title: "Imagen", message: "Formato no válido. Solo se permiten imágenes JPG o PNG"});
                return;
            }
        
            this.data.inputFile = file;

            var reader = new FileReader();
            reader.onload = async (e)=> {
                this._container.find("img").attr("src", e.target.result);
                
                if(this.resizeOnSelect){
                    let resp = await this.resize({val: file});
                    this.data.posProcessing = resp; 
                    callback(this.data , this);
                }else{
                    this.data.posProcessing = e.target.result; 
                    callback( this.data , this );
                }
            }
            reader.readAsDataURL(file);
        })

        if(this.defaultImage) this.clearValue();
    }
    setImagePath(imagePath){
        this._container.find("img").prop("src", imagePath);
    }
    getImagePath(justName=false){
        let aux = this._container.find("img").prop("src");
        return justName ? aux.split("/").at(-1) : aux;
    }
    getFile(){

    }
    clearValue(){
        this.setImagePath(this.defaultImage);
    }
    setEnabled(e){
        this._container.find("[name='select-image']").prop("disabled", !e);
        this._container.find("[name='remove-image']").prop("disabled", !e);
    }
    resize({val, maxWidth=null, maxHeight=null, maxSize= null, debug = false, retType=null}){
        if(!maxWidth || maxWidth == null) maxWidth = this.maxWidth;
        if(!maxHeight || maxHeight == null) maxHeight = this.maxHeight;
        if(!maxSize || maxSize == null) maxSize = this.maxSize;

        return new Promise(async (resolve, reject)=>{
            try{
                let _file = null;
                let _base64 = null;
                let _input = null;
                let _type = null;
                let _ext = null;
                let _presize = -1;
                if(typeof val === "string"){//es base64
                    _file = this.base64ToFile(val);
                    _base64 = val;
                    _input = "base64";
                }else{
                    _file = val;
                    _base64 = await this.fileToBase64(val);
                    _input = "file";
                }
                _type = _file.type;
                _ext = _type.substring( _type.lastIndexOf("/") + 1);
                _presize = _file.size;

                if(_file.size > maxSize) throw `El archivo pesa más de ${maxSize}mb.`;

                let canvas = document.createElement("canvas");
                let ctx = canvas.getContext('2d');

                let img = new Image();
                img.onload = () => {
                    if(img.width > maxWidth){
                        let aux = img.height * maxWidth / img.width;
                        canvas.height = aux;
                        canvas.width = maxWidth;
                        ctx.drawImage(img, 0, 0, maxWidth, aux);
                    }else if(img.height > maxHeight){
                        let aux = img.width * maxHeight / img.height;
                        canvas.height = maxHeight;
                        canvas.width = aux;
                        ctx.drawImage(img, 0, 0, aux, maxHeight);
                    }else{
                        canvas.height = img.height;
                        canvas.width = img.width;
                        ctx.drawImage(img, 0, 0, img.width, img.height);
                    }

                    let retBase64 = ctx.canvas.toDataURL(_type);
                    let retFile = this.base64ToFile(retBase64, _file.name);
                    
                    if(debug){
                        console.log({
                            _file,
                            _base64,
                            _input,
                            _type,
                            _ext,
                            _presize,
                            _possize: retFile.size,
                            retBase64, 
                            retFile, 
                        })
                    }

                    if(retType == "file"){
                        resolve( retFile );
                    }else if(retType == "base64"){
                        resolve( retBase64 );
                    }else{
                        if(_input == "file"){
                            resolve( retFile );
                        }else{
                            resolve( retBase64 );
                        }
                    }
                }
                img.src = _base64;
            }catch(err){
                reject(err);
            }
        });
    }
    base64ToFile(base64, name){
        try{
            let ext = base64.split(";")[0].split("/").at(-1);
            let arr = base64.split(','), mime = arr[0].match(/:(.*?);/)[1],
                bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
            while(n--){
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new File([u8arr], name ? name : "image." + ext, {type:mime});
        }catch(err){
            console.error(err);
        }
    }
    fileToBase64(file){
        return new Promise(resolve=>{
            let reader = new FileReader();
            
            reader.onload = function () {
                resolve(reader.result);
            };

            reader.onerror = function (error) {
                console.log('Error: ', error);
                resolve(undefined);
            };
            
            reader.readAsDataURL(file);
        });
    }
    URItoDataURL(src){
        return new Promise((resolve)=>{
			let img = new Image();
			img.onload = () =>{
				let canvas = document.createElement('canvas');
				let ctx = canvas.getContext('2d');
				canvas.width = img.width;
				canvas.height = img.height;
				ctx.drawImage(img, 0, 0);
				resolve(canvas.toDataURL(), img.width, img.height);
			}
			img.src = src;
		});
    }
}
