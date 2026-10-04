class Modal{
    constructor({id="modal", lang="es", fade=true}={id:"modal"}){
        this.id = id;
        this.lang = lang;
        this.fade = fade;
        this.element = null;
        this.onShow = null;
        this.onShown = null;
        this.onHide = null;//hide.bs.modal
        this.onHidden = null;//hidden.bs.modal
        this.cbHide = null;
        this.promiseUntilClose = null; //para cuando llamo a hide y quiero esperar a que se cierre

        if($("#" + id).length == 1) $("#" + id).remove();
        $("body").append(`
                    <div id="${id}" data-backdrop="static" class="modal ${this.fade ? "fade" : ""}" tabindex="-1" role="dialog">
                        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Modal title</h5>
                                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                    </button>
                                </div>
                                <div class="modal-body">
                                </div>   
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                                    <button type="button" class="btn btn-primary">Save changes</button>
                                </div>
                            </div>
                        </div>
                    </div>`);
        this.element = $(`#${id}`);

        this.element.on('show.bs.modal', (e)=>{
            if(this.onShow) this.onShow();
        });
        this.element.on('shown.bs.modal', (e)=>{
            if(this.onShown) this.onShown();
        });
        this.element.on('hide.bs.modal', (e)=>{
            if(this.onHide) this.onHide();
        });
        this.element.on('hidden.bs.modal', (e)=>{
            if(this.onHidden) this.onHidden();
            if(this.cbHide) this.cbHide();
            if(this.promiseUntilClose) this.promiseUntilClose();//es una promesa de modal.hide()
        });
    }
    message(text){
        return new Promise(resolve=>{
            this.show({
                title: "...",
                body: text,
                buttons: [{color: "primary", text: (this.lang == "es" ? "Aceptar" : "Accept"), name: "accept"}],
                onShow: () =>{
                    this.element.find(".modal-footer button").css("width", "100px");
                },
                onShown: ()=>{
                    this.element.find(".modal-footer button").focus();
                    this.element.find(".modal-footer button").click(ev=> this.hide() );
                },
                onHidden: ()=>{
                    resolve();
                }
            });
        })
    }
    waiting(text, waitingFunction = null){
        return new Promise(resolve=>{
            this.show({
                body: ` ${text}
                        <div class="d-flex justify-content-center">
                            <div class="spinner-border text-primary" role="status">
                                <span class="sr-only">Loading...</span>
                            </div>
                        </div>`,
                onShown: async ()=>{
                    if(waitingFunction){
                        await waitingFunction();
                        this.hide();
                    }else{
                        resolve();
                    }
                    //if(!waitingFunction) throw "modal.waiting(..., waitingFunctions) waitingFunctions is undefined";
                },
                onHidden: ()=>{
                    resolve();
                }
            })
        })
    }
    waiting2(status, text){
        $("#modal .modal-content .modal-waiting").remove();
        
        if(status){
            document.activeElement.blur();
            let fox = `<div class="modal-waiting">
                            <div class='loader text-center my-2'>
                                <span class="my-3">${text}</span>
                                <br>
                                <div class="spinner-grow text-primary" role="status">
                                    <span class="sr-only">Loading...</span>
                                </div>
                            </div>
                        </div>`;
            $("#modal .modal-content").append(fox);
            $("#modal .modal-content .modal-waiting")
            .css("position", "absolute")
            .css("top", "0")
            .css("left", "0")
            .css("width", "100%")
            .css("height", "100%")
            .css("background", "rgba(20,20,20,0.75)")
            .css("z-index", "20")
            .css("padding-top", "20px")
            .css("color", "white");
        }
    }
    yesno(text, focusOn="yes"){
        return new Promise((resolve, reject)=>{
            let resp = null;
            this.show({
                title: (this.lang == "es" ? "Pregunta" : "Ask"),
                body: text,
                buttons: [
                    {color: "secondary", text: (this.lang == "es" ? "No": "No"), name:"no"},
                    {color: "primary", text: (this.lang == "es" ? "Si": "Yes"), name:"yes"},
                ],
                onShow: () =>{
                    this.element.find(".modal-footer button").css("width", "100px")
                    this.element.find("button[name='yes']").on("click", ev=>{
                        resp = true;
                        this.hide();
                    });
                    this.element.find("button[name='no']").on("click", ev=>{
                        resp = false;
                        this.hide();
                    });
                },
                onShown: () =>{
                    this.element.find(`button[name='${focusOn}']`).focus();  
                },
                onHidden: () =>{
                    resolve(resp);
                }
            });
        });
    }
    prompt({label, value="", type="text", small="", onKeydownCallback=null, onKeyupCallback=null}){
        return new Promise((resolve, reject)=>{
            let resp = null;
            let fox = `<div class='form-group'>
                <label>${label}</label>
                <input class='form-control' type='${type}' value="${value !== null ? value : ""}">
                <small class='text-muted'>${small}</small>
            </div>`;

            this.show({
                body: fox,
                buttons: [
                    {color: "secondary", text: (this.lang == "es" ? "Cancelar" : "Cancel"), name:"cancel"},
                    {color: "primary", text: (this.lang == "es" ? "Aceptar" : "Accept"), name:"accept"},
                ],
                onHidden: () =>{
                    resolve(resp);
                },
                onShown: () =>{
                    $("#modal input").focus().select();
                }
            })

            $("#modal [name='cancel']").on("click", ev=> this.hide());
            $("#modal [name='accept']").on("click", ev=> {
                resp = $("#modal input").val();
                this.hide();
            });

            $("#modal input").keydown(ev=>{
                let v = $("#modal input").val();
                if(onKeydownCallback) onKeydownCallback(ev, v);
            }).keyup(ev=>{
                let v = $("#modal input").val();
                if(onKeyupCallback) onKeyupCallback(ev, v);
                if(ev.keyCode == 13){
                    resp = v;
                    this.hide();
                }
            });
            $("#modal input").focus();
        });
    }
    promptSelect({title="", ar=[], textProp="", rowTemplate=null, filter=false, filterFn=null, itemsToShow=10, showIndex= false}){
        return new Promise((resolve, reject)=>{
            let resp = null;
            
            let isString = typeof ar[0] == "string"; //si es un array de strings

            let body = `
            <input type='search' autocomplete="off" class='form-control d-none' placeholder='${this.lang == "es" ? "Buscar..." : "Search..."}'>
            <div class="list-group mt-2"></div>`;
            this.show({
                title: title,
                body: body,
                buttons: "back",
                onHidden: () =>{
                    $("body").off(".promptSelect");
                    resolve(resp);
                }
            });
            if(filter) $("#modal input").removeClass("d-none").focus();
            
            
            let filteredItems = [...ar];//clona el array original, evita que se modifique el original
            const showSearch = () => {
                let listBody = "";
                let cc = itemsToShow || 10;
                filteredItems.forEach((item, index)=>{
                    cc--;
                    if(cc < 0) return;
                    if(rowTemplate){
                        listBody += rowTemplate(item, index);
                    }else{
                        listBody += `<button ind="${index}" type="button" class="list-group-item list-group-item-action">${showIndex ? "<strong>" + (index + 1) + "</strong> " : ""}${ isString ? item : item[textProp]}</button>`;
                    }
                });

                if(filter){
                    listBody += `<span class="list-group-item list-group-item-secondary text-center">${filteredItems.length} ${this.lang == "es" ? "items encontrados" : " items found"}</span>`;
                }

                let listElement = $("#modal .list-group");
                listElement.html(listBody);

                listElement.find("button").on("click", ev=>{
                    let ind = $(ev.currentTarget).attr("ind");
                    resp = filteredItems[Number(ind)];
                    this.hide();
                });
            }

            //setup filter default filter function
            if(!filterFn){
                filterFn = (item, v) =>{
                    if(isString){
                        return item.toLowerCase().includes(v);
                    }else{
                        return item[textProp].toLowerCase().includes(v);
                    }
                }
            }
    
            $("#modal input").on("keyup", ev=>{
                $("#modal .list-group button").addClass("d-none");
                let v = $("#modal input").val().toLowerCase().trim();
                if(v == ""){
                    filteredItems = [...ar];//clona el array original, evita que se modifique el original
                    showSearch();
                }else{
                    filteredItems = ar.filter((item, index)=> filterFn(item, v) );
                    showSearch();
                }
            });

            if(showIndex){
                // La tecla usada para seleccionar la variación no debe llegar al
                // input que recupera el foco cuando el modal se cierra.
                $("body").on("keydown.promptSelect", ev=>{
                    let v = Number(ev.key);
                    if(!Number.isInteger(v) || v < 1 || v > 9) return;

                    ev.preventDefault();
                    ev.stopPropagation();
                    ev.stopImmediatePropagation();

                    let ele = $("#modal [ind='" + (v - 1) + "']");
                    if(ele.length) ele.click();
                });
                $("body").on("keyup.promptSelect", ev=>{
                    let v = Number(ev.key);
                    if(!Number.isInteger(v) || v < 1 || v > 9) return;
                    ev.preventDefault();
                    ev.stopPropagation();
                    ev.stopImmediatePropagation();
                });
            }

            showSearch();
        });
    }
    addPopover({querySelector, type="message", message="", label="myLabel", inputType="text", value=""}){
        if( $("#modal").hasClass("show") == false ) throw "Modal is already close";
        if( $("#modal #popover-backdrop").length == 1 ) throw "Popover is already open";
        return new Promise(resolve=>{
            type = type.toLowerCase()
            this.element.find("#popover-backdrop").remove();
            this.element.find(".modal-content").append(`<div style='position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.2); z-index: 10;' id='popover-backdrop'></div>`)
            let popRootElement = querySelector instanceof jQuery ? querySelector : $(querySelector).first();
            popRootElement.popover("dispose")

            let resp = null;
            
            popRootElement.popover({
                animation: true,
                container: "#modal .modal-body",
                html: true,
                placement: "auto",
                trigger: "manual",
                content: "..."
            })
            popRootElement.popover("show");
            popRootElement.css("position", "relative").css("z-index", 20);

            let html = "";
            if(type == "message"){
                html = `
                <div>
                    <p>${message}</p>
                    <div class='text-right'>
                        <button class='btn btn-sm btn-primary' name='popover-accept' tabindex="1">${this.lang == "es" ? "Aceptar" : "Accept"}</button>
                    </div>
                </div>`;
                
            }else if(type=="yesno" || type == "noyes"){
                html = `
                <div>
                    <p>${message}</p>
                    <div class='text-right'>
                        <button class='btn btn-sm btn-danger' name='popover-no' style="width:50px">${this.lang == "es" ? "No" : "No"}</button>
                        <button class='btn btn-sm btn-primary ml-2' name='popover-yes' style="width:50px">${this.lang == "es" ? "Si" : "Yes"}</button>
                    </div>
                </div>`;
            }else if(type=="input"){
                html = `<div class='form-group'>
                    <label>${label}</label>
                    <input type='${inputType}' class='form-control' value="${value}">
                </div>
                <div class='text-right'>
                    <button class='btn btn-sm btn-danger' name='popover-cancel' style="width:100px">${this.lang == "es" ? "Cancelar" : "Cancel"}</button>
                    <button class='btn btn-sm btn-primary ml-2' name='popover-accept' style="width:100px">${this.lang == "es" ? "Aceptar" : "Accept"}</button>
                </div>`;
            }
            this.element.find(".popover-body").html(html);

            this.element.find(".popover input, .popover button").keyup(ev=>{
                let jq = $(ev.currentTarget);
                if(ev.keyCode == 13){//enter
                    resp = this.element.find(".popover input").val();
                    if(jq.attr("name") == "popover-yes") resp = true
                    if(jq.attr("name") == "popover-no") resp = false
                    popRootElement.popover("hide");
                }else if(ev.keyCode == 27){//escape
                    ev.preventDefault();
                    ev.stopPropagation();
                    popRootElement.popover("hide");
                    return false;
                }
            }).keydown(ev=>{
                if(ev.keyCode == 27){
                    ev.preventDefault();
                    ev.stopPropagation();
                    popRootElement.popover("hide");
                    return false;
                }
            });

            this.element.find(".popover [name='popover-accept']").on("click", ev=>{
                resp = this.element.find(".popover input").val();
                popRootElement.popover("hide");
            });
            
            this.element.find(".popover [name='popover-no']").on("click", ev=>{
                resp = false;
                popRootElement.popover("hide");
            });
            this.element.find(".popover [name='popover-yes']").on("click", ev=>{
                resp = true;
                popRootElement.popover("hide");
            });
    
            this.element.find(".popover [name='popover-cancel']").click(ev=>{
                resp = null;
                popRootElement.popover("hide");
            });

            popRootElement.on('hidden.bs.popover', ()=> {
                this.element.find("#popover-backdrop").remove();
                resolve(resp);
            });
            popRootElement.on('shown.bs.popover', ()=> {
                if(type == "message") this.element.find(".popover-body [name='popover-accept']").focus().select();
                if(type == "yesno") this.element.find(".popover-body [name='popover-yes']").focus().select();
                if(type == "input") this.element.find(".popover-body input").focus().select();
            });
        })
    }
    show({title, body, size, buttons, onShow, onShown, onHide, onHidden}){

        if( $("#modal").hasClass("show") ) throw "Modal is already open";
        if(this.promiseUntilClose){
            console.error("Algo no anda como deberia");
        }
        this.waiting2(false, "");//fuerzo el cerrar estado de waiting2
        $(".popover").removeClass("show")//fuerzo el cerrar estado de popover
        $(".tooltip").removeClass("show")//fuerzo el cerrar estado de tooltip

        if(!title){
            this.element.find(".modal-header").addClass("d-none");
        }else{
            this.element.find(".modal-header").removeClass("d-none");
            this.element.find(".modal-title").html(title);
        }

        this.element.find(".modal-body").html(body);

        this.element.find(`.modal-dialog`).removeClass("modal-sm").removeClass("modal-lg").removeClass("modal-xl")
        .css("min-width", "auto");//Este ultimo para eliminar modal-70, modal-80, modal-90
        if(size) this.element.find(`.modal-dialog`).addClass("modal-" + size);

        if(size=="70") this.element.find(`.modal-dialog`).css("min-width", "70vw");
        if(size=="80") this.element.find(`.modal-dialog`).css("min-width", "80vw");
        if(size=="90") this.element.find(`.modal-dialog`).css("min-width", "90vw");

        this.element.css("z-index", 1050);

        if(!buttons){
            this.element.find(".modal-footer").addClass("d-none");
        }else{
            this.element.find(".modal-footer").removeClass("d-none");

            if(typeof buttons == "string" && ["close", "back", "dismiss"].includes(buttons)) buttons = [{color: "secondary", text: (this.lang == "es" ? "Cerrar" : "Close"), name: "dismiss"}];
            if(typeof buttons == "string" && ["accept"].includes(buttons)) buttons = [{color: "primary", text: (this.lang == "es" ? "Aceptar" : "Accept"), name: "dismiss"}];

            let htmlButtons = "";
            if(Array.isArray(buttons) == false && typeof buttons == "object") buttons = [buttons];
            for(let btn of buttons){
                htmlButtons += this.buttons({color: btn.color, text: btn.text, name: btn.name || null});
            }
            this.element.find(".modal-footer").html(htmlButtons);
        }

        this.onShow = onShow || null;
        this.onShown = onShown || null;
        this.onHide = onHide || null;
        this.onHidden = onHidden || null;
        this.cbHide = null;
        
        this.element.modal("show");

        //si de nombre se llama dismiss cierra el modal
        this.element.find(".modal-footer [name='dismiss']").on("click", ev=>{
            this.element.modal("hide");
        })

    }
    hide( promiseUntilClose=null, cb = null ){
        return new Promise(resolve=>{
            if(promiseUntilClose) this.promiseUntilClose = resolve;
            if(cb) this.cbHide = cb;
            this.element.modal("hide");
        })
    }
    close( promiseUntilClose=null, cb = null ){
        return this.hide( promiseUntilClose, cb );
    }
    buttons({color, text, name}){
        return `<button type="button" name="${name}" class="btn btn-flat btn-${color} ml-2">${text}</button>`;
    }
    setAnimation(status=true){
        if(status){
            this.element.addClass("fade");
        }else{
            this.element.removeClass("fade");
        }
    }
}

//VERSION: 28-05-2025
//agregado prompSelect con showIndex y que se pueda seleccionar con 1-9
