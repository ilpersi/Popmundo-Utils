class XPathHelper {
    #xpath;
    #docToEvaluate;
    #evaluateResult
    nameSpace;

    /**
     * Creates an instance of XPathHelper.
     * @param {string} xpathExpression Your XPath expression
     * @param {Document} docToEvaluate The HTML document that will be used to run the document.evaluate method to find
     * XPath expressions
     * @param {*} [namespaceResolver=null] A function that will be passed any namespace prefixes and should return a
     *  string representing the namespace URI associated with that prefix. It will be used to resolve prefixes within
     *  the xpath itself, so that they can be matched with the document. The value null is common for HTML documents
     *  or when no namespace prefixes are used.
     * @param {XPathResult} [result=null]
     * @memberof XPathHelper An existing XPathResult to use for the results. If set to null the method will create and
     *  return a new XPathResult.
     */
    constructor(xpathExpression, docToEvaluate = document, namespaceResolver=null, result=null) {
        this.#xpath = xpathExpression;
        this.#docToEvaluate = docToEvaluate;
        this.#evaluateResult = null;
        this.nameSpace = namespaceResolver;
        this.result = result;
    }

    get xpath() {
        return this.#xpath;
    }

    set xpath(xpathExpression){
        this.#xpath = xpathExpression;
    }

    getAny(contextNode) {
        return this.#xpathNodes(contextNode, XPathResult.ANY_TYPE); // 0
    }

    getNumber(contextNode) {
        return this.#xpathNodes(contextNode, XPathResult.NUMBER_TYPE); // 1
    }

    getString(contextNode, toString = false) {
        let result = this.#xpathNodes(contextNode, XPathResult.STRING_TYPE); // 2

        if (toString)
            result = result.stringValue;
        
        return result;
    }

    getBoolean(contextNode, toBool = false) {
        let result = this.#xpathNodes(contextNode, XPathResult.BOOLEAN_TYPE); // 3
        
        if (toBool)
            result = result.booleanValue;
        
        return result; 
    }

    getUnorderedNodeIterator(contextNode) {
        return this.#xpathNodes(contextNode, XPathResult.UNORDERED_NODE_ITERATOR_TYPE); // 4
    }
    
    getOrderedNodeIterator(contextNode) {
        return this.#xpathNodes(contextNode, XPathResult.ORDERED_NODE_ITERATOR_TYPE); // 5
    }

    getUnorderedNodeSnapshot(contextNode) {
        return this.#xpathNodes(contextNode, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE); // 6
    }

    getOrderedSnapshot(contextNode) {
        return this.#xpathNodes(contextNode, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE); // 7
    }

    getAnyUnorderedNode(contextNode) {        
        return this.#xpathNodes(contextNode, XPathResult.ANY_UNORDERED_NODE_TYPE); // 8
    }

    getFirstOrderedNode(contextNode) {        
        return this.#xpathNodes(contextNode, XPathResult.FIRST_ORDERED_NODE_TYPE); // 9
    }

    #xpathNodes(contextNode, resultType) {
        this.#evaluateResult = this.#docToEvaluate.evaluate(this.#xpath, contextNode, this.nameSpace, resultType, this.result);
        
        return this.#evaluateResult;
    }

    // Maps XPathResult.resultType numbers to human-readable names.
    static #RESULT_TYPE_NAMES = {
        0: 'ANY',
        1: 'NUMBER',
        2: 'STRING',
        3: 'BOOLEAN',
        4: 'UNORDERED_NODE_ITERATOR',
        5: 'ORDERED_NODE_ITERATOR',
        6: 'UNORDERED_NODE_SNAPSHOT',
        7: 'ORDERED_NODE_SNAPSHOT',
        8: 'ANY_UNORDERED_NODE',
        9: 'FIRST_ORDERED_NODE',
    };

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
     * @memberof XPathHelper
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
     * Formats the instance's XPathResult into a human-readable multi-line
     * string that includes the XPath expression and the result contents.
     *
     * Iterator results (types 4 & 5) are never consumed: only their validity
     * state is reported. All other result types are fully rendered.
     *
     * Intended to be passed directly to Logger methods:
     *   Logger.debug(helper.prettyPrint());
     *
     * @return {string}
     * @memberof XPathHelper
     */
    prettyPrint() {
        const lines = [`XPath : ${this.#xpath}`];

        if (!this.#evaluateResult) {
            lines.push('Result: null');
            return lines.join('\n');
        }

        const typeName = XPathHelper.#RESULT_TYPE_NAMES[this.#evaluateResult.resultType] ?? `UNKNOWN(${this.#evaluateResult.resultType})`;
        lines.push(`Type  : ${typeName}`);

        switch (this.#evaluateResult.resultType) {
            case XPathResult.NUMBER_TYPE:
                lines.push(`Value : ${this.#evaluateResult.numberValue}`);
                break;

            case XPathResult.STRING_TYPE:
                lines.push(`Value : "${this.#evaluateResult.stringValue}"`);
                break;

            case XPathResult.BOOLEAN_TYPE:
                lines.push(`Value : ${this.#evaluateResult.booleanValue}`);
                break;

            case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
            case XPathResult.ORDERED_NODE_ITERATOR_TYPE:
                lines.push(`State : ${this.#evaluateResult.invalidIteratorState ? 'invalid (DOM mutated since creation)' : 'valid'}`);
                lines.push('Note  : content not inspected to avoid consuming the iterator');
                break;

            case XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE:
            case XPathResult.ORDERED_NODE_SNAPSHOT_TYPE:
                lines.push(`Count : ${this.#evaluateResult.snapshotLength}`);
                for (let i = 0; i < this.#evaluateResult.snapshotLength; i++)
                    lines.push(`[${i}]   ${XPathHelper.#formatNode(this.#evaluateResult.snapshotItem(i))}`);
                break;

            case XPathResult.ANY_UNORDERED_NODE_TYPE:
            case XPathResult.FIRST_ORDERED_NODE_TYPE:
                lines.push(`Node  : ${XPathHelper.#formatNode(this.#evaluateResult.singleNodeValue)}`);
                break;

            default:
                lines.push('Value : (unrecognised result type)');
        }

        return lines.join('\n');
    }
}