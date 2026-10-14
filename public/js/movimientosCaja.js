class MovimientosCaja{
    constructor(iniciarHTML=true){
        this.movimientos = [];
        if(iniciarHTML) this.iniciar();
    }
    async iniciar(){
        await boilerplate(false);
        this.eventoEnCurso = $("#movimientos-caja").attr("data-evento-en-curso") === "true";
        $("#agregar-movimiento").on("click", () => this.modalMovimiento());
        const hoy = new Date();
        $("#fecha-movimientos").val(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`);
        $("#busqueda-movimientos").on("change", () => {
            const porFecha = $("#busqueda-movimientos").val() === "fecha";
            $("#filtro-evento-movimientos").toggleClass("d-none", porFecha);
            $("#evento-movimientos").prop("disabled", porFecha);
            $("#filtro-fecha-movimientos").toggleClass("d-none", !porFecha);
            $("#fecha-movimientos").prop("disabled", !porFecha);
            $("#limite-movimientos").toggleClass("d-none", !porFecha);
        });
        $("#filtros-movimientos").on("submit", async ev => {
            ev.preventDefault();
            if(ev.currentTarget.reportValidity()) await this.obtenerMovimientos();
        });
        await this.obtenerMovimientos();
        await menu.hideCortina();
    }
    async obtenerMovimientos(){
        try{
            const datos = {busqueda: $("#busqueda-movimientos").val()};
            if(datos.busqueda === "fecha") datos.fechaDesde = $("#fecha-movimientos").val();
            else datos.eventoId = $("#evento-movimientos").val() || "";
            this.movimientos = await $.getJSON("/movimientosCaja/listado", datos);
            this.listarMovimientos();
        }catch(err){
            console.log(err);
            menu.toast({level: "danger", title: "Movimientos de caja", message: err.responseJSON?.error || "No se pudieron cargar los movimientos"});
        }
    }
    listarMovimientos(){
        const tabla = $("#listado-movimientos tbody").empty();
        const importes = new Intl.NumberFormat("es-AR", {style: "currency", currency: "ARS"});
        for(const movimiento of this.movimientos){
            const fila = $("<tr>").appendTo(tabla);
            $("<td>").text(movimiento.numeroGlobal).appendTo(fila);
            $("<td>").text(movimiento.fecha ? new Date(movimiento.fecha).toLocaleString("es-AR") : "Sin fecha").appendTo(fila);
            $("<td>").append($("<span>", {class: "badge " + (movimiento.tipo === "ingreso" ? "badge-success" : "badge-danger")}).text(movimiento.tipo === "ingreso" ? "Ingreso" : "Egreso")).appendTo(fila);
            $("<td>").text(movimiento.detalle).appendTo(fila);
            $("<td>", {class: "text-right text-nowrap"}).text(importes.format(Number(movimiento.efectivo))).appendTo(fila);
            $("<td>", {class: "text-right text-nowrap"}).text(importes.format(Number(movimiento.transferencia))).appendTo(fila);
            $("<td>").text(movimiento.usuarioEmail).appendTo(fila);
        }
        if(!this.movimientos.length) tabla.html('<tr><td colspan="7">No hay movimientos</td></tr>');
        menu.setTheadDynamic();
    }
    modalMovimiento(){
        if(!this.eventoEnCurso) return;
        modal.show({
            title: "Agregar movimiento de caja",
            body: $("#modal-movimiento-caja").html(),
            buttons: "close",
            onShown: () => {
                const formulario = modal.element.find("#form-movimiento-caja");
                formulario.find("#movimiento-tipo").trigger("focus");
                formulario.on("submit", async ev => {
                    ev.preventDefault();
                    if(!formulario[0].reportValidity() || formulario.find("button[type='submit']").prop("disabled")) return;
                    const datos = {
                        tipo: formulario.find("#movimiento-tipo").val(),
                        detalle: formulario.find("#movimiento-detalle").val().trim(),
                        efectivo: numberFormatter.getValue(formulario.find("#movimiento-efectivo"), false),
                        transferencia: numberFormatter.getValue(formulario.find("#movimiento-transferencia"), false)
                    };
                    formulario.find("button").prop("disabled", true);
                    try{
                        await $.post("/movimientosCaja/nuevo", datos);
                        await modal.hide(true);
                        await this.obtenerMovimientos();
                    }catch(err){
                        console.log(err);
                        if(err.responseJSON?.eventoEnCurso === false){
                            this.eventoEnCurso = false;
                            $("#agregar-movimiento").prop("disabled", true);
                            $("#aviso-evento-movimientos").removeClass("d-none");
                        }
                        menu.toast({level: "danger", title: "Movimientos de caja", message: err.responseJSON?.error || "No se pudo registrar el movimiento"});
                    }finally{
                        formulario.find("button").prop("disabled", false);
                    }
                });
            }
        });
    }
}

var movimientosCaja = new MovimientosCaja();
