class Menu{
    constructor(){

        this.animations = (localStorage.getItem("animations") === "true");
        this.setAnimations(this.animations);

        this.THEAD_MODES = ["normal", "sticky", "dynamic"];
        this.sounds = (localStorage.getItem("sounds") === null || localStorage.getItem("sounds") === "true");
        this.setSounds(this.sounds);
        
        this.darkMode = (localStorage.getItem("darkMode") === "true");
        this.setDarkMode(this.darkMode);
        $("#toggle-dark-mode").click(ev=>{
            this.setDarkMode()
            this.toast({level: "info", title: `Modo oscuro`, message: this.darkMode ? "Modo OSCURO activado" : "Modo CLARO activado", time:4000})
        });

        this.upperCase = (localStorage.getItem("upperCase") === "true");
        this.setUpperCase(this.upperCase);

        this.theadMode = Number(localStorage.getItem("theadMode")) || 0;
        this.setTheadMode(this.theadMode);

        this.modalCentered = localStorage.getItem("modalCentered") !== "false";
        modal.element.find(".modal-dialog").toggleClass("modal-dialog-centered", this.modalCentered);

        $("#btn-preferencias").on("click", ()=>this.modalPreferencias());

        this.maskNumbers = localStorage.getItem("maskNumbers") === "true";
        this.setMaskNumbers(this.maskNumbers);
        $("#toggle-mask-input-numbers").click(ev=>{
            this.setMaskNumbers()
            this.toast({level: "info", title: `Separador de miles`, message: this.maskNumbers ? "Separador de miles en campos editables activado" : "Separador de miles en campos editables desactivado", time:4000})
        });

        $('.main-header [data-toggle="tooltip"]').tooltip();

        let menuSelectedItem = $("[href='" + window.location.pathname + "']");
        if(menuSelectedItem.length == 1) menuSelectedItem.addClass("active");

        $(".nav-logout").click(async ev=>{
            ev.preventDefault();
            let resp = await modal.yesno(`¿Confirma <b>cerrar sesión</b>?`);
            if(!resp) return;
            window.location.href = "/usuarios/logout";
        })
    }
    abrirEnNuevaVentana(url){
        let enlace = $("<a>", {
            href: url,
            target: "_blank",
            rel: "noopener noreferrer"
        }).appendTo("body");
        enlace.get(0).click();
        enlace.remove();
    }
    setPageName(title, name=null){
        document.title = title;
        $("#pageName").html(name || title);
    }
    hideCortina(){
        $("body, .content-wrapper").scrollTop(0);

        $("#cortina").animate({
            opacity: 0
        },"fast", ()=>{
            $("body, .content-wrapper").removeClass("overflow-hidden");
            $(".wrapper").removeClass("d-none");
            $("#cortina").remove();
            $(".content-wrapper>.content").removeClass("d-none");
            $(".content-wrapper>.content").animate({
                opacity: 1
            }, "fast")

            //verifico el modo dinamico una vez mas
            this.setTheadDynamic();
        })
    }
    showLeftMenu(show=null){
        let isOpen = $("body").hasClass("sidebar-collapse");
        if(show === true){
            if(isOpen) return;
            $("[data-widget='pushmenu']").click();
        }else if(show === false){
            if(isOpen == false) return;
            $("[data-widget='pushmenu']").click();
        }else{
            $("[data-widget='pushmenu']").click();
        }
    }
    showRightMenu(show=null){
        let isOpen = $("body").hasClass("control-sidebar-slide-open");
        if(show === true){
            if(isOpen) return;
            $("[data-widget='control-sidebar']").click();
        }else if(show === false){
            if(isOpen == false) return;
            $("[data-widget='control-sidebar']").click();
        }else{
            $("[data-widget='control-sidebar']").click();
        }
    }
    modalPreferencias(){
        modal.show({
            title: "Preferencias de interfaz",
            body: $("#modalPreferencias").html(),
            buttons: "back"
        });

        const contenedor = $("#modal .modal-body");
        contenedor.find("[name='preferencia-animaciones']")
            .prop("checked", this.animations)
            .on("change", ev=>this.setAnimations(ev.currentTarget.checked));
        contenedor.find("[name='preferencia-sonidos']")
            .prop("checked", this.sounds)
            .on("change", ev=>this.setSounds(ev.currentTarget.checked));
        contenedor.find("[name='preferencia-mayusculas']")
            .prop("checked", this.upperCase)
            .on("change", ev=>this.setUpperCase(ev.currentTarget.checked));
        contenedor.find("[name='preferencia-separadores-numericos']")
            .prop("checked", this.maskNumbers)
            .on("change", ev=>this.setMaskNumbers(ev.currentTarget.checked));
        contenedor.find("[name='preferencia-encabezado']")
            .val(this.theadMode)
            .on("change", ev=>this.setTheadMode(Number(ev.currentTarget.value)));
        contenedor.find("[name='preferencia-posicion-modal']")
            .val(this.modalCentered ? "centrado" : "arriba")
            .on("change", ev=>{
                this.modalCentered = ev.currentTarget.value == "centrado";
                localStorage.setItem("modalCentered", this.modalCentered.toString());
                modal.element.find(".modal-dialog").toggleClass("modal-dialog-centered", this.modalCentered);
            });
    }
    setAnimations(enable=null){
        if(enable === true) this.animations = true;
        else if(enable === false) this.animations = false;
        else this.animations = !this.animations;
        if(modal?.setAnimation) modal.setAnimation(this.animations); //verifico ya que quizas no esta instanciado aun
        
        localStorage.setItem("animations", (this.animations).toString());
        if(this.animations){
            $("#toggle-animations").removeClass("btn-light").addClass("btn-primary");
            $("#toggle-animations i").removeClass("fa-pause").addClass("fa-play");
        }else{
            $("#toggle-animations").removeClass("btn-primary").addClass("btn-light");
            $("#toggle-animations i").removeClass("fa-play").addClass("fa-pause");
        }
    }
    setUpperCase(enable=null){
        if(enable === true) this.upperCase = true;
        else if(enable === false) this.upperCase = false;
        else this.upperCase = !this.upperCase;
        
        localStorage.setItem("upperCase", (this.upperCase).toString());
        if(this.upperCase){
            $("#toggle-upper-lower-case").removeClass("btn-light").addClass("btn-primary").html("A");
            $("body").addClass("table-uppercase");
        }else{
            $("#toggle-upper-lower-case").removeClass("btn-primary").addClass("btn-light").html("Aa");
            $("body").removeClass("table-uppercase");
        }
    }
    setSounds(enable=null){
        if(enable === true) this.sounds = true;
        else if(enable === false) this.sounds = false;
        else this.sounds = !this.sounds;
        
        localStorage.setItem("sounds", (this.sounds).toString());
        if(this.sounds){
            $("#toggle-sounds").removeClass("btn-light").addClass("btn-primary");
            $("#toggle-sounds i").removeClass("fa-volume-xmark").addClass("fa-volume-high");
        }else{
            $("#toggle-sounds").removeClass("btn-primary").addClass("btn-light");
            $("#toggle-sounds i").removeClass("fa-volume-high").addClass("fa-volume-xmark");
        }
    }
    setDarkMode(enable=null){

        if(enable === true) this.darkMode = true;
        else if(enable === false) this.darkMode = false;
        else this.darkMode = !this.darkMode;
        
        localStorage.setItem("darkMode", (this.darkMode).toString());
        if(this.darkMode){
            $("#toggle-dark-mode").removeClass("btn-outline-warning").addClass("btn-secondary");
            $("#toggle-dark-mode i").removeClass("fa-sun").addClass("fa-moon");
            $("body").addClass("dark-mode");
            $(".main-header").addClass("navbar-dark").removeClass("navbar-white");
        }else{
            $("#toggle-dark-mode").removeClass("btn-secondary").addClass("btn-outline-warning");
            $("#toggle-dark-mode i").removeClass("fa-moon").addClass("fa-sun");
            $("body").removeClass("dark-mode");
            $(".main-header").addClass("navbar-white").removeClass("navbar-dark");
        }
    }
    setTheadMode(v=null){

        if(v === null){
            this.theadMode += 1;
            if(this.theadMode == 3) this.theadMode = 0;
        }else{
            this.theadMode = v;
        }
        
        localStorage.setItem("theadMode", (this.theadMode).toString());
        if(this.theadMode == 0){
            $("#toggle-thead-mode").removeClass("btn-primary").removeClass("btn-warning").addClass("btn-light");
            $("#toggle-thead-mode i").removeClass("fa-table-cells-row-lock").addClass("fa-table");
            $("body").removeClass("thead-mode-sticky").removeClass("thead-mode-dynamic");
        }else if(this.theadMode == 1){
            $("#toggle-thead-mode").addClass("btn-primary").removeClass("btn-warning").removeClass("btn-light");
            $("#toggle-thead-mode i").addClass("fa-table-cells-row-lock").removeClass("fa-table");
            $("body").addClass("thead-mode-sticky").removeClass("thead-mode-dynamic");
        }else if(this.theadMode == 2){
            $("#toggle-thead-mode").removeClass("btn-primary").addClass("btn-warning").removeClass("btn-light");
            $("#toggle-thead-mode i").addClass("fa-table-cells-row-lock").removeClass("fa-table");
            $("body").removeClass("thead-mode-sticky").addClass("thead-mode-dynamic");
        }
        this.setTheadDynamic();
    }
    setMaskNumbers(enable=null){
        if(enable === true) this.maskNumbers = true;
        else if(enable === false) this.maskNumbers = false;
        else this.maskNumbers = !this.maskNumbers;

        localStorage.setItem("maskNumbers", (this.maskNumbers).toString());
        if(this.maskNumbers){
            $("#toggle-mask-input-numbers").removeClass("btn-light").addClass("btn-primary");
            $("#toggle-mask-input-numbers i").removeClass("fa-hashtag").addClass("fa-hashtag");
        }else{
            $("#toggle-mask-input-numbers").removeClass("btn-primary").addClass("btn-light");
            $("#toggle-mask-input-numbers i").removeClass("fa-hashtag").addClass("fa-hashtag");
        }
        if(typeof numberFormatter != "undefined") numberFormatter?.setEnabled(this.maskNumbers);
    }
    playSound(audioName, force=false){
        if(!this.sounds && force == false) return;
        audioName = audioName.replace(".mp3", "");

        const audioPlayer = document.getElementById('audioPlayer');
        if(!audioPlayer) return;
        const sources = audioPlayer.querySelectorAll('source[data-audio]');

        // Buscar la fuente que coincida con el data-audio especificado
        const source = Array.from(sources).find(src => src.dataset.audio === audioName);
        if(!source?.src) return;

        audioPlayer.src = source.src;
        const reproduccion = audioPlayer.play();
        if(reproduccion?.catch) reproduccion.catch(()=>{});
    }
    teclasRapidas(acciones=[]){
        $("#panel-teclas-rapidas").remove();
        $(document).off("keydown.menuTeclasRapidas keyup.menuTeclasRapidas click.menuTeclasRapidas");
        $(".modal").off("show.bs.modal.menuTeclasRapidas");

        let panel = $("<article>", {
            id: "panel-teclas-rapidas",
            class: "card card-primary card-outline shadow d-none",
            css: {
                position: "fixed",
                bottom: "10px",
                left: "16px",
                width: "min(360px, calc(100vw - 32px))",
                zIndex: 1040
            }
        });
        let header = $("<div>", {class: "card-header py-2 d-flex align-items-center"});
        header.append($("<h5>", {class: "card-title mb-0 flex-grow-1", text: "Teclas rápidas"}));
        header.append($("<button>", {
            type: "button",
            class: "close",
            html: "<span aria-hidden='true'>&times;</span>",
            "aria-label": "Cerrar"
        }).on("click", () => panel.addClass("d-none")));

        let body = $("<div>", {class: "card-body p-3"});
        let input = $("<input>", {
            type: "search",
            autocomplete: "off",
            class: "form-control mb-3",
            placeholder: "Número o nombre de la acción..."
        });
        let accionesContainer = $("<div>", {class: "acciones-teclas-rapidas"});
        (Array.isArray(acciones) ? acciones : []).forEach(accion=>{
            let tecla = (accion?.tecla ?? accion?.key ?? "").toString();
            let boton = $("<button>", {
                type: "button",
                class: "btn btn-outline-primary btn-block text-left",
                "data-tecla": tecla
            });
            boton.append($("<b>", {text: tecla}));
            boton.append($("<span>", {text: " " + (accion?.label || "")}));
            boton.on("click", ()=>{
                panel.addClass("d-none");
                if(typeof accion?.fn == "function") accion.fn();
            });
            accionesContainer.append(boton);
        });
        body.append(input, accionesContainer);

        let footer = $("<div>", {class: "card-footer p-2 text-right"});
        footer.append($("<button>", {
            type: "button",
            class: "btn btn-light btn-sm",
            text: "Cerrar teclas rápidas"
        }).on("click", () => panel.addClass("d-none")));

        panel.append(header, body, footer);
        $("body").append(panel);

        input.on("input", ev=>{
            let busqueda = $(ev.currentTarget).val().toLowerCase().trim();
            accionesContainer.children("[data-tecla]").each((index, boton)=>{
                let texto = $(boton).text().toLowerCase();
                $(boton).toggleClass("d-none", texto.indexOf(busqueda) == -1);
            });
        });

        $(".modal").off("show.bs.modal.menuTeclasRapidas").on("show.bs.modal.menuTeclasRapidas", ()=>{
            panel.addClass("d-none");
        });

        $(document).on("click.menuTeclasRapidas", ev=>{
            if(panel.hasClass("d-none")) return;
            if($(ev.target).closest("#panel-teclas-rapidas").length == 0) panel.addClass("d-none");
        });

        let ctrlSolo = false;
        $(document).on("keydown.menuTeclasRapidas", ev=>{
            let panelAbierto = panel.hasClass("d-none") == false;
            if(ev.key == "Control"){
                if(!ev.repeat) ctrlSolo = true;
                return;
            }
            if(ev.ctrlKey){
                ctrlSolo = false;
                return;
            }
            if(ev.key == "Escape" && panelAbierto){
                ev.preventDefault();
                panel.addClass("d-none");
                return;
            }
            if($(".modal.show").length > 0 || !panelAbierto) return;
            if(ev.altKey || ev.metaKey) return;
            let boton = accionesContainer.children("[data-tecla]").filter((index, item)=>{
                return $(item).hasClass("d-none") == false
                    && $(item).attr("data-tecla").toLowerCase() == ev.key.toLowerCase();
            }).first();
            if(boton.length){
                ev.preventDefault();
                boton.click();
            }
        });
        $(document).on("keyup.menuTeclasRapidas", ev=>{
            if(ev.key != "Control") return;
            let abrirTeclasRapidas = ctrlSolo;
            ctrlSolo = false;
            if(!abrirTeclasRapidas || $(".modal.show").length > 0) return;

            if(panel.hasClass("d-none") == false){
                panel.addClass("d-none");
            }else{
                input.val("");
                accionesContainer.children("[data-tecla]").removeClass("d-none");
                panel.removeClass("d-none");
                input.focus();
            }
        });
    }
    toast({level, title, message, time=2500, sound=true}){
        let _level = level;
        if(_level == "danger") _level = "error";
        if(_level == "primary") _level = "success";

        Swal.fire({
            icon: _level,
            title: title,
            text: message,
            toast: true,
            position: 'top',
            showConfirmButton: false,
            timer: time
        }) 
        if(sound) this.playSound(level);
    }
    setExpiration(serverTime=null, expirationDate=null){
        let days = fechas.diff_days(serverTime, expirationDate);
        if(days <= 0){
            let fox = `<b>Suscripción vencida</b> renuevala hacienco clic en `;
            $("#expiration [name='text']").html(fox);
            $("#expiration").removeClass("d-none").addClass("alert-danger");
            return true;
        }else if(days < 7){
            let fox = `Tu suscripción vence en <b>${days}</b> días renuevala hacienco clic en `;
            $("#expiration [name='text']").html(fox);
            $("#expiration").removeClass("d-none").addClass("alert-warning");
        }else{
            $("#expiration").addClass("d-none")
        }
        return false;
    }
    //se debe llamar a esta funcion cada vez q se agrega una tabla al DOM
    setTheadDynamic(){
        $("table").each((ind, el)=>{
            let table = $(el);
            table.off("mouseenter mouseleave");
            table.removeAttr("thead-mode-dynamic");
            
            if(this.theadMode == 2){
                table.attr("thead-mode-dynamic", true);
                table.on("mouseenter", ()=>{
                    table.find("th").addClass("thead-mode-dynamic");
                }).on("mouseleave", ()=>{
                    table.find("th").removeClass("thead-mode-dynamic");
                });
            }
        })
    }
    setHideShow(){
        $("[hideon], [showon]").each((ind, ele)=>{
            let hideon = $(ele).attr("hideon");
            let showon = $(ele).attr("showon");
            if(hideon) hideon.split(" ");
            if(showon) showon.split(" ");

            if(hideon && hideon.length > 0 && hideon.includes(primordial.emprendimiento.tipo) == true) $(ele).addClass("d-none");
            if(showon && showon.length > 0 && showon.includes(primordial.emprendimiento.tipo) == true) $(ele).removeClass("d-none");
        });
    }
}
