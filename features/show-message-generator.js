// This XPath will make it so that the text area with the message is only displayed for future shows of my Artist
const IS_BAND_SHOW_XPATH = "boolean(count(//div[@class='box']) = 6)"

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
    let dateArray = timeTDNode.textContent.match(/(\d{2}\/\d{2}\/\d{4}),\s+([0-9:]+)/);
    let dateString = dateArray[1];
    let timeString = dateArray[2];

    // We get the score details
    msgXpathHelper.xpath = SCORE_A_XPATH;
    let scoreAFirstNode = msgXpathHelper.getFirstOrderedNode(document);

    let scoreANode = scoreAFirstNode.singleNodeValue;
    let fame = scoreANode.href.match(/Scoring\/([0-9]{1,2})/)[1];
    let priceStr = "0 M$";

    switch (fame) {
        case "1": //Truly Abysmal
            priceStr = "5M$";
            break;
        case "2": //Abysmal
            priceStr = "6 M$";
            break;
        case "3": //Bottom Dwelling
            priceStr = "7 M$";
            break;
        case "4": //Horrendous
            priceStr = "8 M$";
            break;
        case "5": //Dreadful
            priceStr = "10 M$";
            break;
        case "6": //Terrible
            priceStr = "12 M$";
            break;
        case "7": //Poor
            priceStr = "14 M$";
            break;
        case "8": //Below Average
            priceStr = "16 M$";
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
            priceStr = "55 M$";
            break;
        case "15": //Sweet
            priceStr = "65 M$";
            break;
        case "16": //Splendid
            priceStr = "75 M$";
            break;
        case "17": //Hard to get here...
        case "18":
        case "19":
        case "20":
        case "21":
        case "22":
        case "23":
        case "24":
        case "25":
        case "26":
            priceStr = "85 M$";
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