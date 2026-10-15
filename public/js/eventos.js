class Eventos{
    constructor(iniciarHTML=true){
        if(iniciarHTML) this.iniciar();
    }
    async iniciar(){
        await boilerplate(false);
        this.eventos = [];
        $("#agregar-evento").on("click", () => this.modalEvento());
        await this.obtenerEventos();
        await menu.hideCortina();
    }
    async obtenerEventos(){
        try{
            this.eventos = await $.getJSON("/eventos/listado");
            await this.listarEventos();
        }catch(err){
            console.log(err);
            menu.toast({level: "danger", title: "Eventos", message: err.responseJSON?.error || "No se pudieron cargar los eventos"});
        }
    }
    async listarEventos(){
        $("#agregar-evento").prop("disabled", this.eventos.some(evento => Number(evento.activo) === 1));
        let tbody = "";
        this.eventos.forEach(evento => {
            const enCurso = Number(evento.activo) === 1 && !!evento.fechaInicio && !evento.fechaFin;
            const estado = enCurso ? "En curso" : evento.fechaFin ? "Finalizado" : "Inactivo";
            const acciones = evento.fechaFin
                ? '<button type="button" class="btn btn-sm btn-info btn-flat" data-evento-resumen>Resumen</button>'
                : `<button type="button" class="btn btn-sm btn-primary btn-flat" data-evento-editar ${evento.activo ? "disabled" : ""}>Editar</button>
                    ${enCurso ? '<button type="button" class="btn btn-sm btn-warning btn-flat ml-1" data-evento-cerrar>Cerrar</button>' : '<button type="button" class="btn btn-sm btn-success btn-flat ml-1" data-evento-activar>Activar</button>'}`;
            tbody += `<tr data-evento-id="${evento.id}" class="cp">
                <td class="text-nowrap">${$("<div>").text(evento.fecha || "").html()}</td>
                <td>${$("<div>").text(evento.nombre || "").html()}</td>
                <td class="text-right">${Number(evento.mesas) || 0}</td>
                <td><span class="badge badge-${enCurso ? "success" : evento.fechaFin ? "secondary" : "light"}">${estado}</span></td>
                <td class="text-nowrap">${acciones}</td>
            </tr>`;
        });
        $("#listado-eventos tbody").html(tbody || '<tr><td colspan="5">No hay eventos</td></tr>');
        $("#listado-eventos tbody tr[data-evento-id]").on("click", ev => {
            const evento = this.eventos.find(item => Number(item.id) === Number($(ev.currentTarget).data("evento-id")));
            if(evento && !evento.fechaFin && !Number(evento.activo) && !$(ev.target).closest("button").length) this.modalEvento(evento);
        });
        $("[data-evento-editar]").on("click", ev => {
            ev.stopPropagation();
            const evento = this.eventos.find(item => Number(item.id) === Number($(ev.currentTarget).closest("tr").data("evento-id")));
            if(evento) this.modalEvento(evento);
        });
        $("[data-evento-activar]").on("click", async ev => {
            ev.stopPropagation();
            const boton = $(ev.currentTarget).prop("disabled", true);
            const eventoId = Number(boton.closest("tr").data("evento-id"));
            if(!await modal.yesno("¿Activar este evento?")){ boton.prop("disabled", false); return; }
            try{
                await $.post("/eventos/activar", {eventoId});
                await this.obtenerEventos();
            }catch(err){
                console.log(err);
                menu.toast({level: "danger", title: "Eventos", message: err.responseJSON?.error || "No se pudo activar el evento"});
                boton.prop("disabled", false);
            }
        });
        $("[data-evento-cerrar]").on("click", async ev => {
            ev.stopPropagation();
            const boton = $(ev.currentTarget).prop("disabled", true);
            const eventoId = Number(boton.closest("tr").data("evento-id"));
            if(!await modal.yesno("¿Cerrar este evento? Al cerrarlo no se podrá volver a activar.")){ boton.prop("disabled", false); return; }
            try{
                await $.post("/eventos/cerrar", {eventoId});
                await this.obtenerEventos();
            }catch(err){
                console.log(err);
                menu.toast({level: "danger", title: "Eventos", message: err.responseJSON?.error || "No se pudo cerrar el evento"});
                boton.prop("disabled", false);
            }
        });
        $("[data-evento-resumen]").on("click", async ev => {
            ev.stopPropagation();
            const evento = this.eventos.find(item => Number(item.id) === Number($(ev.currentTarget).closest("tr").data("evento-id")));
            if(!evento) return;
            modal.show({title: "Resumen del evento", size: "xl", body: $("#modal-resumen-evento").html(), buttons: "close", onShown: () => {
                const contenido = modal.element.find("#resumen-evento-datos");
                const mensajeError = modal.element.find("#resumen-evento-error");
                const selectorCaja = modal.element.find("#resumen-evento-caja");
                const formatoDinero = new Intl.NumberFormat("es-AR", {style: "currency", currency: "ARS", maximumFractionDigits: 0});
                modal.element.find("#resumen-evento-nombre").text(evento.nombre);
                selectorCaja.on("change", async () => {
                    selectorCaja.prop("disabled", true);
                    contenido.addClass("d-none");
                    mensajeError.addClass("d-none").empty();
                    try{
                        const resumen = await $.getJSON("/eventos/resumen", {eventoId: evento.id, cajaNumero: selectorCaja.val()});
                        contenido.find("#resumen-cantidad-ventas").text(resumen.cantidadVentas);
                        contenido.find("#resumen-monto-total").text(formatoDinero.format(resumen.montoTotal));
                        contenido.find("#resumen-efectivo").text(formatoDinero.format(resumen.efectivo));
                        contenido.find("#resumen-transferencia").text(formatoDinero.format(resumen.transferencia));
                        let filas = "";
                        const totales = {costo: 0, precio: 0, ganancia: 0};
                        const productos = Array.isArray(resumen.productos) ? resumen.productos : [];
                        productos.forEach(producto => {
                            const costo = Number.isFinite(Number(producto.costoAcumulado)) ? Math.round(Number(producto.costoAcumulado)) : 0;
                            const precio = Number.isFinite(Number(producto.precioAcumulado)) ? Math.round(Number(producto.precioAcumulado)) : 0;
                            const ganancia = precio - costo;
                            const cantidad = Number.isFinite(Number(producto.cantidad)) ? Math.round(Number(producto.cantidad)) : 0;
                            totales.costo += costo;
                            totales.precio += precio;
                            totales.ganancia += ganancia;
                            filas += `<tr>
                                <td>${$("<div>").text(producto.nombre).html()}</td>
                                <td class="text-right text-nowrap">${new Intl.NumberFormat("es-AR", {maximumFractionDigits: 0}).format(cantidad)}</td>
                                <td class="text-right text-nowrap">${formatoDinero.format(costo)}</td>
                                <td class="text-right text-nowrap">${formatoDinero.format(precio)}</td>
                                <td class="text-right text-nowrap">${formatoDinero.format(ganancia)}</td>
                            </tr>`;
                        });
                        contenido.find("#resumen-productos").html(filas || '<tr><td colspan="5" class="text-muted">No hay productos vendidos</td></tr>');
                        contenido.find("#resumen-monto-ganado").text(formatoDinero.format(totales.ganancia));
                        contenido.find("#resumen-total-costo").text(formatoDinero.format(totales.costo));
                        contenido.find("#resumen-total-precio").text(formatoDinero.format(totales.precio));
                        contenido.find("#resumen-total-ganancia").text(formatoDinero.format(totales.ganancia));
                        contenido.removeClass("d-none");
                    }catch(err){
                        console.log(err);
                        mensajeError.removeClass("d-none").text(err.responseJSON?.error || "No se pudo cargar el resumen");
                    }finally{
                        selectorCaja.prop("disabled", false);
                    }
                }).trigger("change");
            }});
        });
        menu.setTheadDynamic();
    }
    modalEvento(evento=null){
        modal.show({
            title: evento ? "Modificar evento" : "Agregar evento",
            body: $("#modal-evento").html(),
            buttons: "close",
            onShown: () => {
                const formulario = modal.element.find("#form-evento");
                const hoy = new Date();
                formulario.find("#evento-fecha").val(evento?.fecha || new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
                formulario.find("#evento-nombre").val(evento?.nombre || "").trigger("focus");
                formulario.find("#evento-mesas").val(evento?.mesas ?? 0);
                formulario.on("submit", async ev => {
                    ev.preventDefault();
                    if(!formulario[0].reportValidity()) return;
                    const datos = {
                        fecha: formulario.find("#evento-fecha").val(),
                        nombre: formulario.find("#evento-nombre").val().trim(),
                        mesas: formulario.find("#evento-mesas").val()
                    };
                    if(evento) datos.eventoId = evento.id;
                    formulario.find("button").prop("disabled", true);
                    try{
                        await $.post("/eventos/" + (evento ? "modificar" : "nuevo"), datos);
                        await modal.hide(true);
                        await this.obtenerEventos();
                    }catch(err){
                        console.log(err);
                        menu.toast({level: "danger", title: "Eventos", message: err.responseJSON?.error || "No se pudo guardar el evento"});
                    }finally{
                        formulario.find("button").prop("disabled", false);
                    }
                });
            }
        });
    }
}

var eventos = new Eventos();
