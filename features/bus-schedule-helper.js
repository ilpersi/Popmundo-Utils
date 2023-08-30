/**
 * Use this class to manage schedules item from the Artist Schedule page
 *
 * @class ScheduleItem
 */
class ScheduleItem {

    trNode;
    type = 'UNKNOWN';
    time = '';
    date = '';
    duration = 0;
    name = '';
    cityName = '';
    cityId = 0;
    appendNode = null;

    /**
     * Creates an instance of ScheduleItem.
     * @param {XPathResult} trScheduleNode The XPathResult containing the node to the table row with the shows
     * @param {Number} index The numeric indec of the item
     * @memberof ScheduleItem
     */
    constructor(trScheduleNode, index) {
        this.trNode = trScheduleNode;
        this.index = index;

        const ICON_XPATH = "./td[1]/img";
        const DATE_TIME_XPATH = "./td[2]";
        const DURATION_XPATH = "./td[3]/text()";
        const NAME_XPATH = "./td[4]/a/text()";
        const CITY_NAME_XPATH = "./td[5]/a/text()";
        const CITY_ID_XPATH = "./td[5]/a/@href";
        const APPEND_TD_XPATH = "./td[6]";

        // Item Type logic
        let rowXpathHelper = new XPathHelper(ICON_XPATH);
        let imgNode = rowXpathHelper.getFirstOrderedNode(this.trNode);
        if (imgNode.singleNodeValue) {
            let imgSrc = imgNode.singleNodeValue.getAttribute('src');

            if (imgSrc.includes('TinyIcon_Schedule_Show.png'))
                this.type = "SHOW";
            else if (imgSrc.includes('TinyIcon_Truck.png'))
                this.type = "TRANSPORT_LEAVES";
            else if (imgSrc.includes('TinyIcon_Truck_Reversed.png'))
                this.type = "TRANSPORT_ARRIVES";
            else if (imgSrc.includes('tv.png'))
                this.type = "TV_SHOW";
            else if (imgSrc.includes('TinyIcon_Schedule_JamSession.png'))
                this.type = "JAM_SESSION";
            else if (imgSrc.includes('TinyIcon_Schedule_RecordingSession.png'))
                this.type = "RECORDING_SESSION";
            else if (imgSrc.includes('TinyIcon_Schedule_Videosession.png'))
                this.type = "VIDEO_SESSION";
            else if (imgSrc.includes('TinyIcon_Schedule_Flight.png'))
                this.type = "FLIGHT_DEPARTURE";
            else if (imgSrc.includes('TinyIcon_Schedule_Flight_Arrival.png'))
                this.type = "FLIGHT_ARRIVAL";
            else if (imgSrc.includes('glass.png'))
                this.type = "RELASE_PARTY";
            else
                this.type = "UNKNOWN";
        }

        // Date & time logic
        rowXpathHelper.xpath = DATE_TIME_XPATH;
        let txtDateNode = rowXpathHelper.getFirstOrderedNode(this.trNode);
        if (txtDateNode.singleNodeValue) {

            // The node can also have additional child nodes (like span elements), so me make sure to only consider text ones
            let txtDate = '';
            txtDateNode.singleNodeValue.childNodes.forEach(childNode => {
                if (childNode.nodeType === Node.TEXT_NODE)
                    txtDate += childNode.textContent.replaceAll("\n", "").replaceAll(" ", "");
            });

            let [date, time] = txtDate.split(",");
            this.time = time;
            this.date = date;
        }

        // Duration logic
        rowXpathHelper.xpath = DURATION_XPATH;
        let txtDurationNode = rowXpathHelper.getString(this.trNode, true);
        let durationInt = parseInt(txtDurationNode.replace(/[^0-9]/g, ''));
        this.duration = isNaN(durationInt) ? 0 : durationInt;

        // Name logic
        rowXpathHelper.xpath = NAME_XPATH;
        this.name = rowXpathHelper.getString(this.trNode, true);

        // City Name logic
        rowXpathHelper.xpath = CITY_NAME_XPATH;
        this.cityName = rowXpathHelper.getString(this.trNode, true);

        // City ID logic
        rowXpathHelper.xpath = CITY_ID_XPATH;
        let cityHref = rowXpathHelper.getString(this.trNode, true);
        let cityInt = parseInt(cityHref.replace(/[^0-9]/g, ''));
        this.cityId = isNaN(cityInt) ? 0 : cityInt;

        // We keep a reference to the last TD element of the row, in case we need to append additional content
        rowXpathHelper = new XPathHelper(APPEND_TD_XPATH);
        let appendTDNode = rowXpathHelper.getFirstOrderedNode(this.trNode);
        if (appendTDNode.singleNodeValue) this.appendNode = appendTDNode.singleNodeValue;
    }

    /**
     * Returns a humand readable representation of a ScheduledItem
     *
     * @return {String} 
     * @memberof ScheduleItem
     */
    toString() {
        return `index: ${this.index} type: ${this.type} time: ${this.time} date: ${this.date}  duration: ${this.duration}  name: ${this.name}  cityName: ${this.cityName}  cityId: ${this.cityId}`
    }
}

class ScheduleList {

    /**
     * Creates an instance of ScheduleList. This class is intented to be as an array of ScheduleItem(s) on steroids. :)
     * @memberof ScheduleList
     */
    constructor() {
        this.scheduleItems = [];
    }

    /**
     * Adds a ScheduleItem to the internal list. Just a wrapper for the array push method.
     *
     * @param {ScheduleItem} scheduleItem
     * @memberof ScheduleList
     */
    push(scheduleItem) {
        this.scheduleItems.push(scheduleItem);
    }

    /**
     * Filters the elements of the internal list. Just a wrapper for the array filter method.
     *
     * @param {function} filterCB A pointer to the call back function to execute all the array elements
     * @return {ScheduleItem[]} 
     * @memberof ScheduleList
     */
    filter(filterCB) {
        return this.scheduleItems.filter(filterCB)
    }

    /**
     * Get a list of shows filtering based on the index.
     *
     * @param {number} [minIndex=0] Minimun index
     * @param {number} [maxIndex=0] Maximum intex
     * @return {ScheduleItem[]} 
     * @memberof ScheduleList
     */
    getShows(minIndex = 0, maxIndex = 0) {
        return this.filter(item => {
            let condition = item.type === "SHOW" && item.index >= minIndex;

            if (maxIndex !== 0) condition = condition && item.index <= maxIndex;

            return condition;
        });
    }

    /**
     * Get all the previous shows based on index
     *
     * @param {number} showIndex The index to be used as filter
     * @return {ScheduleItem[]} 
     * @memberof ScheduleList
     */
    getPastShows(showIndex) {
        return this.filter(item => item.type === "SHOW" && item.index < showIndex);
    }

    /**
     * Get events between two shows
     *
     * @param {number} previousShowIndex The index of the previous show
     * @param {number} currentShowIndex The index of the current show
     * @return {ScheduleItem[]} 
     * @memberof ScheduleList
     */
    getEventsBetweenShows(previousShowIndex, currentShowIndex) {
        let result = [];
        let events = this.filter(item => item.index >= previousShowIndex && item.index <= currentShowIndex);

        if (events.at(0).type === "SHOW" && events.at(-1).type === "SHOW") {
            events.forEach(item => {
                if (item.type !== 'SHOW')
                    result.push(item);
            })
        }

        return result;
    }

    /**
     * Get a list of transport items filtering by index, city from and city to
     *
     * @param {number} [minIndex=0] The minimun index to use as filter
     * @param {number} [maxIndex=0] The maximum index to use as filter
     * @param {number} [cityFrom=0] The id of the city the transport is leaving
     * @param {number} [cityTo=0] The id of the city the transport is going to
     * @return {ScheduleItem[]} 
     * @memberof ScheduleList
     */
    getTransports(minIndex = 0, maxIndex = 0, cityFrom = 0, cityTo = 0) {
        return this.filter(item => {
            let condition = ((item.index >= minIndex && item.index <= maxIndex) && (item.type === "TRANSPORT_LEAVES" || item.type === "TRANSPORT_ARRIVES"));

            if (cityFrom !== 0 && item.type === "TRANSPORT_LEAVES") condition = condition && item.cityId === cityFrom;

            if (cityTo !== 0 && item.type === "TRANSPORT_ARRIVES") condition = condition && item.cityId === cityTo;

            return condition;
        });
    }
}

// XPaths used to check if we the functionality shoud be available or not
const BOOKING_ASSISTANT_XPATH = "boolean(count(//a[contains(@href, '/Artist/BookingAssistant')]) >= 1)";
const BOOK_TRANSPORT_XPATH = "boolean(count(//input[@type = 'submit' and contains(@name, 'BookTransport')]) >= 1)"

// We only apply this content script to a band you are part of
let isBandXpathHelper = new XPathHelper(BOOKING_ASSISTANT_XPATH);
let isBand = isBandXpathHelper.getBoolean(document, true);

// The booking feature is only available for VIPs, so we make sure the book transport button is there...
let canBookXpathHelper = new XPathHelper(BOOK_TRANSPORT_XPATH);
let canBook = canBookXpathHelper.getBoolean(document, true);

if (isBand && canBook) {
    const SCHEDULE_ROWS_XPATH = "//table[@id='tableschedule']/tbody/tr";
    const TIME_DELAY = 2;
    const SCHEDULE_RELATIVE = 'previous_event' // previous_show or previous_event

    let scheduleItems = new ScheduleList();

    let scheduleRowsXpathHelper = new XPathHelper(SCHEDULE_ROWS_XPATH);
    let scheduleRowsNodes = scheduleRowsXpathHelper.getOrderedSnapshot(document);

    for (let i = 0; i < scheduleRowsNodes.snapshotLength; i++) {
        let trNode = scheduleRowsNodes.snapshotItem(i);
        let scheduleRow = new ScheduleItem(trNode, i);
        scheduleItems.push(scheduleRow);
    }

    const DEPARTURE_CITY_XPATH = "//select[contains(@name, 'DepartureCity')]";
    const ARRIVAL_CITY_XPATH = "//select[contains(@name, 'ArrivalCity')]";
    const DEPARTURE_DATE_XPATH = "//select[contains(@name, 'DepartureDate')]";
    const DEPARTURE_TIME_XPATH = "//select[contains(@name, 'DepartureTime')]";
    const DEPARTURE_TIME_VALUE_XPATH = "//select[contains(@name, 'DepartureTime')]//option";

    // Departure select element
    let bookXpathHelper = new XPathHelper(DEPARTURE_CITY_XPATH);
    let departureFirstNode = bookXpathHelper.getFirstOrderedNode(document);
    let departureNode = departureFirstNode.singleNodeValue;

    // Arrival select element
    bookXpathHelper.xpath = ARRIVAL_CITY_XPATH;
    let arrivalFirstNode = bookXpathHelper.getFirstOrderedNode(document);
    let arrivalNode = arrivalFirstNode.singleNodeValue

    // Departure date element
    bookXpathHelper.xpath = DEPARTURE_DATE_XPATH;
    let departureDateFirstNode = bookXpathHelper.getFirstOrderedNode(document);
    let departureDateNode = departureDateFirstNode.singleNodeValue;

    // Departure time element
    bookXpathHelper.xpath = DEPARTURE_TIME_XPATH;
    let departureTimeFirstNode = bookXpathHelper.getFirstOrderedNode(document);
    let departureTimeNode = departureTimeFirstNode.singleNodeValue;

    // We loop trough all the shows
    scheduleItems.getShows().forEach(currentShow => {
        // If index is 0, it is the first show and we want to skip it
        if (currentShow.index > 0) {

            // We get previous shows
            let previousShows = scheduleItems.getPastShows(currentShow.index);
            if (previousShows.length > 0) {

                // We only get the last previous show
                let previousShow = previousShows.at(-1);

                // If the shows are in different cities....
                if (currentShow.cityId !== previousShow.cityId) {

                    // We get the booked transports
                    let transports = scheduleItems.getTransports(previousShow.index, currentShow.index, previousShow.cityId, currentShow.cityId);

                    // Transport is not booked
                    if (transports.length == 0 && currentShow.appendNode != null) {
                        const DEPARTURE_DATE_VALUE_XPATH = `//select[contains(@name, 'DepartureDate')]//option[text()='${previousShow.date}']`;

                        // Departure date value
                        let departureDateValue = '', departureDateTxt = '';
                        bookXpathHelper.xpath = DEPARTURE_DATE_VALUE_XPATH;
                        let departureOptionNodeValue = bookXpathHelper.getFirstOrderedNode(document);
                        if (departureOptionNodeValue.singleNodeValue) {
                            departureDateValue = departureOptionNodeValue.singleNodeValue.getAttribute('value');
                            departureDateTxt = departureOptionNodeValue.singleNodeValue.textContent;
                        }

                        // Departure time value
                        let departureTimeValue = '', departureTimeTxt = '';
                        bookXpathHelper.xpath = DEPARTURE_TIME_VALUE_XPATH;
                        let timeOptionValueNodes = bookXpathHelper.getOrderedSnapshot(document);

                        // We get events between the two shows so that if there is none, we always use the previous_show logic
                        let eventsBetween = scheduleItems.getEventsBetweenShows(previousShow.index, currentShow.index);

                        if (SCHEDULE_RELATIVE === 'previous_show' || (SCHEDULE_RELATIVE === 'previous_event' && eventsBetween.length === 0) ) {
                            for (let i = 0; i < timeOptionValueNodes.snapshotLength; i++) {
                                let timeOptionNode = timeOptionValueNodes.snapshotItem(i);
                                let timeValue = timeOptionNode.textContent;
                                if (timeValue == previousShow.time) {
                                    let valueIndex = i + TIME_DELAY;
    
                                    // This may happen if previous show is at 22:00
                                    if (valueIndex >= timeOptionValueNodes.snapshotLength) valueIndex = i + 1;
    
                                    let valueNode = timeOptionValueNodes.snapshotItem(valueIndex);
                                    departureTimeValue = valueNode.getAttribute('value');
                                    departureTimeTxt = valueNode.textContent;
                                    break;
                                }
                            }
                        } else if (SCHEDULE_RELATIVE === 'previous_event' && eventsBetween.length > 0) {                            
                            let lastEvent = eventsBetween.at(-1);

                            for (let i = 0; i < timeOptionValueNodes.snapshotLength; i++) {
                                let timeOptionNode = timeOptionValueNodes.snapshotItem(i);
                                let timeValue = timeOptionNode.textContent;
                                if (timeValue == lastEvent.time) {
                                    let valueIndex = i + TIME_DELAY;
    
                                    // This may happen if previous show is at 22:00
                                    if (valueIndex >= timeOptionValueNodes.snapshotLength) valueIndex = timeOptionValueNodes.snapshotLength;
    
                                    let valueNode = timeOptionValueNodes.snapshotItem(valueIndex);
                                    departureTimeValue = valueNode.getAttribute('value');
                                    departureTimeTxt = valueNode.textContent;
                                    break;
                                }
                            }
                        } else {
                            console.error(`Uknown relative logic: ${SCHEDULE_RELATIVE}\n\neventsBetween ${eventsBetween.join('\n')}`)
                        }

                        // We finally check all the conditions and if they are true, we show the book image in the left TD element
                        if (departureNode && arrivalNode && departureDateNode && departureDateValue !== '' && departureTimeNode && departureTimeValue !== '') {

                            // Travel Icon
                            let imgElem = document.createElement('img');
                            imgElem.setAttribute('src', chrome.runtime.getURL('images/book-transport.png'));
                            imgElem.setAttribute('title', `Book Transport from ${previousShow.cityName} to ${currentShow.cityName} on ${departureDateTxt} at ${departureTimeTxt}`);
                            imgElem.addEventListener('click', event => {
                                // console.log(`CURRENT ${currentShow} PREVIOUS ${previousShow}`);

                                departureNode.value = previousShow.cityId;
                                arrivalNode.value = currentShow.cityId;
                                departureDateNode.value = departureDateValue;
                                departureTimeNode.value = departureTimeValue;
                                arrivalNode.scrollIntoView({ behavior: "smooth" });
                            });

                            currentShow.appendNode.appendChild(imgElem);

                        }
                    }
                    // Something is wrong with transports?!?!
                    else if (transports.length != 2) {
                        console.warn(`Wrong number of booked transports? ${transports.length}\n\n${transports.join("\n")}`);
                    }
                }
            }
        }
    });
}