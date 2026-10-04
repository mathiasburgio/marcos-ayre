class NumberFormatter{
    constructor(){
        this.enabled = false;
        this.inputSelector = "input[type='number']:not([data-no-number-mask]), input[mask-original-type='number']";

        if(NumberFormatter.instance?.observer) NumberFormatter.instance.observer.disconnect();
        NumberFormatter.instance = this;

        this.installValueHook();
        this.bindEvents();
        this.observeNewInputs();
    }
    installValueHook(){
        if($.valHooks.text?.mateflixNumberMask === true) return;

        let previousHook = $.valHooks.text || {};
        let previousGet = previousHook.get;
        let previousSet = previousHook.set;
        $.valHooks.text = {
            ...previousHook,
            mateflixNumberMask: true,
            get: ele=>{
                if(ele.maskInput && ele.getAttribute("mask-number") == "true"){
                    if(ele.maskInput.value === "") return "";
                    let value = Number(ele.maskInput.typedValue);
                    return Number.isFinite(value) ? value : "";
                }
                return previousGet ? previousGet(ele, "value") : undefined;
            },
            set: (ele, value)=>{
                if(ele.maskInput && ele.getAttribute("mask-number") == "true"){
                    if(value === null || typeof value == "undefined" || value === ""){
                        ele.maskInput.value = "";
                    }else{
                        let formatter = ele.numberFormatter || NumberFormatter.instance;
                        let number = formatter?.parseValue(value, null);
                        if(number === null) ele.maskInput.value = value.toString();
                        else ele.maskInput.typedValue = number;
                    }
                    ele.setAttribute("real-value", ele.maskInput.value === "" ? "" : ele.maskInput.typedValue.toString());
                    return value;
                }
                return previousSet ? previousSet(ele, value, "value") : undefined;
            }
        };
    }
    bindEvents(){
        $(document).off(".numberFormatter");
        $(document).on("focusin.numberFormatter", this.inputSelector, ev=>{
            if(this.enabled) this.apply($(ev.currentTarget));
        });
        $(document).on("shown.bs.modal.numberFormatter", ".modal", ev=>{
            if(this.enabled) this.apply($(ev.currentTarget));
        });
    }
    observeNewInputs(){
        this.observer = new MutationObserver(records=>{
            if(this.enabled == false) return;
            records.forEach(record=>{
                record.addedNodes.forEach(node=>{
                    if(node.nodeType == 1) this.apply($(node));
                });
            });
        });
        this.observer.observe(document.body, {childList: true, subtree: true});
    }
    setEnabled(enable){
        this.enabled = enable === true;
        if(this.enabled) this.apply();
        else this.remove($("input[mask-number='true'], input[mask-original-type='number']"));
    }
    parseValue(value, defaultValue=null){
        if(typeof value == "number") return Number.isFinite(value) ? value : defaultValue;
        if(value === null || typeof value == "undefined") return defaultValue;

        let text = value.toString().trim().replaceAll(" ", "").replaceAll("$", "");
        if(text === "") return defaultValue;
        if(text.includes(",")) text = text.replaceAll(".", "").replace(",", ".");
        else if(/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replaceAll(".", "");

        let number = Number(text);
        return Number.isFinite(number) ? number : defaultValue;
    }
    getInputs(target=null){
        if(target === null) return $(this.inputSelector);

        let elements = target?.jquery ? target : $(target);
        return elements.filter(this.inputSelector).add(elements.find(this.inputSelector));
    }
    getScale(target, defaultScale=2){
        let elements = target?.jquery ? target : $(target);
        if(elements.length == 0) return defaultScale;

        let element = elements.eq(0);
        let scale = Number(element.attr("data-mask-scale"));
        if(Number.isInteger(scale) && scale >= 0) return scale;

        let step = (element.attr("step") || "").toString().toLowerCase();
        if(step == "any") return 6;
        if(/^0\.\d+$/.test(step)) return step.split(".")[1].length;
        return defaultScale;
    }
    apply(target=null, force=false){
        if(this.enabled == false || typeof IMask == "undefined") return;

        this.getInputs(target).each((ind, input)=>{
            let element = $(input);
            if(force == false && input.maskInput) return;
            if(input.maskInput) this.remove(element);

            let currentType = element.attr("type") || "number";
            let initialValue = input.value;
            if(initialValue === "" && element.attr("value")) initialValue = element.attr("value");
            let initialNumber = currentType == "number" && input.value !== ""
                ? Number(input.value)
                : this.parseValue(initialValue, null);
            let originalType = element.attr("mask-original-type") || element.attr("type") || "number";
            element.attr("mask-original-type", originalType).attr("type", "text").attr("inputmode", "decimal");

            let scale = this.getScale(element);

            let options = {
                mask: Number,
                scale,
                thousandsSeparator: ".",
                padFractionalZeros: false,
                normalizeZeros: true,
                radix: ",",
                mapToRadix: ["."]
            };
            let minimum = this.parseValue(element.attr("min"), null);
            let maximum = this.parseValue(element.attr("max"), null);
            if(minimum !== null) options.min = minimum;
            if(maximum !== null) options.max = maximum;

            input.numberFormatter = this;
            input.maskInput = IMask(input, options);
            element.attr("mask-number", "true");
            if(initialNumber !== null && Number.isFinite(initialNumber)) input.maskInput.typedValue = initialNumber;
            else if(initialValue) input.maskInput.value = initialValue;
            element.attr("real-value", input.maskInput.value === "" ? "" : input.maskInput.typedValue.toString());
            input.maskInput.on("accept", ()=>{
                element.attr("real-value", input.maskInput.value === "" ? "" : input.maskInput.typedValue.toString());
            });
        });
    }
    applyModal(force=false){
        if(this.enabled) this.apply($("#modal"), force);
    }
    getValue(target=null, decimals=true){
        let elements = target?.jquery ? target : $(target);
        if(elements.length == 0) return decimals ? 0 : "";

        let element = elements.eq(0);
        let input = element[0];
        let value = input.maskInput && element.attr("mask-number") == "true"
            ? (input.maskInput.value === "" ? "" : Number(input.maskInput.typedValue))
            : this.parseValue(element.val(), "");
        if(value === "") return decimals ? 0 : "";
        if(decimals === false) return value;
        let scale = decimals === true ? this.getScale(element) : Number(decimals);
        if(Number.isInteger(scale) == false || scale < 0) scale = 2;
        return utils.decimals(value, scale);
    }
    setValue(target=null, value=null){
        let elements = target?.jquery ? target : $(target);
        if(elements.length == 0) return;
        if(this.enabled) this.apply(elements);
        elements.each((ind, input)=>{
            let element = $(input);
            if(input.maskInput && element.attr("mask-number") == "true"){
                let numero = this.parseValue(value, null);
                if(numero === null) input.maskInput.value = "";
                else input.maskInput.typedValue = numero;
                element.attr("real-value", numero === null ? "" : input.maskInput.typedValue.toString());
            }else{
                element.val(value);
            }
        });
    }
    remove(target=null){
        this.getInputs(target).each((ind, input)=>{
            let element = $(input);
            let value = input.maskInput && input.maskInput.value !== ""
                ? Number(input.maskInput.typedValue)
                : this.parseValue(input.value, "");
            if(input.maskInput) input.maskInput.destroy();
            delete input.maskInput;
            delete input.numberFormatter;

            let originalType = element.attr("mask-original-type") || "number";
            element.removeAttr("mask-number real-value mask-original-type inputmode").attr("type", originalType);
            element.val(value === "" ? "" : value).attr("value", value === "" ? "" : value);
        });
    }
}
