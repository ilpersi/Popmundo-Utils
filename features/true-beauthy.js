function reloadCB() {
    const SCORE_LINK_XPATH = '//*[@id="ctl00_cphLeftColumn_ctl00_btnInvestigate"]';
    
    // Let's get the scoring nodes
    let xpathHelper = new XPathHelper(SCORE_LINK_XPATH);
    let scoreNodes = xpathHelper.getOrderedSnapshot(document);
    
    for (let i = 0; i < scoreNodes.snapshotLength; i++) {
        let scoreNode = scoreNodes.snapshotItem(i);
        scoreNode.click();
    
    }
}

const delay = (1000 * 60 * 10) + 5000;
setTimeout(reloadCB, delay);