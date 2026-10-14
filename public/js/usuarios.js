class Usuarios{
    constructor(iniciarHTML=true){
        if(iniciarHTML) this.iniciar();
    }
    async iniciar(){
        await boilerplate(false);
        this.usuarios = [];
        $("#agregar-usuario").on("click", () => this.modalUsuario());
        await this.obtenerUsuarios();
        await menu.hideCortina();
    }
    async obtenerUsuarios(){
        try{
            this.usuarios = await $.getJSON("/usuarios/listado");
            await this.listarUsuarios();
        }catch(err){
            console.log(err);
            menu.toast({level: "danger", title: "Usuarios", message: err.responseJSON?.error || "No se pudieron cargar los usuarios"});
        }
    }
    async listarUsuarios(){
        let tbody = "";
        this.usuarios.forEach(usuario => {
            tbody += `<tr data-usuario-id="${usuario.id}" class="cp">
                <td>${$("<div>").text(usuario.email).html()}</td>
                <td>${Number(usuario.esAdmin) ? "Sí" : "No"}</td>
                <td><button type="button" class="btn btn-sm btn-primary btn-flat">Editar</button></td>
            </tr>`;
        });

        $("#listado-usuarios tbody").html(tbody || '<tr><td colspan="3">No hay usuarios</td></tr>');
        $("#listado-usuarios tbody tr[data-usuario-id]").on("click", ev=>{
            let usuarioId = $(ev.currentTarget).data("usuario-id");
            let usuario = this.usuarios.find(u => Number(u.id) === Number(usuarioId));
            this.modalUsuario(usuario);
        });
        menu.setTheadDynamic();
    }
    modalUsuario(usuario=null){
        //si viene con usuario es una modificacion
        modal.show({
            title: usuario ? "Modificar usuario" : "Agregar usuario",
            body: $("#modal-usuario").html(),
            buttons: "close",
            onShown: () => {
                const formulario = modal.element.find("#form-usuario");
                formulario.find("#usuario-email").val(usuario?.email || "").trigger("focus");
                formulario.find("#usuario-contrasena").val("").prop("required", !usuario);
                formulario.find("#ayuda-contrasena").toggleClass("d-none", !usuario);
                formulario.find("#usuario-esadmin").prop("checked", !!Number(usuario?.esAdmin));
                formulario.find("#eliminar-usuario").toggleClass("d-none", !usuario);
                formulario.on("submit", async ev => {
                    ev.preventDefault();
                    if(!formulario[0].reportValidity()) return;
                    const datos = {
                        email: formulario.find("#usuario-email").val().trim().toLowerCase(),
                        contrasena: formulario.find("#usuario-contrasena").val(),
                        esAdmin: formulario.find("#usuario-esadmin").prop("checked") ? 1 : 0
                    };
                    if(!utils.validateString(datos.email, "email")){
                        return menu.toast({level: "danger", title: "Usuarios", message: "Ingrese un email válido"});
                    }
                    if(new TextEncoder().encode(datos.contrasena).length > 72){
                        return menu.toast({level: "danger", title: "Usuarios", message: "La contraseña debe tener hasta 72 bytes"});
                    }
                    if(usuario) datos.usuarioId = usuario.id;
                    formulario.find("button").prop("disabled", true);
                    try{
                        await $.post("/usuarios/" + (usuario ? "modificar" : "nuevo"), datos);
                        await modal.hide(true);
                        await this.obtenerUsuarios();
                    }catch(err){
                        console.log(err);
                        menu.toast({level: "danger", title: "Usuarios", message: err.responseJSON?.error || "No se pudo guardar el usuario"});
                    }finally{
                        formulario.find("button").prop("disabled", false);
                    }
                });
                formulario.find("#eliminar-usuario").on("click", async ev => {
                    if(!usuario) return;
                    const confirmado = await modal.addPopover({querySelector: $(ev.currentTarget), type: "yesno", message: "¿Eliminar este usuario?"});
                    if(!confirmado) return;
                    formulario.find("button").prop("disabled", true);
                    try{
                        await $.post("/usuarios/eliminar", {usuarioId: usuario.id});
                        await modal.hide(true);
                        await this.obtenerUsuarios();
                    }catch(err){
                        console.log(err);
                        menu.toast({level: "danger", title: "Usuarios", message: err.responseJSON?.error || "No se pudo eliminar el usuario"});
                    }finally{
                        formulario.find("button").prop("disabled", false);
                    }
                });
            }
        });
    }
}

var usuarios = new Usuarios();
