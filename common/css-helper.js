class CssSelectorHelper {
    #selector;
    #contextNode;
    #results;

    /**
     * Creates an instance of CssSelectorHelper.
     * @param {string} selector Your CSS selector expression
     * @param {Document|Element} contextNode The DOM node that will be used as the root for querySelector/querySelectorAll
     */
    constructor(selector, contextNode = document) {
        this.#selector = selector;
        this.#contextNode = contextNode;
        this.#results = null;
    }

    get selector() {
        return this.#selector;
    }

    set selector(selectorExpression){
        this.#selector = selectorExpression;
    }

    /**
     * Finds a single node matching the CSS selector
     * @param {Document|Element} [contextNodeOverride] An optional node to use instead of the constructor's context node
     */
    getSingle(contextNodeOverride) {
        const node = contextNodeOverride || this.#contextNode;
        this.#results = node.querySelector(this.#selector);
        return this.#results;
    }

    /**
     * Finds all nodes matching the CSS selector
     * @param {Document|Element} [contextNodeOverride] An optional node to use instead of the constructor's context node
     */
    getAll(contextNodeOverride) {
        const node = contextNodeOverride || this.#contextNode;
        this.#results = node.querySelectorAll(this.#selector);
        return this.#results;
    }

    /**
     * Formats a single DOM node as a compact human-readable string.
     * Element nodes are rendered as <tag#id.class> "text…".
     * Text nodes are rendered as #text "content…".
     * Null is rendered as the string "null".
     * Text content is truncated to 60 characters.
     *
     * @static
     * @param {Node|null} node
     * @return {string}
     * @memberof CssSelectorHelper
     */
    static #formatNode(node) {
        if (!node) return 'null';

        if (node.nodeType === Node.TEXT_NODE) {
            const raw = node.textContent.trim();
            return `#text "${raw.length > 60 ? raw.slice(0, 60) + '…' : raw}"`;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            let label = node.tagName.toLowerCase();
            if (node.id)        label += `#${node.id}`;
            if (node.className) label += `.${[...node.classList].join('.')}`;
            const raw = node.textContent.trim();
            const text = raw.length > 60 ? raw.slice(0, 60) + '…' : raw;
            return `<${label}> "${text}"`;
        }

        return node.nodeName;
    }

    /**
     * Formats the instance's CSS Selector results into a human-readable multi-line
     * string that includes the CSS expression and the result contents.
     *
     * Intended to be passed directly to Logger methods:
     *   Logger.debug(helper.prettyPrint());
     *
     * @return {string}
     * @memberof CssSelectorHelper
     */
    prettyPrint() {
        const lines = [`Selector: ${this.#selector}`];

        if (this.#results === null || this.#results === undefined) {
            lines.push('Result  : null');
            return lines.join('\n');
        }

        if (this.#results instanceof NodeList || Array.isArray(this.#results)) {
            lines.push(`Count   : ${this.#results.length}`);
            for (let i = 0; i < this.#results.length; i++) {
                lines.push(`[${i}]     ${CssSelectorHelper.#formatNode(this.#results[i])}`);
            }
        } else {
            lines.push(`Node    : ${CssSelectorHelper.#formatNode(this.#results)}`);
        }

        return lines.join('\n');
    }
}
