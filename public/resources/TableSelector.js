class TableSelector{
    constructor({tableElement, inputElement=null, callback=null}){
        this.tbody = tableElement instanceof jQuery ? tableElement.find("tbody") : $(tableElement).find("tbody");
        this.iselector = -1;
        this.inputElement = inputElement;
        this.callback = callback;
        if(this.inputElement != null){
            $(this.inputElement).on("keydown", ev=>{
                if(ev.key == "ArrowUp"){
                    ev.preventDefault();
                    this.move("up");
                    if(this.callback) this.callback(this.getSelectedRow(), false);
                }else if(ev.key == "ArrowDown"){
                    ev.preventDefault();
                    this.move("down");
                    if(this.callback) this.callback(this.getSelectedRow(), false);
                }else if(ev.key == "Enter"){
                    ev.preventDefault();
                    if(this.iselector < 0) return;
                    if(this.callback) this.callback(this.getSelectedRow(), true);
                }
            });
        }
    }
    clear(){
        this.iselector = -1;
        this.tbody.find("tr").removeClass("iselector");
    }
    getSelectedRow(){
        if(this.iselector < 0) return null;
        return this.tbody.find("tr:eq(" + this.iselector + ")");
    }
    move(action="up"){//up o down
        if(this.tbody.find("tr").length == 0) return;
        let maxRows = Math.min(this.tbody.find("tr").length, 10) -1;

        if(action == "up"){
            this.iselector--;
            if(this.iselector < 0) this.iselector = maxRows;
        }else if(action == "down"){
            this.iselector++;
            if(this.iselector > maxRows) this.iselector = 0;
        }
        this.tbody.find("tr").removeClass("iselector");
        this.tbody.find("tr:eq(" + this.iselector + ")").addClass("iselector");
    }
}