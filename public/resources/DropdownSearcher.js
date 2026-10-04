class DropdownSearcher{
    constructor({input, button, items=[], propId="", propLabel="", fnSearch=null, keyupEnter=null, cb=null}){
        this.indexUpDown = 0;//el primer "li" es del searcherInput
        this.lastValue = null;
        this.enabled = false;
        this.searcherId = new Date().getTime();
        this.button = button;
        this.input = input;
        this.searcherInput = null;//el input search. Se crea en la siguiente linea
        this.keyupEnter = keyupEnter;
        this.items = items;
        this.propId = propId;
        this.propLabel = propLabel;
        this.fnSearch = fnSearch;
        let fox = `<ul class="list-group w-100 border border-primary d-none" searcher="${this.searcherId}" style="position:absolute; top:30px; z-index:10;">
                    <li class="list-group-item">
                        <input type="search" class="form-control form-control-sm" placeholder="Buscar...">
                    </li>
                    <li class="list-group-item list-group-item-action p-1 cp d-none text-dark">Item 1</li>
                    <li class="list-group-item list-group-item-action p-1 cp d-none text-dark">Item 2</li>
                    <li class="list-group-item list-group-item-action p-1 cp d-none text-dark">Item 3</li>
                    <li class="list-group-item list-group-item-action p-1 cp d-none text-dark">Item 4</li>
                    <li class="list-group-item list-group-item-action p-1 cp d-none text-dark">Item 5</li>
                </ul>`;
        input.parent().append(fox);

        input.parent().find("li").click(ev=>{
            let idd = $(ev.currentTarget).attr("idd");
            console.log(idd);
            if(!idd) return; 
            let px = items.find(p=>p[propId] == idd);
            this.lastValue = px;
            if(cb) cb(px);
        });

        this.searcherInput = input.parent().find("[searcher='" + this.searcherId + "'] input");
        
       

        this.searcherInput
        .blur(ev=>{
            setTimeout(()=>{ 
                if(this.enabled) this.close();
            }, 200);
        })
        .keyup(ev=>{
            let v = $(ev.currentTarget).val().toString().toLowerCase();

            //si son las teclas especiales omito el resto
            if(ev.keyCode == 40 || ev.keyCode == 38 || ev.keyCode == 13){
                if(ev.keyCode == 13 && this.keyupEnter) this.keyupEnter(v);
                return;
            }
            
            this.filtrar(v);
        })
        .keydown(ev=>{
            if(ev.keyCode == 40){//DOWN
                this.indexUpDown++;
                if(this.indexUpDown > (input.parent().find("[searcher='" + this.searcherId + "'] li").length - 1)) this.indexUpDown = 1;
                input.parent().find("[searcher='" + this.searcherId + "'] li").removeClass("bg-info");
                input.parent().find("[searcher='" + this.searcherId + "'] li:eq(" + this.indexUpDown + ")").addClass("bg-info");
                ev.preventDefault();
                return;
            };
            if(ev.keyCode == 38){//UP
                this.indexUpDown--;
                if(this.indexUpDown <= 0) this.indexUpDown = input.parent().find("[searcher='" + this.searcherId + "'] li").length - 1;//cantidad de items mostrados sin tener en cuenta el 1ro y con base 0
                input.parent().find("[searcher='" + this.searcherId + "'] li").removeClass("bg-info");
                input.parent().find("[searcher='" + this.searcherId + "'] li:eq(" + this.indexUpDown + ")").addClass("bg-info");
                ev.preventDefault();
                return;
            };
            if(ev.keyCode == 13){//ENTER
                if(this.indexUpDown > 0){ 
                    input.parent().find("[searcher='" + this.searcherId + "'] li:eq(" + this.indexUpDown + ")").click();
                    this.close();
                }
                ev.preventDefault();
                return;
            };
            if(ev.keyCode == 27){//ESC
                ev.preventDefault();
                ev.stopPropagation();
                this.close();
                return;
            }
        })

        //muestra/oculta el buscador
        if(this.button){
            button.click(ev=>{
                this.enabled = !this.enabled;
                if(this.enabled){
                    this.open();
                }else{
                    this.close();
                }
            })
        }
    }
    open(){
        this.indexUpDown = 0;
        this.lastValue = null;
        if(this.button) this.button.addClass("btn-primary").removeClass("btn-secondary");
        this.input.parent().find("[searcher]").removeClass("d-none");
        this.input.parent().find("li").addClass("d-none");//oculto opciones
        this.input.parent().find("li:eq(0)").removeClass("d-none");//muestro buscador
        this.searcherInput.val("");
        this.searcherInput.focus();
        this.enabled = true;
        this.filtrar("");
    }
    close(){
        if(this.button) this.button.removeClass("btn-primary").addClass("btn-secondary");
        this.input.parent().find("[searcher]").addClass("d-none");
        this.enabled = false;
    }
    filtrar(palabra){

        //limpio el seleccionador por up/down
        this.indexUpDown = 0;
        this.input.parent().find("[searcher='" + this.searcherId + "'] li").removeClass("bg-info");

        let filtrados = [];
        if(typeof this.fnSearch == "function"){
            filtrados = this.fnSearch(this.items, palabra);
        }else{
            filtrados = this.items.filter((px, index)=>{
                if(typeof this.propLabel == "function"){
                    return this.propLabel(px, index).toString().toLowerCase().indexOf(palabra) > -1;
                }else{
                    return px[this.propLabel].toString().toLowerCase().indexOf(palabra) > -1;
                }
            });
        }
        this.input.parent().find("[searcher='" + this.searcherId + "'] li").addClass("d-none");//oculto las opciones
        filtrados.forEach((item, index)=>{
            if(index < 10){//limito la cantidad de resultados
                let li = this.input.parent().find("[searcher='" + this.searcherId + "'] li:eq(" +  (index + 1) + ")");
                if(li.length){//limito por 2da vez los resultados
                    if(typeof this.propLabel == "function"){
                        li.html(this.propLabel(item, index));
                    }else{
                        li.html(item[this.propLabel]);
                    }
                    li.attr("idd", item[this.propId]);
                    li.removeClass("d-none");
                }
            }
        })
        this.input.parent().find("[searcher='" + this.searcherId + "'] li:eq(0)").removeClass("d-none");//muestro el buscador
    }
}