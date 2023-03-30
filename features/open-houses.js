// Big object with all the open houses details
const openHousesDB = {
    18: [ // Moscow
        { 'name': 'MO Big family house', 'id': 3205941 },
    ],
    39: [ // Singapore
        { 'name': 'SIN Big family house', 'id': 3222154 },
    ],
    45: [ // Shangai
        { 'name': 'SHA Big family house', 'id': 3217828 },
    ],
    54: [ // Manila
        { 'name': 'MAN Big family house', 'id': 3188092 },
    ],
    56: [ // Kiyv
        { 'name': 'KIE Big family house', 'id': 3220994 },
    ],
    62: [ // Tokyo
        { 'name': 'TOK Big family house', 'id': 3221967 },
    ]
}


function injectOpenHouseHTML() {
    // The XPATH used to get the current city ID
    const CITY_ID_XPATH = '//select[@id="ctl00_cphRightColumn_ctl01_ddlCities"]/option[@selected="selected"]';

    let cityIDXpathHelper = new XPathHelper(CITY_ID_XPATH);
    let cityNode = cityIDXpathHelper.getFirstOrderedNode(document);

    if (cityNode.singleNodeValue) {
        let cityID = parseInt(cityNode.singleNodeValue.getAttribute('value'));

        // Once we have the ID, we check if data is available for a specific city
        if (openHousesDB.hasOwnProperty(cityID)) {
            // Xpath used to get the node that will be used to inject the new HTML content
            const TRAVEL_TO_XPATH = '//*[@id="ppm-sidemenu"]/div[2]/div[2]';
            let travelToXPathHelper = new XPathHelper(TRAVEL_TO_XPATH);
            let travelToNode = travelToXPathHelper.getFirstOrderedNode(document)

            
            if (travelToNode.singleNodeValue) {
                let foundHouses = 0;
                travelToNode = travelToNode.singleNodeValue;

                let newMenuDiv = document.createElement('div');
                newMenuDiv.setAttribute('class', 'menu');

                let newMenuH3 = document.createElement('h3');
                newMenuH3.setAttribute('class', 'menu');
                newMenuH3.textContent = 'Open Houses';
                newMenuDiv.appendChild(newMenuH3);

                let newMenuUL = document.createElement('ul');
                newMenuDiv.appendChild(newMenuUL);

                openHousesDB[cityID].forEach((houseDetails) => {
                    if (houseDetails.hasOwnProperty('name') && houseDetails.hasOwnProperty('id')) {
                        let newMenuLI = document.createElement('li');
                        newMenuUL.appendChild(newMenuLI);

                        let newMenuA = document.createElement('a');
                        newMenuA.setAttribute('href', `https://${window.location.hostname}/World/Popmundo.aspx/Locale/${houseDetails.id}`);
                        newMenuA.textContent = houseDetails.name
                        newMenuUL.appendChild(newMenuA);
                        foundHouses++;
                    }
                });

                if (foundHouses > 0)
                    travelToNode.parentNode.insertBefore(newMenuDiv, travelToNode);
            }
        }
    }

}

injectOpenHouseHTML();