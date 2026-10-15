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
                timeout: 1_000
            });
            if(resp.success) window.location.href = resp.usuario?.esAdmin ? "/inicio" : "/vender";
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
