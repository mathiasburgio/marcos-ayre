class Ventas{
    constructor(iniciarHTML=true){
        this.productos = [];
        this.carrito = [];
        this.agrupar = localStorage.getItem("agruparIgualesVentas") === "true";
        this.mesas = [];
        this.formatoDinero = new Intl.NumberFormat("es-AR", {style: "currency", currency: "ARS", maximumFractionDigits: 0});
        if(iniciarHTML) this.iniciar();
    }
    async iniciar(){
        await boilerplate(false);
        if($("#ventas").attr("data-evento-id")){
            $("#agrupar-iguales").prop("checked", this.agrupar);
            $("#buscar-producto").on("input", () => this.listarProductos());
            $("#agrupar-iguales").on("change", ev => {
                this.agrupar = ev.currentTarget.checked;
                localStorage.setItem("agruparIgualesVentas", this.agrupar.toString());
                if(this.agrupar){
                    const grupos = new Map();
                    this.carrito.forEach(linea => {
                        const clave = `${linea.productoId}-${linea.precio}-${linea.costo}`;
                        const grupo = grupos.get(clave);
                        if(grupo) grupo.cantidad += Number(linea.cantidad);
                        else grupos.set(clave, {...linea, cantidad: Number(linea.cantidad)});
                    });
                    this.carrito = Array.from(grupos.values());
                }else{
                    this.carrito = this.carrito.flatMap(linea => Array.from({length: Number(linea.cantidad)}, () => ({...linea, cantidad: 1})));
                }
                this.listarCarrito();
            });
            $("#cobrar-venta").on("click", () => this.cobrar());
            $("#gestionar-mesas").on("click", () => this.gestionarMesas());
            $("#limpiar-ticket").on("click", async () => {
                if(!this.carrito.length || !await modal.yesno("¿Limpiar la lista y quitar todos los productos del ticket?", "no")) return;
                this.carrito = [];
                this.listarCarrito();
            });
            await this.obtenerProductos();
        }
        await menu.hideCortina();
    }
    async obtenerProductos(){
        try{
            const productos = await $.getJSON("/productos/listado");
            this.productos = productos.filter(producto => Number(producto.visible) !== 0);
            this.listarProductos();
        }catch(err){
            console.log(err);
            this.error(err, "No se pudieron cargar los productos");
        }
    }
    listarProductos(){
        let filas = "";
        const busqueda = $("#buscar-producto").val().trim().toLowerCase();
        this.productos.forEach(producto => {
            if(!producto.nombre.toLowerCase().includes(busqueda)) return;
            filas += `<tr data-producto-id="${producto.id}" role="button" tabindex="0" style="cursor: pointer">
                <td>${$("<div>").text(producto.nombre).html()}</td>
                <td class="text-right text-nowrap">${this.formatoDinero.format(Number(producto.precio) || 0)}</td>
                <td class="text-right"><button type="button" class="btn btn-sm btn-primary btn-flat" data-agregar-producto="${producto.id}" aria-label="Agregar ${$("<div>").text(producto.nombre).html()}"><i class="fas fa-plus" aria-hidden="true"></i></button></td>
            </tr>`;
        });
        $("#listado-productos-venta tbody").html(filas || '<tr><td colspan="3" class="text-muted">No hay productos disponibles</td></tr>');
        const agregarProducto = ev => {
            const productoId = $(ev.currentTarget).attr("data-producto-id") || $(ev.currentTarget).closest("tr").attr("data-producto-id");
            const producto = this.productos.find(item => Number(item.id) === Number(productoId));
            if(!producto) return;
            this.carrito.push({productoId: producto.id, nombre: producto.nombre, precio: Math.round(Number(producto.precio)), costo: Math.round(Number(producto.costo)), cantidad: 1});
            this.listarCarrito();
            const contenedorTicket = $("#listado-carrito").parent()[0];
            contenedorTicket.scrollTop = contenedorTicket.scrollHeight;
        };
        $("#listado-productos-venta tbody").find("tr[data-producto-id]").on("click", agregarProducto).on("keydown", ev => {
            if(ev.target !== ev.currentTarget) return;
            if(ev.key === "Enter" || ev.key === " "){
                ev.preventDefault();
                agregarProducto(ev);
            }
        });
    }
    async listarCarrito(){
        let filas = "";
        let total = 0;
        let productosMostrar = [];
        if(this.agrupar){
            const grupos = new Map();
            this.carrito.forEach((linea, indice) => {
                const clave = `${linea.productoId}-${linea.precio}-${linea.costo}`;
                const grupo = grupos.get(clave) || {...linea, cantidad: 0, indices: [], subtotal: 0};
                grupo.cantidad += Number(linea.cantidad);
                grupo.indices.push(indice);
                grupo.subtotal += Number(linea.precio) * Number(linea.cantidad);
                grupos.set(clave, grupo);
            });
            productosMostrar = Array.from(grupos.values());
        }else{
            productosMostrar = this.carrito.map((linea, indice) => ({...linea, indices: [indice], subtotal: Number(linea.precio) * Number(linea.cantidad)}));
        }
        productosMostrar.forEach(producto => {
            total += producto.subtotal;
            const indices = producto.indices.join(",");
            filas += `<tr data-indices="${indices}" class="cp">
                <td>${$("<div>").text(producto.nombre).html()}</td>
                <td class="text-right text-nowrap"><button type="button" class="btn btn-sm btn-light btn-flat" data-cambiar-cantidad aria-label="Cambiar cantidad">${new Intl.NumberFormat("es-AR", {maximumFractionDigits: 0}).format(producto.cantidad)}</button></td>
                <td class="text-right text-nowrap">${this.formatoDinero.format(producto.subtotal)}</td>
                <td class="text-right"><button type="button" class="btn btn-sm btn-danger btn-flat" data-eliminar-producto aria-label="Eliminar producto"><i class="fas fa-trash" aria-hidden="true"></i></button></td>
            </tr>`;
        });
        $("#listado-carrito tbody").html(filas || '<tr><td colspan="4" class="text-muted">No hay productos en el ticket</td></tr>');
        this.total = total;
        $("#total-ticket").text(this.formatoDinero.format(total));
        $("#cobrar-venta, #limpiar-ticket").prop("disabled", !this.carrito.length);
        $("#listado-carrito tbody tr[data-indices]").on("click", async ev => {
            if($(ev.target).closest("[data-eliminar-producto]").length) return;
            const fila = $(ev.currentTarget).closest("tr");
            const indices = fila.attr("data-indices").split(",").map(Number);
            const producto = this.carrito[indices[0]];
            const indicesHermanos = this.carrito.reduce((lista, linea, indice) => {
                if(linea.productoId === producto.productoId && linea.precio === producto.precio && linea.costo === producto.costo) lista.push(indice);
                return lista;
            }, []);
            const cantidadActual = indicesHermanos.reduce((total, indice) => total + Number(this.carrito[indice]?.cantidad || 0), 0);
            const detalleHermanos = `Total de productos hermanos en el ticket: ${cantidadActual}`;
            const cantidadIngresada = modal.prompt({
                label: "Cantidad",
                value: cantidadActual,
                type: "number",
                small: detalleHermanos,
                onKeyupCallback: (evento, valor) => {
                    const cantidad = Number(valor);
                    const eliminar = !String(valor).trim() || !Number.isInteger(cantidad) || cantidad <= 0;
                    modal.element.find(".modal-content").toggleClass("border border-danger", eliminar);
                    modal.element.find(".modal-header").toggleClass("bg-danger text-white", eliminar);
                    modal.element.find(".modal-footer [name='accept']").toggleClass("btn-primary btn-danger", eliminar).text(eliminar ? "Eliminar" : "Aceptar");
                    modal.element.find(".modal-body small").text(eliminar ? `¿Eliminar producto? · ${detalleHermanos}` : detalleHermanos);
                }
            });
            modal.element.find(".modal-body input").attr({min: "1", step: "1"});
            const valor = await cantidadIngresada;
            modal.element.find(".modal-content").removeClass("border border-danger");
            modal.element.find(".modal-header").removeClass("bg-danger text-white");
            modal.element.find(".modal-footer [name='accept']").removeClass("btn-danger").addClass("btn-primary").text("Aceptar");
            modal.element.find(".modal-body small").empty();
            if(valor === null) return;
            const cantidad = Number(valor);
            if(!String(valor).trim() || !Number.isInteger(cantidad) || cantidad <= 0){
                this.carrito = this.carrito.filter((linea, indice) => !indicesHermanos.includes(indice));
            }else if(this.agrupar){
                this.carrito[indicesHermanos[0]].cantidad = cantidad;
                this.carrito = this.carrito.filter((linea, indice) => indice === indicesHermanos[0] || !indicesHermanos.includes(indice));
            }else{
                const productoIndividual = {...this.carrito[indicesHermanos[0]], cantidad: 1};
                this.carrito = this.carrito.filter((linea, indice) => !indicesHermanos.includes(indice));
                this.carrito.splice(indicesHermanos[0], 0, ...Array.from({length: cantidad}, () => ({...productoIndividual})));
            }
            this.listarCarrito();
        });
        $("[data-eliminar-producto]").on("click", ev => {
            const indices = $(ev.currentTarget).closest("tr").attr("data-indices").split(",").map(Number);
            this.carrito = this.carrito.filter((linea, indice) => !indices.includes(indice));
            this.listarCarrito();
        });
    }
    async cobrar(){
        if(!this.carrito.length) return;
        if(![1, 2, 3, 4].includes(menu.caja)){
            menu.toast({level: "warning", title: "Caja", message: "Seleccione una caja antes de registrar ventas"});
            return;
        }
        const total = this.total;
        let enviando = false;
        let editandoMesa = false;
        modal.show({
            title: "Cobrar",
            size: "lg",
            body: $("#modal-cobrar-venta").html(),
            buttons: "close",
            onShow: () => {
                modal.element.on("hide.bs.modal.cobrarVenta", ev => {
                    if(enviando || editandoMesa) ev.preventDefault();
                });
            },
            onHidden: () => modal.element.off("hide.bs.modal.cobrarVenta"),
            onShown: async () => {
                const contenido = modal.element.find("#cobro-venta");
                numberFormatter.apply(contenido);
                const campoEfectivo = contenido.find("#cobro-efectivo");
                const campoTransferencia = contenido.find("#cobro-transferencia");
                let efectivo = 0;
                let transferencia = 0;
                let pagoValido = false;
                let excesoAvisado = false;
                contenido.find("#cobro-total").text(this.formatoDinero.format(total));
                campoEfectivo.add(campoTransferencia).on("input", () => {
                    contenido.find('[data-borrar-pago="efectivo"]').prop("disabled", !String(campoEfectivo.val() || "").length);
                    contenido.find('[data-borrar-pago="transferencia"]').prop("disabled", !String(campoTransferencia.val() || "").length);
                    efectivo = Number(campoEfectivo.val() || 0);
                    transferencia = Number(campoTransferencia.val() || 0);
                    pagoValido = Number.isSafeInteger(efectivo) && efectivo >= 0 && Number.isSafeInteger(transferencia) && transferencia >= 0
                        && !campoEfectivo[0].validity.badInput && !campoTransferencia[0].validity.badInput;
                    const excedido = pagoValido && efectivo + transferencia > total;
                    if(excedido && !excesoAvisado) menu.toast({level: "warning", title: "Cobro", message: "El importe ingresado supera el total del ticket"});
                    excesoAvisado = excedido;
                    contenido.find("[data-confirmar-abono]").prop("disabled", enviando || !pagoValido || efectivo + transferencia !== total);
                });
                contenido.find("[data-borrar-pago]").on("click", ev => {
                    const campo = $(ev.currentTarget).attr("data-borrar-pago") === "efectivo" ? campoEfectivo : campoTransferencia;
                    numberFormatter.setValue(campo, null);
                    campo.trigger("input").trigger("focus");
                });
                contenido.find("[data-completar-pago]").on("click", ev => {
                    const completarEfectivo = $(ev.currentTarget).attr("data-completar-pago") === "efectivo";
                    const otroCampo = completarEfectivo ? campoTransferencia : campoEfectivo;
                    const otroImporte = Number(otroCampo.val() || 0);
                    if(!Number.isSafeInteger(otroImporte) || otroImporte < 0 || otroCampo[0].validity.badInput){
                        menu.toast({level: "warning", title: "Cobro", message: "Ingrese importes enteros iguales o mayores que cero"});
                        return;
                    }
                    if(otroImporte > total){
                        menu.toast({level: "warning", title: "Cobro", message: "El importe ingresado supera el total del ticket"});
                        return;
                    }
                    const campo = completarEfectivo ? campoEfectivo : campoTransferencia;
                    numberFormatter.setValue(campo, total - otroImporte);
                    campo.trigger("input");
                });
                contenido.on("change", "[name='cobro-mesa']", () => {
                    const seleccion = contenido.find("[name='cobro-mesa']:checked");
                    contenido.find("#cobro-listado-mesas tr").removeClass("table-active");
                    seleccion.closest("tr").addClass("table-active");
                    contenido.find("[data-confirmar-mesa]").prop("disabled", enviando || !seleccion.length);
                });
                contenido.on("click", "tr[data-cobro-mesa-id]", ev => {
                    if(enviando || editandoMesa || $(ev.target).closest("[data-editar-nombre-mesa]").length) return;
                    $(ev.currentTarget).find("[name='cobro-mesa']").prop("checked", true).trigger("change");
                });
                contenido.on("click", "[data-editar-nombre-mesa]", async ev => {
                    ev.stopPropagation();
                    if(enviando || editandoMesa) return;
                    const boton = $(ev.currentTarget);
                    const fila = boton.closest("tr");
                    const mesa = this.mesas.find(item => Number(item.id) === Number(fila.attr("data-cobro-mesa-id")));
                    if(!mesa) return;
                    editandoMesa = true;
                    try{
                        const respuesta = modal.addPopover({querySelector: boton, type: "input", label: "Nombre de la mesa", value: $("<div>").text(mesa.nombre).html().replace(/"/g, "&quot;")});
                        modal.element.find(".popover input").attr("maxlength", 200);
                        const valor = await respuesta;
                        if(valor === null) return;
                        const nombre = valor.trim() || `Mesa ${mesa.numero}`;
                        if(nombre === mesa.nombre) return;
                        boton.prop("disabled", true);
                        const resultado = await $.post("/mesas/editar", {mesaId: mesa.id, nombre});
                        Object.assign(mesa, resultado.mesa);
                        fila.find("[data-cobro-mesa-nombre]").text(mesa.nombre);
                    }catch(err){
                        console.log(err);
                        this.error(err, "No se pudo cambiar el nombre de la mesa");
                    }finally{
                        editandoMesa = false;
                        boton.prop("disabled", false).popover("dispose").css({position: "", zIndex: ""});
                    }
                });
                contenido.find("form[data-tipo-cobro]").on("submit", async ev => {
                    ev.preventDefault();
                    if(enviando || editandoMesa) return;
                    let datos;
                    if($(ev.currentTarget).attr("data-tipo-cobro") === "mesa"){
                        const mesaId = Number(contenido.find("[name='cobro-mesa']:checked").val());
                        if(!this.mesas.some(mesa => Number(mesa.id) === mesaId)){
                            menu.toast({level: "warning", title: "Mesas", message: "Seleccione una mesa"});
                            return;
                        }
                        datos = {mesaId};
                    }else{
                        campoEfectivo.trigger("input");
                        if(!pagoValido){
                            menu.toast({level: "warning", title: "Cobro", message: "Ingrese importes enteros iguales o mayores que cero"});
                            return;
                        }
                        if(efectivo + transferencia !== total){
                            menu.toast({level: "warning", title: "Cobro", message: efectivo + transferencia > total ? "El importe ingresado supera el total del ticket" : "Complete el total del ticket antes de confirmar"});
                            return;
                        }
                        datos = {efectivo, transferencia};
                    }
                    enviando = true;
                    contenido.find("input, button").prop("disabled", true);
                    try{
                        const guardado = await this.concretarVenta(datos);
                        enviando = false;
                        if(guardado) await modal.hide(true);
                    }finally{
                        enviando = false;
                        contenido.find("input, button").prop("disabled", false);
                        campoEfectivo.trigger("input");
                        contenido.find("[data-confirmar-mesa]").prop("disabled", !contenido.find("[name='cobro-mesa']:checked").length);
                    }
                });
                campoEfectivo.trigger("input");
                try{
                    this.mesas = await $.getJSON("/mesas/listado");
                    let filas = "";
                    this.mesas.forEach(mesa => {
                        filas += `<tr data-cobro-mesa-id="${mesa.id}" class="cp">
                            <td><input type="radio" name="cobro-mesa" id="cobro-mesa-${mesa.id}" value="${mesa.id}" aria-label="Seleccionar mesa ${mesa.numero}"></td>
                            <td>${$("<div>").text(mesa.numero).html()}</td>
                            <td data-cobro-mesa-nombre>${$("<div>").text(mesa.nombre).html()}</td>
                            <td class="text-right"><button type="button" class="btn btn-sm btn-primary btn-flat" data-editar-nombre-mesa aria-label="Cambiar nombre de la mesa ${mesa.numero}"><i class="fas fa-edit" aria-hidden="true"></i></button></td>
                        </tr>`;
                    });
                    contenido.find("#cobro-listado-mesas").html(filas || '<tr><td colspan="4" class="text-muted">No hay mesas asignadas al evento</td></tr>');
                }catch(err){
                    console.log(err);
                    contenido.find("#cobro-listado-mesas").html('<tr><td colspan="4" class="text-muted">No se pudieron cargar las mesas</td></tr>');
                    this.error(err, "No se pudieron cargar las mesas");
                }
            }
        });
    }
    async gestionarMesas(){
        try{
            this.mesas = await $.getJSON("/mesas/listado");
            let filas = "";
            this.mesas.forEach(mesa => {
                filas += `<tr data-mesa-id="${mesa.id}">
                    <td class="text-nowrap align-middle">${$("<div>").text(mesa.numero).html()}</td>
                    <td><input type="text" class="form-control form-control-sm" data-mesa-nombre maxlength="200" aria-label="Nombre de la mesa"></td>
                    <td><input type="tel" class="form-control form-control-sm" data-mesa-telefono maxlength="50" aria-label="Teléfono de la mesa"></td>
                    <td class="text-right text-nowrap align-middle">${this.formatoDinero.format(Math.round(Number(mesa.total) || 0))}</td>
                    <td class="text-nowrap align-middle">
                        <button type="button" class="btn btn-sm btn-info btn-flat" data-mesa-lista aria-label="Ver consumos de la mesa ${$("<div>").text(mesa.numero).html()}"><i class="fas fa-list mr-1" aria-hidden="true"></i>Lista</button>
                        <button type="button" class="btn btn-sm btn-primary btn-flat ml-1" data-mesa-guardar disabled>Guardar</button>
                    </td>
                </tr>`;
            });
            modal.show({title: "Gestionar mesas", size: "xl", body: `<div class="table-responsive"><table class="table table-sm"><thead class="thead-dark"><tr><th>Nº</th><th>Nombre</th><th>Teléfono</th><th class="text-right">Total</th><th>Acciones</th></tr></thead><tbody>${filas || '<tr><td colspan="5" class="text-muted">No hay mesas asignadas al evento</td></tr>'}</tbody></table></div>`, buttons: "close", onShown: () => {
                modal.element.find("tr[data-mesa-id]").each((indice, fila) => {
                    const mesa = this.mesas.find(item => Number(item.id) === Number($(fila).attr("data-mesa-id")));
                    $(fila).find("[data-mesa-nombre]").val(mesa.nombre === `Mesa ${mesa.numero}` ? "" : mesa.nombre);
                    $(fila).find("[data-mesa-telefono]").val(mesa.telefono || "");
                    $(fila).find("[data-mesa-nombre], [data-mesa-telefono]").on("input", () => {
                        const nombre = $(fila).find("[data-mesa-nombre]").val().trim() || `Mesa ${mesa.numero}`;
                        const telefono = $(fila).find("[data-mesa-telefono]").val().trim();
                        $(fila).find("[data-mesa-guardar]").prop("disabled", nombre === mesa.nombre && telefono === (mesa.telefono || ""));
                    });
                });
                modal.element.find("[data-mesa-lista]").on("click", async ev => {
                    const mesa = this.mesas.find(item => Number(item.id) === Number($(ev.currentTarget).closest("tr").attr("data-mesa-id")));
                    if(!mesa) return;
                    await modal.hide(true);
                    await this.detalleMesa(mesa);
                });
                modal.element.find("[data-mesa-guardar]").on("click", async ev => {
                    const boton = $(ev.currentTarget).prop("disabled", true);
                    const fila = boton.closest("tr");
                    const mesa = this.mesas.find(item => Number(item.id) === Number(fila.attr("data-mesa-id")));
                    const datos = {
                        mesaId: mesa.id,
                        numero: mesa.numero,
                        nombre: fila.find("[data-mesa-nombre]").val().trim() || `Mesa ${mesa.numero}`,
                        telefono: fila.find("[data-mesa-telefono]").val().trim()
                    };
                    fila.find("[data-mesa-nombre], [data-mesa-telefono]").prop("disabled", true);
                    try{
                        const resultado = await $.post("/mesas/editar", datos);
                        Object.assign(mesa, resultado.mesa);
                        fila.find("[data-mesa-nombre]").val(mesa.nombre === `Mesa ${mesa.numero}` ? "" : mesa.nombre);
                        fila.find("[data-mesa-telefono]").val(mesa.telefono || "");
                        this.mesas = this.mesas.map(item => Number(item.id) === Number(mesa.id) ? mesa : item);
                        menu.toast({level: "success", title: "Mesas", message: `Se guardaron los datos de la mesa ${mesa.numero}`});
                    }catch(err){
                        console.log(err);
                        this.error(err, "No se pudieron guardar los datos de la mesa");
                    }finally{
                        fila.find("[data-mesa-nombre], [data-mesa-telefono]").prop("disabled", false);
                        fila.find("[data-mesa-nombre]").trigger("input");
                    }
                });
            }});
        }catch(err){
            console.log(err);
            this.error(err, "No se pudieron cargar las mesas");
        }
    }
    async detalleMesa(mesa){
        try{
            const mesas = await $.getJSON("/mesas/listado");
            const mesaActual = mesas.find(item => Number(item.id) === Number(mesa.id));
            if(!mesaActual) throw new Error("La mesa no existe en el evento activo");
            Object.assign(mesa, mesaActual);
            const pedidos = new Map();
            JSON.parse(mesa.productos || "[]").forEach(producto => {
                const pedido = pedidos.get(producto.turno) || {turno: producto.turno, timestamp: producto.timestamp, productos: [], total: 0};
                pedido.productos.push(producto);
                pedido.total += Number(producto.subtotal);
                pedidos.set(producto.turno, pedido);
            });
            let filas = "";
            Array.from(pedidos.values()).sort((a, b) => b.turno - a.turno).forEach(pedido => {
                const fechaHora = new Date(pedido.timestamp).toLocaleString("es-AR");
                filas += `<tr class="table-secondary"><td colspan="3"><strong>${$("<div>").text(fechaHora).html()}</strong></td><td class="text-right text-nowrap"><strong>${this.formatoDinero.format(pedido.total)}</strong></td></tr>`;
                pedido.productos.forEach(producto => {
                    const cantidad = Math.round(Number(producto.cantidad) || 0);
                    const precio = Math.round(Number(producto.precio) || 0);
                    const subtotal = Math.round(Number(producto.subtotal) || precio * cantidad);
                    filas += `<tr>
                        <td>${$("<div>").text(producto.nombre || "").html()}</td>
                        <td class="text-right">${cantidad}</td>
                        <td class="text-right text-nowrap">${this.formatoDinero.format(precio)}</td>
                        <td class="text-right text-nowrap">${this.formatoDinero.format(subtotal)}</td>
                    </tr>`;
                });
            });
            const saldo = Math.max(0, Math.round(Number(mesa.total) || 0) - Math.round(Number(mesa.efectivo) || 0) - Math.round(Number(mesa.transferencia) || 0));
            const tituloMesa = mesa.nombre && mesa.nombre !== `Mesa ${mesa.numero}` ? `Mesa ${mesa.numero} — ${mesa.nombre}` : `Mesa ${mesa.numero}`;
            modal.show({
                title: `Consumos de ${$("<div>").text(tituloMesa).html()}`,
                size: "xl",
                body: `<div class="table-responsive" style="max-height: 55vh; overflow-y: auto;"><table class="table table-sm mb-0"><thead class="thead-dark"><tr><th>Nombre</th><th class="text-right">Cantidad</th><th class="text-right">Precio</th><th class="text-right">Subtotal</th></tr></thead><tbody>${filas || '<tr><td colspan="4" class="text-muted">La mesa todavía no tiene consumos</td></tr>'}</tbody></table></div>
                    <div class="d-flex flex-wrap justify-content-between align-items-center mt-3">
                        <strong>Saldo pendiente: ${this.formatoDinero.format(saldo)}</strong>
                        <div class="mt-2 mt-sm-0">
                            <button type="button" class="btn btn-success btn-flat" data-mesa-cobrar="efectivo" ${saldo <= 0 ? "disabled" : ""}>Cobrar efectivo</button>
                            <button type="button" class="btn btn-primary btn-flat ml-1" data-mesa-cobrar="transferencia" ${saldo <= 0 ? "disabled" : ""}>Cobrar transferencia</button>
                        </div>
                    </div>`,
                buttons: "close",
                onShown: () => {
                    modal.element.find("[data-mesa-cobrar]").on("click", async ev => {
                        if(![1, 2, 3, 4].includes(menu.caja)){
                            menu.toast({level: "warning", title: "Caja", message: "Seleccione una caja antes de cobrar mesas"});
                            return;
                        }
                        const boton = $(ev.currentTarget).prop("disabled", true);
                        const formaPago = boton.attr("data-mesa-cobrar");
                        try{
                            const resultado = await $.post("/mesas/cobrar", {
                                mesaId: mesa.id,
                                cajaNumero: menu.caja,
                                efectivo: formaPago === "efectivo" ? saldo : 0,
                                transferencia: formaPago === "transferencia" ? saldo : 0
                            });
                            menu.toast({level: "success", title: "Mesas", message: `Se cobró ${this.formatoDinero.format(saldo)} en ${formaPago}`});
                            Object.assign(mesa, resultado.mesa);
                            await modal.hide(true);
                            await this.detalleMesa(mesa);
                        }catch(err){
                            console.log(err);
                            this.error(err, "No se pudo cobrar la mesa");
                            boton.prop("disabled", false);
                        }
                    });
                }
            });
        }catch(err){
            console.log(err);
            this.error(err, "No se pudieron cargar los consumos de la mesa");
        }
    }
    async concretarVenta({efectivo=0, transferencia=0, mesaId=0}={}){
        if(!this.carrito.length) return false;
        if(![1, 2, 3, 4].includes(menu.caja)){
            menu.toast({level: "warning", title: "Caja", message: "Seleccione una caja antes de registrar ventas"});
            return false;
        }
        $("#cobrar-venta, #limpiar-ticket").prop("disabled", true);
        try{
            await $.ajax({
                url: "/ventas/concretar",
                method: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify({
                    productos: this.carrito.map(producto => ({nombre: producto.nombre, precio: producto.precio, costo: producto.costo, cantidad: producto.cantidad})),
                    efectivo,
                    transferencia,
                    mesaId,
                    cajaNumero: menu.caja
                })
            });
            this.carrito = [];
            await this.listarCarrito();
            menu.toast({level: "success", title: "Ventas", message: mesaId ? "Se agregaron los productos a la mesa" : "Venta registrada"});
            return true;
        }catch(err){
            console.log(err);
            this.error(err, "No se pudo registrar la venta");
            return false;
        }finally{
            $("#cobrar-venta, #limpiar-ticket").prop("disabled", !this.carrito.length);
        }
    }
    error(err, mensaje="No se pudo completar la operación"){
        menu.toast({level: "danger", title: "Ventas", message: err.responseJSON?.error || mensaje});
    }
}

var ventas = new Ventas();
