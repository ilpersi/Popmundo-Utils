const progressBarOptions = { 'progress_bar_percent': true };

function barPercentage() {

    // The Xpath for the bars mostly used on char and artis pages
    const PROGRESS_BAR_PATH = '//div[contains(@class, "rogressBar")]';

    let xpathHelper = new XPathHelper(PROGRESS_BAR_PATH);
    let barNodes = xpathHelper.getOrderedSnapshot(document);

    for (let i = 0; i < barNodes.snapshotLength; i++) {
        let node = barNodes.snapshotItem(i);
        let percentage = node.getAttribute('title');

        node.setAttribute('style', 'display: grid;');

        // When the bar is at 0% there are no child nodes
        if (node.childNodes.length > 0) {
            let childDiv = node.childNodes[0];
            childDiv.setAttribute('style', childDiv.getAttribute('style') + " grid-area: 1/1/1/3;");

            let spanElement = document.createElement('span');
            spanElement.setAttribute('style', 'grid-area: 1/2/1/2; color: black; font-size: 10px;');
            spanElement.textContent = percentage;

            node.appendChild(spanElement);
        }

    }

    const PLUS_NEG_HOLDER = '//td/div[@class="plusMinusBar"]';
    xpathHelper = new XPathHelper(PLUS_NEG_HOLDER);
    barNodes = xpathHelper.getOrderedSnapshot(document);

    for (let i = 0; i < barNodes.snapshotLength; i++) {
        let node = barNodes.snapshotItem(i);
        let percentage = node.getAttribute('title');

        // When percentage is zero, we do not write the value
        if (percentage.startsWith('0')) continue;

        // The parent TD element
        let tdElem = node.parentNode;
        tdElem.setAttribute('style', 'display: grid; align-items: center; grid-auto-columns: auto;');

        // The plusMinusBar DIV Element
        node.setAttribute('style', 'grid-area: 1/1/1/3;');

        // The new SPAN element with the bar value
        let spanElement = document.createElement('span');
        spanElement.setAttribute('style', 'grid-row: 1/1; color: black; z-index: 1; font-size: 10px; top: 50%; grid-column: 1/3;');
        spanElement.textContent = percentage;
        // We append the new SPAN to the TD element
        tdElem.appendChild(spanElement);
    }

}

chrome.storage.sync.get(progressBarOptions, items => {
    if (items.progress_bar_percent) barPercentage();
});