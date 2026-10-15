class MovimientosCaja{
    constructor(iniciarHTML=true){
        this.movimientos = [];
        if(iniciarHTML) this.iniciar();
    }
    async iniciar(){
        await boilerplate(false);
        this.eventoEnCurso = $("#movimientos-caja").attr("data-evento-en-curso") === "true";
        $("#agregar-movimiento").on("click", () => this.modalMovimiento());
        $("#evento-movimientos, #caja-movimientos").on("change", () => this.obtenerMovimientos());
        await this.obtenerMovimientos();
        await menu.hideCortina();
        const contenedor = $("#listado-movimientos").closest(".table-scroll")[0];
        contenedor.scrollTop = contenedor.scrollHeight;
    }
    async obtenerMovimientos(){
        try{
            const datos = {eventoId: $("#evento-movimientos").val() || "", cajaNumero: $("#caja-movimientos").val() || ""};
            const movimientos = await $.getJSON("/movimientosCaja/listado", datos);
            if(datos.eventoId !== ($("#evento-movimientos").val() || "") || datos.cajaNumero !== ($("#caja-movimientos").val() || "")) return;
            this.movimientos = movimientos;
            this.listarMovimientos();
        }catch(err){
            console.log(err);
            menu.toast({level: "danger", title: "Movimientos de caja", message: err.responseJSON?.error || "No se pudieron cargar los movimientos"});
        }
    }
    listarMovimientos(){
        const tabla = $("#listado-movimientos tbody").empty();
        const importes = new Intl.NumberFormat("es-AR", {style: "currency", currency: "ARS", maximumFractionDigits: 0});
        let saldo = 0;
        for(const movimiento of [...this.movimientos].reverse()){
            saldo += (Number(movimiento.efectivo) + Number(movimiento.transferencia)) * (movimiento.tipo === "ingreso" ? 1 : -1);
            const fila = $("<tr>").appendTo(tabla);
            $("<td>").text(movimiento.numeroGlobal).appendTo(fila);
            $("<td>").text(movimiento.fecha ? new Date(movimiento.fecha).toLocaleString("es-AR") : "Sin fecha").appendTo(fila);
            $("<td>").append($("<span>", {class: "badge " + (movimiento.tipo === "ingreso" ? "badge-success" : "badge-danger")}).text(movimiento.tipo === "ingreso" ? "Ingreso" : "Egreso")).appendTo(fila);
            $("<td>").text(movimiento.detalle).appendTo(fila);
            $("<td>", {class: "text-right text-nowrap"}).text(importes.format(Number(movimiento.efectivo))).appendTo(fila);
            $("<td>", {class: "text-right text-nowrap"}).text(importes.format(Number(movimiento.transferencia))).appendTo(fila);
            $("<td>").text(movimiento.usuarioEmail).appendTo(fila);
            $("<td>", {class: `text-right text-nowrap ${saldo > 0 ? "text-success" : saldo < 0 ? "text-danger" : ""}`}).text(importes.format(saldo)).appendTo(fila);
        }
        if(!this.movimientos.length) tabla.html('<tr><td colspan="8">No hay movimientos</td></tr>');
        menu.setTheadDynamic();
        const contenedor = $("#listado-movimientos").closest(".table-scroll")[0];
        contenedor.scrollTop = contenedor.scrollHeight;
    }
    modalMovimiento(){
        if(!this.eventoEnCurso) return;
        modal.show({
            title: "Agregar movimiento de caja",
            body: $("#modal-movimiento-caja").html(),
            buttons: "close",
            onShown: () => {
                const formulario = modal.element.find("#form-movimiento-caja");
                formulario.find("#movimiento-caja").val(menu.caja || "");
                formulario.find("#movimiento-tipo").trigger("focus");
                formulario.on("submit", async ev => {
                    ev.preventDefault();
                    if(!formulario[0].reportValidity() || formulario.find("button[type='submit']").prop("disabled")) return;
                    const datos = {
                        cajaNumero: formulario.find("#movimiento-caja").val(),
                        tipo: formulario.find("#movimiento-tipo").val(),
                        detalle: formulario.find("#movimiento-detalle").val().trim(),
                        efectivo: numberFormatter.getValue(formulario.find("#movimiento-efectivo")),
                        transferencia: numberFormatter.getValue(formulario.find("#movimiento-transferencia"))
                    };
                    formulario.find("button").prop("disabled", true);
                    try{
                        const movimiento = await $.post("/movimientosCaja/nuevo", datos);
                        await modal.hide(true);
                        const filtroCaja = $("#caja-movimientos");
                        if(filtroCaja.val() && Number(filtroCaja.val()) !== movimiento.cajaNumero) filtroCaja.val(movimiento.cajaNumero);
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
