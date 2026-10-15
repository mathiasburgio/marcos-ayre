class Productos{
    constructor(iniciarHTML=true){
        this.productos = [];
        this.productoSeleccionado = null;
        if(iniciarHTML) this.iniciar();
    }
    async iniciar(){
        await boilerplate(false);
        this.eventoEnCurso = $("#productos").attr("data-evento-en-curso") === "true";
        $("#datos input, #guardar, #modificar, #eliminar").prop("disabled", true);
        $("#nuevo").on("click", () => {
            this.productoSeleccionado = null;
            $("#datos")[0].reset();
            $("#costo, #margenGanancia, #precio, #stock").each((indice, input) => numberFormatter.setValue($(input), 0));
            $("#datos input").prop("disabled", false);
            $("#stock").prop("disabled", this.eventoEnCurso);
            $("#guardar").prop("disabled", false);
            $("#modificar, #eliminar").prop("disabled", true);
            $("#listado-productos tbody tr").removeClass("table-active");
            $("#accion").text("Nuevo");
            $("#nombre").trigger("focus");
        });
        $("#modificar").on("click", () => {
            if(!this.productoSeleccionado) return;
            $("#datos input").prop("disabled", false);
            $("#stock").prop("disabled", this.eventoEnCurso);
            $("#guardar").prop("disabled", false);
            $("#accion").text("Modificar");
            $("#nombre").trigger("focus");
        });
        $("#buscar").on("input", () => this.listarProductos());
        $("#info-stock").on("click", () => modal.message("Cuando hay un evento en curso, el stock no se podrá modificar manualmente desde el sistema.<br>No te preocupes: el sistema permite vender con stock negativo.<br>Esta restricción es para llevar un mejor control."));
        $("#costo, #margenGanancia").on("input", () => {
            const costo = Number($("#costo").val());
            const margen = Number($("#margenGanancia").val());
            if(Number.isFinite(costo) && Number.isFinite(margen)){
                numberFormatter.setValue($("#precio"), Math.round(costo * (1 + margen / 100)));
            }
        });
        $("#precio").on("input", () => {
            const costo = Number($("#costo").val());
            const precio = Number($("#precio").val());
            if(Number.isFinite(costo) && Number.isFinite(precio)){
                numberFormatter.setValue($("#margenGanancia"), costo > 0 ? Math.round((precio / costo - 1) * 100) : 0);
            }
        });
        $("#datos").on("submit", async ev => {
            ev.preventDefault();
            if(!ev.currentTarget.reportValidity() || $("#guardar").prop("disabled")) return;
            const datos = {
                nombre: $("#nombre").val().trim(),
                costo: numberFormatter.getValue($("#costo")),
                precio: numberFormatter.getValue($("#precio")),
                visible: $("#visible").prop("checked") ? 1 : 0
            };
            if(!this.eventoEnCurso) datos.stock = numberFormatter.getValue($("#stock"));
            if(this.productoSeleccionado) datos.productoId = this.productoSeleccionado.id;
            $("#guardar, #nuevo, #modificar, #eliminar").prop("disabled", true);
            try{
                const producto = await $.post("/productos/" + (this.productoSeleccionado ? "modificar" : "nuevo"), datos);
                this.productoSeleccionado = producto;
                $("#nombre").val(producto.nombre);
                $("#visible").prop("checked", Number(producto.visible) === 1);
                numberFormatter.setValue($("#stock"), producto.stock);
                $("#datos input").prop("disabled", true);
                $("#accion").text("");
                await this.obtenerProductos();
            }catch(err){
                console.log(err);
                if(err.responseJSON?.stockBloqueado){
                    this.eventoEnCurso = true;
                    $("#stock").prop("disabled", true);
                    if(!this.productoSeleccionado) numberFormatter.setValue($("#stock"), 0);
                }
                $("#guardar").prop("disabled", false);
                menu.toast({level: "danger", title: "Productos", message: err.responseJSON?.error || "No se pudo guardar el producto"});
            }finally{
                $("#nuevo").prop("disabled", false);
                $("#modificar, #eliminar").prop("disabled", !this.productoSeleccionado);
            }
        });
        $("#eliminar").on("click", async () => {
            if(!this.productoSeleccionado) return;
            const productoId = this.productoSeleccionado.id;
            if(!await modal.yesno("¿Eliminar este producto?")) return;
            $("#eliminar").prop("disabled", true);
            try{
                await $.post("/productos/eliminar", {productoId});
                this.productoSeleccionado = null;
                $("#datos")[0].reset();
                $("#costo, #margenGanancia, #precio, #stock").each((indice, input) => numberFormatter.setValue($(input), 0));
                $("#datos input, #guardar, #modificar").prop("disabled", true);
                $("#accion").text("");
                await this.obtenerProductos();
            }catch(err){
                console.log(err);
                $("#eliminar").prop("disabled", false);
                menu.toast({level: "danger", title: "Productos", message: err.responseJSON?.error || "No se pudo eliminar el producto"});
            }
        });
        await this.obtenerProductos();
        await menu.hideCortina();
    }
    async obtenerProductos(){
        try{
            this.productos = await $.getJSON("/productos/listado");
            await this.listarProductos();
        }catch(err){
            console.log(err);
            menu.toast({level: "danger", title: "Productos", message: err.responseJSON?.error || "No se pudieron cargar los productos"});
        }
    }
    async listarProductos(){
        let tbody = "";
        const busqueda = $("#buscar").val().trim().toLowerCase();
        const formatoPrecio = new Intl.NumberFormat("es-AR", {style: "currency", currency: "ARS", maximumFractionDigits: 0});
        const formatoStock = new Intl.NumberFormat("es-AR", {maximumFractionDigits: 0});
        this.productos.forEach(producto => {
            if(!producto.nombre.toLowerCase().includes(busqueda)) return;
            tbody += `<tr data-producto-id="${producto.id}" class="cp${Number(this.productoSeleccionado?.id) === Number(producto.id) ? " table-active" : ""}">
                <td>${$("<div>").text(producto.nombre).html()}</td>
                <td class="text-right text-nowrap">${formatoPrecio.format(Number(producto.precio) || 0)}</td>
                <td class="text-right text-nowrap">${formatoStock.format(Number(producto.stock) || 0)}</td>
            </tr>`;
        });

        $("#listado-productos tbody").html(tbody || '<tr><td colspan="3">No hay productos</td></tr>');
        $("#listado-productos tbody tr[data-producto-id]").on("click", ev=>{
            let productoId = $(ev.currentTarget).data("producto-id");
            let producto = this.productos.find(p => Number(p.id) === Number(productoId));
            if(!producto) return;
            this.productoSeleccionado = producto;
            $("#listado-productos tbody tr").removeClass("table-active");
            $(ev.currentTarget).addClass("table-active");
            $("#nombre").val(producto.nombre);
            $("#visible").prop("checked", Number(producto.visible) === 1);
            numberFormatter.setValue($("#costo"), Math.round(Number(producto.costo) || 0));
            numberFormatter.setValue($("#precio"), Math.round(Number(producto.precio) || 0));
            numberFormatter.setValue($("#stock"), Math.round(Number(producto.stock) || 0));
            numberFormatter.setValue($("#margenGanancia"), Number(producto.costo) > 0 ? Math.round((Number(producto.precio) / Number(producto.costo) - 1) * 100) : 0);
            $("#datos input, #guardar").prop("disabled", true);
            $("#modificar, #eliminar").prop("disabled", false);
            $("#accion").text("");
        });
        menu.setTheadDynamic();
    }
}

var productos = new Productos();
