/*
    structure: array of =>
    {
        label: str,
        width: str (50% | 30px),
        prop: str (prop of object),
        fn: function,
        right: bool (def false)
    }
*/
class SimpleCRUD{
    constructor({padre, idProp, structure, searchProps, list, fnSearch, beforeSelect, afterSelect, beforeClear, afterClear, afterSearch, fnDblClick }){
        this.isNew = false;
        this._search = {
            word: "",
            ar: [],
            next: []
        };
        this.padre = padre || document;//sirve para cuando tengo mas de 1 SimpleCrud por pagina
        this.idProp = idProp || "id";//id para mySql, _id para mongo
        this.structure = structure;
        this.list = list;
        this.enabled = undefined;
        this.searchProps = searchProps;
        this.row = undefined;
        this.element = undefined;
        this.afterSelect = afterSelect;
        this.afterClear = afterClear;
        this.beforeSelect = beforeSelect;
        this.beforeClear = beforeClear;
        this.fnSearch = fnSearch;
        this.afterSearch = afterSearch;
        this.fnDblClick = fnDblClick;

    };

    setTable(dom){
        let html =`<table class='table table-sm table-hover' crud='table'>
                        <thead class='thead-dark'>
                            <tr>`;
        this.structure.forEach(item=>{
            let r = (item.right ? "text-align:right;" : "");
            let w = (item.width ? "width:" + item.width + ";" : "");

            html += `<th style="${r + w}">${item.label}</th>`;
        });
        html +=             `</tr>
                        </thead>
                        <tbody></tbody>
                        <tfoot>
                            <tr>
                                <td colspan='${this.structure.length}' class='p-2'>
                                    <button class='btn btn-info btn-block'>Cargar más</button>
                                </td>
                            </tr>
                        </tfoot>
                    </table>`;
        dom.html(html);
        $(this.padre).find("[crud='table'] tfoot button").click(()=>{
            this.showMoreResults();
        });
    }
    inicialize(bd="mysql"){
        this.setButton("");
        this.clearFields();
        this.setEnableFields(false);
        
        if(bd == "mongo" || bd == "mongodb"){
            this.idProp = "_id";
        }else{
            this.idProp = "id";
        }

        if($(this.padre).find("[crud='table'] tfoot button").length == 1){
            $(this.padre).find("[crud='table'] tfoot button").prop("disabled", (this._search.next.length > 0 ? false : true) );
        }
        this.search("");
    }
    clearFields(){
        if(this.beforeClear){ this.beforeClear(); }
        $(this.padre).find("[crud='fields'] [name]").val("");
        if(this.afterClear){ this.afterClear(); }
    }
    getDataToSave(){
        let obj = {};
        $(this.padre).find("[crud='fields'] [name]").each((index,ev)=>{
            let name = $(ev).prop("name");
            let val = $(ev).val();
            
            if($(ev).attr("type") == "number" || $(ev).attr("mask-original-type") == "number") val = Number(val);
            if(val === "true") val = true;
            if(val === "false") val = false;

            if(name){ obj[name] = val; }//omite los que tienen name vacio
        });
        if(this.isNew){
            obj._action = "new";
            obj[this.idProp] = -1;
        }else{
            obj._action = "modify";
            obj[this.idProp] = this.element[this.idProp];
        }
        return obj;
    }
    afterSave(obj){
        if(this.isNew){
            this.list.push(obj);
        }else{
            Object.assign(this.element, obj);
        }
        this.row = undefined;
        this.element = undefined;
        this.isNew = undefined;
        this.search("");
    }
    onNew(){
        this.setEnableFields(true);
        this.setButton("new");
        this.clearFields();
        $(this.padre).find("[crud='fields'] [name]:eq(0)").focus();
        $(this.padre).find("[crud='table'] .table-info").removeClass("table-info");
        this.isNew = true;
        this.row = undefined;
        this.element = undefined;
    }
    onModify(focus=true){
        this.setEnableFields(true);
        this.setButton("modify");
        if(focus === true) $(this.padre).find("[crud='fields'] [name]:eq(0)").focus();
        if(focus instanceof jQuery) focus.focus();
        this.isNew = false;
    }
    setEnableFields(e){
        this.enabled = e;
        $(this.padre).find("[crud='fields'] [name]").prop("disabled", !e);
    }
    setButton(btn){
        $(this.padre).find("[crud='btNew']").removeClass("btn-primary").addClass("btn-light");
        $(this.padre).find("[crud='btModify']").removeClass("btn-primary").addClass("btn-light");
        
        if(btn == "new"){
            $(this.padre).find("[crud='btNew']").addClass("btn-primary").removeClass("btn-light");
        }else if(btn == "modify"){
            $(this.padre).find("[crud='btModify']").addClass("btn-primary").removeClass("btn-light");
        }
    }
    search(word){
        if(typeof word == "undefined") word = "";
        word = word.toLowerCase();
        
        let ar = [];
        if(this.fnSearch){
            ar = this.fnSearch(word, this.list);    
            ar = JSON.parse(JSON.stringify(ar));
        }else{
            this.list.forEach(item=>{
                for(let i = 0; i < this.searchProps.length; i++){
                    if( item[this.searchProps[i]].toString().toLowerCase().indexOf(word) > -1){
                        i = this.searchProps.length;
                        ar.push(item);
                    }
                }
            });
        }
        
        this._search = {
            word: word,
            ar: [],
            next: ar
        };

        //remove the first 100
        this._search.ar = this._search.next.splice(0,100);

        this.isNew = undefined;
        this.row = undefined;
        this.element = undefined;
        this.setEnableFields(false);
        this.clearFields();
        this.setButton();

        this.showSearch();
        return this._search.ar;
    }
    showSearch(){
        let html = "";
        this._search.ar.forEach(item=>{
            html += this.templateRow(item);
        });
        $(this.padre).find("[crud='table'] tbody").html(html);

        if($(this.padre).find("[crud='table'] tfoot button").length == 1){
            $(this.padre).find("[crud='table'] tfoot button").prop("disabled", (this._search.next.length > 0 ? false : true) );
        }

        $(this.padre).find("[crud='table'] tbody tr").click((ev)=>{
            let element = this.getElement( $(ev.currentTarget).attr("idd") );

            if(this.beforeSelect){
                this.beforeSelect(element).then(ret=>{
                    this.onClickElement(ev);
                });
            }else{
                this.onClickElement(ev);
            }
        });
        $(this.padre).find("[crud='table'] tbody tr").dblclick((ev)=>{
            let element = this.getElement( $(ev.currentTarget).attr("idd") );
            if(this.fnDblClick){ this.fnDblClick(element); }
        });
        
        if(this.afterSearch){ this.afterSearch(); }
    }
    onClickElement(ev){
        let dom = ev?.currentTarget ? $(ev.currentTarget) : ev; //ev => event o jQuery
        let idd = dom.attr("idd");
        let element = this.getElement( idd );
        this.element = element;
        this.row = dom;
        this.isNew = undefined;
        $(this.padre).find("[crud='table'] .table-info").removeClass("table-info");
        dom.addClass("table-info");
        this.clearFields();
        this.setEnableFields(false);
        this.setButton();

        let fx = null;
        if(typeof Fechas  == "function"){ fx = new Fechas(); }

        for(let prop in element){
            let dx = $("[crud='fields'] [name='" + prop + "']");
            let val = element[prop];

            if(dx.length == 1){
                if(dx.attr("type") == "date"){
                    if(val && fx && typeof fx.toInputDate == "function"){
                        dx.val(fechas.toInputDate(val));
                    }
                }else if(dx.attr("type") == "datetime-local"){
                    if(val && fx && typeof fx.toInputDatetime == "function"){
                        dx.val(fechas.toInputDatetime(val));
                    }
                }else{
                    dx.val(val);
                    if(dx.find("[value='1']").length == 1 && (val == 1 || val == true)) dx.val("1");
                    if(dx.find("[value='0']").length == 1 && (val == 0 || val == false)) dx.val("0");

                    if(dx.find("[value='true']").length == 1 && (val == 1 || val == true)) dx.val("true");
                    if(dx.find("[value='false']").length == 1 && (val == 0 || val == false)) dx.val("false");
                }
            }
            
        }

        if(this.afterSelect){ this.afterSelect(this.element); }
    }
    templateRow(obj){
        let html = `<tr idd="${obj[this.idProp]}" style='cursor:pointer;'>`;
        this.structure.forEach(item=>{
            let r = (item.right ? "text-align:right;" : "");
            let w = (item.width ? "width:" + item.width + ";" : "");

            if(item.fn){
                html += `<td style='${r + w}'>${item.fn(obj[item.prop], obj)}</td>`;
            }else{
                html += `<td style='${r + w}'>${obj[item.prop]}</td>`;
            }
        });
        return html += "</tr>";
    }
    showMoreResults(){
        this._search.ar = this._search.ar.concat( this._search.next.splice(0,100) );
        this.showSearch();
    }
    getElement(id, index = false){
        let i = this.list.findIndex(item=>item[this.idProp] === id);
        return (index ? i : this.list[i]);
    }
    removeSelected(){
        let aux = this.getElement(this.element[this.idProp], true);
        this.list.splice(aux,1);
        this.search("");
    }
    updateTableRow(){
        let html = this.templateRow(this.element);
        if(this.row) this.row.html($(html)[0].innerHTML);
    }
}
