class XPathHelper {
    #xpath;
    nameSpace;

    /**
     * Creates an instance of XPathHelper.
     * @param {string} xpathExpression
     * @param {*} [namespaceResolver=null] A function that will be passed any namespace prefixes and should return a
     *  string representing the namespace URI associated with that prefix. It will be used to resolve prefixes within
     *  the xpath itself, so that they can be matched with the document. The value null is common for HTML documents
     *  or when no namespace prefixes are used.
     * @param {XPathResult} [result=null]
     * @memberof XPathHelper An existing XPathResult to use for the results. If set to null the method will create and
     *  return a new XPathResult.
     */
    constructor(xpathExpression, namespaceResolver=null, result=null) {
        this.#xpath = xpathExpression;
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
        return document.evaluate(this.#xpath, contextNode, this.nameSpace, resultType, this.result);
    }
}