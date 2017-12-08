import "./node_modules/stacktrace-js/dist/stacktrace.js"

export default class ShadyElement extends HTMLElement {

    constructor() {
        super();

        if (!window.shadyJs)
            window.shadyJs = {
                components: []
            }
    }

    async connectedCallback() {

        let handler = {
            get: (a, attributeKey) => {

                attributeKey = attributeKey.toLowerCase();

                let val = this.dataset[attributeKey];
                
                if (val == "")
                    return true;
                else if (val == "false" || val == undefined)
                    return false;
                else if (val == "true")
                    return true;
                else
                    return val;
            },
            set: (a, attributeKey, val) => {

                attributeKey = attributeKey.toLowerCase();

                console.debug(`${attributeKey} = ${val}`);
                
                if (val === false)
                    delete this.dataset[attributeKey]
                else if (val == true)
                    this.dataset[attributeKey] = "";
                else 
                    this.dataset[attributeKey] = val;

                this.render();

                return true;
            }
        };

        this.Data = new Proxy({}, handler);


        for (let attributeKey of Object.keys(this.dataset)) {

            let value = this.dataset[attributeKey];
            console.log(`Defining property "Data.${attributeKey}" from attribute "data-${attributeKey}"`)
        }

        await Promise.all(this.constructor.loadingPromise);

        this.shadow = this.attachShadow({mode: "open"});

        this.render();

        this.querySelector = (selector) => {
            return this.shadow.querySelector(selector);
        };
    }

    recursivelyLink(node) {

        if ("attributes" in node) {
            for (let abb of node.attributes) {

                let attribute = abb.name;
                let value = abb.value;

                if (value.includes("()")) {
                    let func = value.replace("()", "");

                    if (func in this) {
                        node[attribute] = this[func].bind(this);
                    }
                }
            }
        }

        for (let child of node.childNodes) {
            this.recursivelyLink(child)
        }
    }

    render() {

        let wrappedCss = `<style>${this.constructor.css ? this.constructor.css : this.constructor.inlineCSS}</style>`;
        let wrappedHtml = this.constructor.html ? this.constructor.html : this.constructor.inlineHTML;

        let result;
        while ((result = /(\$\{.*\})/.exec(wrappedHtml)) !== null) {

            let toReplace = result[0];
            let key = result[0].replace("${", "").replace("}", "").replace("this.", "")

            let val = "";

            if (this[key] != null) {
                val = this[key];
            } else {
                val = this.Data[key];

                if (val instanceof Array)
                    val = val.join("");
                if (val instanceof Object)
                    val = JSON.stringify(val, null, 2).trim();
            }
            wrappedHtml = wrappedHtml.replace(toReplace, val);
        }

        this.shadow.innerHTML = `${wrappedCss}${wrappedHtml}`

        this.recursivelyLink(this.shadowRoot);
    }

    static async Init(obj) {

        let stack = await StackTrace.get({offline: true});
    
        let fileName = stack[stack.length-1].fileName;

        let pathNoExtension = /(.*)\..*/.exec(fileName)[1];

        if (obj.cssEnabled && !obj.css && !obj.inlineCSS)
            obj.css = await (await fetch(`${pathNoExtension}.css`)).text();

        if (!obj.html && !obj.inlineHTML)
            obj.html = await (await fetch(`${pathNoExtension}.html`)).text();
    }

    static Register(obj, options) {

        if (typeof options == "object") {
            obj.cssEnabled = "css" in options;
        }

        let name = obj.name;

        name = name.replace(/(?!^)([A-Z])/g, "-$&").toLowerCase();

        console.log(`Defining custom element "${name}"`)

        this.loadingPromise = [];
        this.loadingPromise.push(this.Init(obj));

        customElements.define(name, obj);        
    }
}