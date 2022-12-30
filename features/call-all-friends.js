const myID = Utils.getMyID();

async function onSubmitClick() {
    console.log('async onclick');
    const RELATIONS_XPATH = '//td/a[contains(@href, "/World/Popmundo.aspx/Character/")]';
    const RELATIONS_ID_RE = /\/World\/Popmundo.aspx\/Character\/(\d+)/g

    let relationsXPathHelp = new XPathHelper(RELATIONS_XPATH);
    let relationsNodes = relationsXPathHelp.getOrderedSnapshot(document);

    for (let i = 0; i < relationsNodes.snapshotLength; i++) {
        let barNode = relationsNodes.snapshotItem(i);
        let href = barNode.getAttribute('href')
        console.log(href);
    }

    return false;
};

async function callAllFriends() {
    // debugger;
    console.log('My relations');
    const END_RELATION_XPATH = '//div[@id="ctl00_cphLeftColumn_ctl00_pnlEndMultiple"]';

    let endRelationsXPathHelp = new XPathHelper(END_RELATION_XPATH);
    let endRelationsNode = endRelationsXPathHelp.getFirstOrderedNode(document);

    if (endRelationsNode.singleNodeValue) {
        console.log("End relations div");

        let callAllDiv = document.createElement('div');
        callAllDiv.setAttribute('class', 'box');

        let callAllH2 = document.createElement('h2');
        callAllH2.textContent = 'Call all your contancts';

        let callAllP1 = document.createElement('p');
        callAllP1.textContent = 'Call all your friends that have a phone.';

        let callAllP2 = document.createElement('p');
        callAllP2.setAttribute('class', 'actionbuttons');

        let callAllSubmit = document.createElement('input');
        callAllSubmit.setAttribute('type', 'submit');
        callAllSubmit.setAttribute('value', 'Call all relationships');
        callAllSubmit.setAttribute('class', 'cns');
        callAllSubmit.onclick = () => {onSubmitClick(); return false;};

        callAllP2.appendChild(callAllSubmit);

        callAllDiv.appendChild(callAllH2);
        callAllDiv.appendChild(callAllP1);
        callAllDiv.appendChild(callAllP2);
        
        endRelationsNode.singleNodeValue.parentNode.insertBefore(callAllDiv, endRelationsNode.singleNodeValue.nextSibling);
    }
}

if (window.location.href.includes(myID)) {
    callAllFriends();
}