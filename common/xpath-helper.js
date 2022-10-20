class XPathHelper {
    xpath;
    nameSpace;

    constructor(xpathExpression, namespaceResolver=null, result=null) {
        this.xpath = xpathExpression;
        this.nameSpace = namespaceResolver;
        this.result = result;
    }

    getAny(contextNode) {
        return this.#xpathNodes(contextNode, XPathResult.ANY_TYPE); // 0
    }

    getNumber(contextNode) {
        return this.#xpathNodes(contextNode, XPathResult.NUMBER_TYPE); // 1
    }

    getString(contextNode) {
        return this.#xpathNodes(contextNode, XPathResult.STRING_TYPE); // 2
    }

    getBoolean(contextNode) {
        return this.#xpathNodes(contextNode, XPathResult.BOOLEAN_TYPE); // 3
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
        return document.evaluate(this.xpath, contextNode, this.nameSpace, resultType, this.result);
    }
}