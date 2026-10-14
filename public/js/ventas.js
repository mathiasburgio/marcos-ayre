var modal, utils, menu;

class Ventas{
    constructor(){
        modal = modal || new Modal();
        utils = utils || new Utils();
        menu = menu || new Menu();
        $("#form-mesa").on("submit", async ev => {
            ev.preventDefault();
            const formulario = $(ev.currentTarget);
            formulario.find("button").prop("disabled", true);
            try{
                await $.ajax({url: "/mesas/nuevo", method: "POST", data: Object.fromEntries(new FormData(formulario[0])), dataType: "json"});
                window.location.reload();
            }catch(err){
                this.error(err);
                formulario.find("button").prop("disabled", false);
            }
        });
        $("[data-cobrar]").on("click", ev => this.cobrarMesa(Number($(ev.currentTarget).attr("data-cobrar"))));
    }
    cobrarMesa(mesaId){
        modal.show({title: "Cobrar mesa", body: `
            <form id="form-cobro-mesa">
                <label for="cobro-efectivo">Efectivo</label><input type="number" id="cobro-efectivo" name="efectivo" class="form-control mb-3" min="0" step="0.01" value="0">
                <label for="cobro-transferencia">Transferencia</label><input type="number" id="cobro-transferencia" name="transferencia" class="form-control" min="0" step="0.01" value="0">
                <p class="text-muted mt-3">Podés cobrar una parte del saldo. Los pagos se acumulan en la mesa.</p>
            </form>`, buttons: [{name: "dismiss", color: "secondary", text: "Cancelar"}, {name: "cobrar", color: "primary", text: "Cobrar"}],
            onShown: () => {
                modal.element.find("[name='cobrar']").on("click", async ev => {
                    const formulario = document.getElementById("form-cobro-mesa");
                    if(!formulario.reportValidity()) return;
                    const boton = $(ev.currentTarget).prop("disabled", true);
                    try{
                        await $.ajax({url: "/mesas/cobrar", method: "POST", data: {mesaId, ...Object.fromEntries(new FormData(formulario))}, dataType: "json"});
                        window.location.reload();
                    }catch(err){
                        this.error(err);
                        boton.prop("disabled", false);
                    }
                });
            }});
    }
    error(err){
        menu.toast({level: "danger", title: "Ventas", message: err.responseJSON?.error || "No se pudo completar la operación"});
    }
}

var ventas = new Ventas();
