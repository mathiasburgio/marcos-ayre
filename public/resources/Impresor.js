class Impresor{
    constructor(debug=false){
        this.posPrinter = null;
        this.debug = debug;
        this.model = "";
        this.urlPosPrinter = "http://localhost:9005";
        this.tab = null;

        if(debug) this.showIframe();
    }
    showIframe(){
        $("#impresor").css("width", "90vw").css("height", "50vh").css("margin-top", "30px").removeClass("d-none").addClass("m-auto")
    }
    async pingPosPrinter(){
        try{
            let resp = await $.get({
                url: this.urlPosPrinter + "/ping",
                cache: false,
                processData: false,
                timeout: 1000
            });
            return (resp === "pong");
        }catch(err){
            return false;
        }
    }
    async printPosPrinter(lines){
        try{
            let resp = await $.post({
                url: this.urlPosPrinter + "/print",
                data: JSON.stringify(lines),
                contentType: "application/json; charset=utf-8",
                cache: false,
                processData: false,
                timeout: 1000
            });
            return resp;
        }catch(err){
            return false;
        }
    }
    print({template, prePrint=null, wait = 200}){
        return new Promise(resolve=>{
            //console.log(tx, params);
            $("#impresor").remove();
            $("body").append(`<iframe id="impresor" class="d-none" src="${template}"></iframe>`);
            this.tab = Array.from(window.frames).at(-1);//de esta forma agarro el ultimo iframe cargado (evito errores si utilizo iframes externos. Ej youtube, maps)
            this.tab.addEventListener('load', async ()=>{

                let $doc = $(this.tab.document);
                if(prePrint) await prePrint($doc, this.tab);

                //seteo los fondos
                this.setBackgrounds($doc);
                //manda a imprimir
                setTimeout(()=>{
                    if(window?.electronAPI){
                        if(!electronInterface?.configuracion?.printer?.name) return menu.toast({level: "warning", message: "No ha configurado la impresora"});
                        //template => "/printables/blank.html"
                        window.electronAPI.imprimir({
                            template: template.split("/").pop(),// "blank.html"
                            body: $doc.find("body").html()
                        })
                    }else{
                        this.tab.print()
                    }
                }, wait);
                resolve(true);
            });
        });
    }
    setBackgrounds($doc){
        $doc.find(".bg-light, .bg-light td, .bg-light th").attr("style", "background: #eee !important");
        $doc.find(".bg-danger, .bg-danger td, .bg-danger th").attr("style", "background: #dc3545 !important");
        $doc.find(".bg-info, .bg-info td, .bg-info th").attr("style", "background: #17a2b8 !important");
        $doc.find(".bg-primary, .bg-primary td, .bg-primary th").attr("style", "background: #007bff !important");
        $doc.find(".bg-secondary, .bg-secondary td, .bg-secondary th").attr("style", "background: #6c757d !important");
        $doc.find(".bg-dark, .bg-dark td, .bg-dark th").attr("style", "background: #343a40 !important");
        $doc.find(".bg-warning, .bg-warning td, .bg-warning th").attr("style", "background: #ffc107 !important");
        $doc.find(".thead-dark, .thead-dark th").attr("style", "background: #343a40 !important; color: white !important");
    }
}
