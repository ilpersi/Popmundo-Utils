const showMessageOptionsValues = { 'show_msg_helper': false };

let showMessageArea = false;

function manageShowArea() {
    if (!showMessageArea) return;

    // This XPath will make it so that the text area with the message is only displayed for future shows of my Artist
    const IS_BAND_SHOW_XPATH = "boolean(count(//div[@class='box']) = 7)"

    let isBandXpathHelper = new XPathHelper(IS_BAND_SHOW_XPATH);
    let isBandXpath = isBandXpathHelper.getBoolean(document);

    if (isBandXpath.booleanValue) {
        const VENUE_A_XPATH = "//a[@id='ctl00_cphLeftColumn_ctl01_lnkVenue']";
        const CITY_A_XPATH = "//a[@id='ctl00_cphLeftColumn_ctl01_lnkVenueCity']";
        const TIME_TD_XPATH = "/html/body/form/div[3]/div[4]/div[2]/div[2]/table/tbody/tr[3]/td[2]";
        const SCORE_A_XPATH = "//a[contains(@href, '/World/Popmundo.aspx/Help/Scoring/')]";
        const BAND_ID_DIV_PATH = "//div[@class='idHolder']";
        const TXT_AREA_DIV_XPATH = "//div[@id='ppm-content']/div[2]";

        // We get venue details
        let msgXpathHelper = new XPathHelper(VENUE_A_XPATH);
        let venueAFirstNode = msgXpathHelper.getFirstOrderedNode(document);

        let venueANode = venueAFirstNode.singleNodeValue
        let venueId = parseInt(venueANode.getAttribute('href').replace(/[^0-9]/g, ''));
        let venueName = venueANode.textContent;

        // We get city details
        msgXpathHelper.xpath = CITY_A_XPATH;
        let cityAFirstNode = msgXpathHelper.getFirstOrderedNode(document);

        let cityANode = cityAFirstNode.singleNodeValue;
        let cityId = parseInt(cityANode.getAttribute('href').replace(/[^0-9]/g, ''));
        let cityName = cityANode.textContent;

        // We get show time details
        msgXpathHelper.xpath = TIME_TD_XPATH;
        let timeTDFirstNode = msgXpathHelper.getFirstOrderedNode(document);

        let timeTDNode = timeTDFirstNode.singleNodeValue;
        let dateArray = timeTDNode.textContent.match(/(\d{1,2}\/\d{1,2}\/\d{4}),\s+([0-9:]+)/);
        let dateString = (dateArray != null) ? dateArray[1] : 'Unknown date';
        let timeString = (dateArray != null) ? dateArray[2] : 'Unknown time';

        // We get the score details
        msgXpathHelper.xpath = SCORE_A_XPATH;
        let scoreAFirstNode = msgXpathHelper.getFirstOrderedNode(document);

        let scoreANode = scoreAFirstNode.singleNodeValue;
        let fame = scoreANode.href.match(/Scoring\/([0-9]{1,2})/)[1];
        let priceStr = "0 M$";

        // https://docs.google.com/spreadsheets/d/1w50Blx8EbcNBWH7UkIgt9zx6xmcU01CLUCBlZ1r1P5M/pub?hl=de&hl=de&gid=18#
        switch (fame) {
            case "1": //Truly Abysmal
                priceStr = "6M$";
                break;
            case "2": //Abysmal
                priceStr = "6.5 M$";
                break;
            case "3": //Bottom Dwelling
                priceStr = "7 M$";
                break;
            case "4": //Horrendous
                priceStr = "8 M$";
                break;
            case "5": //Dreadful
                priceStr = "9 M$";
                break;
            case "6": //Terrible
                priceStr = "11 M$";
                break;
            case "7": //Poor
                priceStr = "13 M$";
                break;
            case "8": //Below Average
                priceStr = "15 M$";
                break;
            case "9": //Mediocre
                priceStr = "20 M$";
                break;
            case "10": //Above Average
                priceStr = "25 M$";
                break;
            case "11": //Decent
                priceStr = "30 M$";
                break;
            case "12": //Nice
                priceStr = "35 M$";
                break;
            case "13": //Pleasent
                priceStr = "45 M$";
                break;
            case "14": //Good
                priceStr = "50 M$";
                break;
            case "15": //Sweet
                priceStr = "65 M$";
                break;
            case "16": //Splendid
                priceStr = "60 M$";
                break;
            case "17": //Awesome
                priceStr = "75 M$";
                break;
            case "18": // Great
                priceStr = "80 M$";
                break;
            case "19": // Terrific
                priceStr = "85 M$";
                break;
            case "20": // Wonderful
                priceStr = "90 M$";
                break;
            case "21": // Incredible
                priceStr = "95 M$";
                break;
            case "22": //Hard to get here...
            case "23":
            case "24":
            case "25":
            case "26":
                priceStr = "100 M$";
                break;
            default:
                alert("Something went wrong with the fame level!");
                break;
        }

        // We get the band id
        msgXpathHelper.xpath = BAND_ID_DIV_PATH;
        let bandIdDivFirstNode = msgXpathHelper.getFirstOrderedNode(document);
        let bandIdDiv = bandIdDivFirstNode.singleNodeValue;
        let bandId = bandIdDiv.textContent;

        msgXpathHelper.xpath = TXT_AREA_DIV_XPATH;
        let txtAreaDivFirstNode = msgXpathHelper.getFirstOrderedNode(document);
        let txtAreaDivNode = txtAreaDivFirstNode.singleNodeValue;

        let textArea1 = document.createElement('textarea');
        textArea1.setAttribute('cols', 55);
        textArea1.setAttribute('rows', 9);
        textArea1.setAttribute('id', 'show_message');
        textArea1.innerHTML = `Hi,\n[artistid=${bandId} name=my band] has a show planned on ${dateString} at ${timeString} in [cityid=${cityId} name=${cityName}] in the [localeid=${venueId} name=${venueName}] venue.\n\nCan you please set the price to ${priceStr}?\n\nThank you!`;

        txtAreaDivNode.appendChild(document.createElement('br'));
        txtAreaDivNode.appendChild(document.createElement('br'));
        txtAreaDivNode.appendChild(textArea1);

    }
}

// When settings are changed, we update the global showPopUp varialbe
chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace == 'sync') {
        let reload = false;

        for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
            if (key == 'show_msg_helper') {
                showMessageArea = newValue;
                reload = true;
            }
        }

        if (reload) location.reload();
    }
});

// When page is loaded we get value from settings and start the tippy logic.
chrome.storage.sync.get(showMessageOptionsValues, items => {
    showMessageArea = items.show_msg_helper;

    manageShowArea();
});