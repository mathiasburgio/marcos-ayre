class Inicio{
    constructor(iniciarHTML=true){
        this.enviando = false;
        if(iniciarHTML) this.iniciar();
    }
    async iniciar(){
        const tieneSesion = await $.get("/control/verificar-sesion");
        console.log(tieneSesion);
        if(!tieneSesion || tieneSesion.sesion === false) $("body").html($("#modales [name='modal-inicio-login']").html());
        $("#iniciar-sesion").on("click", async () => this.iniciarSesion());
        $("#mostrar-contrasena").on("click", () => this.mostrarContrasena());
        $("#respaldar-base-datos").on("click", () => this.respaldarBaseDatos());
        $("#restaurar-base-datos").on("click", () => this.restaurarBaseDatos());
        await boilerplate(false);
        $("#configurar-impresora").on("click", () => menu.modalPreferencias());
        $("[data-mostrar-qr]").on("click", async ev => {
            const direccion = $(ev.currentTarget).attr("data-mostrar-qr");
            const botones = $("[data-mostrar-qr]").prop("disabled", true);
            try{
                const qr = await utils.getQR({text: direccion, size: 224});
                const contenido = $("<div>").addClass("text-center").append(
                    $("<div>").addClass("d-inline-block bg-white p-3 rounded").append(qr.img.attr("alt", "QR para conectarse al servidor").addClass("img-fluid")),
                    $("<p>").addClass("text-break mt-3 mb-2").text(direccion),
                    $("<p>").addClass("text-muted small mb-0").text("Escaneá el QR desde un dispositivo conectado a la misma red Wi-Fi que la PC servidor.")
                );
                modal.show({title: "Conectar otro dispositivo", body: contenido.html(), buttons: "close"});
            }catch(err){
                console.log(err);
                menu.toast({level: "danger", title: "Código QR", message: "No se pudo generar el código QR"});
            }finally{
                botones.prop("disabled", false);
            }
        });
        menu.hideCortina();
    }
    async iniciarSesion(){
        const email = $("#form-iniciar-sesion #inicio-email").val().toString().toLowerCase().trim();
        const contrasena = $("#form-iniciar-sesion #inicio-contrasena").val().toString();
        const boton = $("#form-iniciar-sesion #iniciar-sesion");

        try{
            if(!email || email?.length < 5 || !contrasena || contrasena?.length < 5) return modal.message("Debe ingresar un email y una contraseña");
            modal.waiting("Iniciando sesión...");
            const resp = await $.post({
                url: "/inicio/iniciar-sesion",
                data: {email, contrasena},
                timeout: 15_000
            });
            if(resp.success) window.location.href = resp.usuario?.esAdmin ? "/inicio" : "/ventas";
        }catch(err){
            modal.hide(false, ()=>{
                console.log(err.responseJSON || err.statusText);
                modal.message(err.responseJSON?.error || "No se pudo iniciar sesión");
            })
        }
    }
    async respaldarBaseDatos(){
        modal.waiting("Creando respaldo...");
        try{
            const resultado = await $.post("/control/hacer-backup");
            await modal.hide(true);
            menu.toast({level: "success", title: "Respaldo", message: `Se creó ${resultado.archivo}`});
        }catch(err){
            await modal.hide(true);
            console.log(err);
            menu.toast({level: "danger", title: "Respaldo", message: err.responseJSON?.error || "No se pudo crear el respaldo"});
        }
    }
    async restaurarBaseDatos(){
        if(!await modal.yesno("¿Querés seleccionar un respaldo para restaurar? La base de datos actual será reemplazada.")) return;
        modal.waiting("Restaurando respaldo...");
        try{
            const resultado = await $.post("/control/hacer-restore");
            await modal.hide(true);
            if(resultado.cancelado) return;
            if(resultado.success) window.location.href = "/inicio";
        }catch(err){
            await modal.hide(true);
            console.log(err);
            menu.toast({level: "danger", title: "Restauración", message: err.responseJSON?.error || "No se pudo restaurar el respaldo"});
        }
    }
    async mostrarContrasena(){
        const input = $("#inicio-contrasena");
        const mostrar = input.prop("type") === "password";
        const texto = mostrar ? "Ocultar contraseña" : "Mostrar contraseña";
        input.prop("type", mostrar ? "text" : "password");
        $("#mostrar-contrasena").attr({title: texto, "aria-label": texto, "aria-pressed": mostrar.toString()})
            .find("i").toggleClass("fa-eye", !mostrar).toggleClass("fa-eye-slash", mostrar);
        input.trigger("focus");
    }

}

var inicio = new Inicio();
