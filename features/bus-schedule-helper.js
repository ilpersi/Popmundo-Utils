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

        const tds = new CssSelectorHelper('td', this.trNode).getAll();

        // Item Type logic
        let imgNode = new CssSelectorHelper('img', tds[0]).getSingle();
        if (imgNode) {
            let imgSrc = imgNode.getAttribute('src');

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
        let txtDateNode = tds[1];
        if (txtDateNode) {

            // The node can also have additional child nodes (like span elements), so me make sure to only consider text ones
            let txtDate = '';
            txtDateNode.childNodes.forEach(childNode => {
                if (childNode.nodeType === Node.TEXT_NODE)
                    txtDate += childNode.textContent.replaceAll("\n", "").replaceAll(" ", "");
            });

            let [date, time] = txtDate.split(",");
            this.time = time;
            this.date = date;
        }

        // Duration logic
        let txtDurationNode = tds[2] ? tds[2].textContent : '';
        let durationInt = parseInt(txtDurationNode.replace(/[^0-9]/g, ''));
        this.duration = isNaN(durationInt) ? 0 : durationInt;

        // Name logic
        let nameNode = tds[3] ? new CssSelectorHelper('a', tds[3]).getSingle() : null;
        this.name = nameNode ? nameNode.textContent.trim() : '';

        // City Name logic / ID logic
        let cityNode = tds[4] ? new CssSelectorHelper('a', tds[4]).getSingle() : null;
        if (cityNode) {
            this.cityName = cityNode.textContent.trim();
            let cityHref = cityNode.getAttribute('href');
            let cityInt = parseInt(cityHref.replace(/[^0-9]/g, ''));
            this.cityId = isNaN(cityInt) ? 0 : cityInt;
        }

        // We keep a reference to the last TD element of the row, in case we need to append additional content
        this.appendNode = tds[5] ? tds[5] : null;
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

const tourBusHelperOptionsValues = { 'tb_enable': true, 'tb_book_after': 'previous_event', 'tb_hour_range': 2, 'enhanced_links_font_size': 16,
        'searchable_selects': false };

let isEnabled = true;
let bookAfter = 'previous_event';
let bookRange = 2;
let enhancedLinksFontSize = 16;
let searchable_selects = false;

function manageTourBusHelper() {
    // If feature is disabled, we do nothing.
    if (!isEnabled) return;

    // Selectors used to check if we the functionality shoud be available or not
    const BOOKING_ASSISTANT_CSS = "a[href*='/Artist/BookingAssistant']";
    const BOOK_TRANSPORT_CSS = "input[type='submit'][name*='BookTransport']";

    // We only apply this content script to a band you are part of
    let isBand = new CssSelectorHelper(BOOKING_ASSISTANT_CSS).getSingle() !== null;

    // The booking feature is only available for VIPs, so we make sure the book transport button is there...
    let canBook = new CssSelectorHelper(BOOK_TRANSPORT_CSS).getSingle() !== null;

    if (isBand && canBook) {
        const SCHEDULE_ROWS_CSS = "table#tableschedule tbody tr, table#tableschedule tr"; // Support missing tbody

        let scheduleItems = new ScheduleList();

        let scheduleRowsNodes = new CssSelectorHelper(SCHEDULE_ROWS_CSS).getAll();

        for (let i = 0; i < scheduleRowsNodes.length; i++) {
            let trNode = scheduleRowsNodes[i];
            // Make sure it's not a header row
            if (new CssSelectorHelper('td', trNode).getAll().length > 0) {
                let scheduleRow = new ScheduleItem(trNode, i);
                scheduleItems.push(scheduleRow);
            }
        }

        const DEPARTURE_CITY_CSS = "select[name*='DepartureCity']";
        const ARRIVAL_CITY_CSS = "select[name*='ArrivalCity']";
        const DEPARTURE_DATE_CSS = "select[name*='DepartureDate']";
        const DEPARTURE_TIME_CSS = "select[name*='DepartureTime']";
        const DEPARTURE_TIME_VALUE_CSS = "select[name*='DepartureTime'] option";

        // Departure select element
        let departureNode = new CssSelectorHelper(DEPARTURE_CITY_CSS).getSingle();

        // Arrival select element
        let arrivalNode = new CssSelectorHelper(ARRIVAL_CITY_CSS).getSingle();

        // Departure date element
        let departureDateNode = new CssSelectorHelper(DEPARTURE_DATE_CSS).getSingle();

        // Departure time element
        let departureTimeNode = new CssSelectorHelper(DEPARTURE_TIME_CSS).getSingle();

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
                            // Departure date value
                            let departureDateValue = '', departureDateTxt = '';
                            let depDateOptions = new CssSelectorHelper('option', departureDateNode).getAll();
                            let departureOptionNodeValue = Array.from(depDateOptions).find(opt => opt.textContent.includes(previousShow.date));

                            if (departureOptionNodeValue) {
                                departureDateValue = departureOptionNodeValue.getAttribute('value');
                                departureDateTxt = departureOptionNodeValue.textContent;
                            }

                            // Departure time value
                            let departureTimeValue = '', departureTimeTxt = '';
                            let timeOptionValueNodes = new CssSelectorHelper(DEPARTURE_TIME_VALUE_CSS).getAll();

                            // We get events between the two shows so that if there is none, we always use the previous_show logic
                            let eventsBetween = scheduleItems.getEventsBetweenShows(previousShow.index, currentShow.index);

                            if (bookAfter === 'previous_show' || (bookAfter === 'previous_event' && eventsBetween.length === 0)) {
                                for (let i = 0; i < timeOptionValueNodes.length; i++) {
                                    let timeOptionNode = timeOptionValueNodes[i];
                                    let timeValue = timeOptionNode.textContent;
                                    if (timeValue == previousShow.time) {
                                        let valueIndex = i + bookRange;

                                        // This may happen if previous show is at 22:00
                                        if (valueIndex >= timeOptionValueNodes.length) valueIndex = i + 1;

                                        let valueNode = timeOptionValueNodes[valueIndex];
                                        if (valueNode) {
                                            departureTimeValue = valueNode.getAttribute('value');
                                            departureTimeTxt = valueNode.textContent;
                                        }
                                        break;
                                    }
                                }
                            } else if (bookAfter === 'previous_event' && eventsBetween.length > 0) {
                                let lastEvent = eventsBetween.at(-1);

                                for (let i = 0; i < timeOptionValueNodes.length; i++) {
                                    let timeOptionNode = timeOptionValueNodes[i];
                                    let timeValue = timeOptionNode.textContent;
                                    if (timeValue == lastEvent.time) {
                                        let valueIndex = i + bookRange;

                                        // This may happen if previous show is at 22:00
                                        if (valueIndex >= timeOptionValueNodes.length) valueIndex = timeOptionValueNodes.length - 1;

                                        let valueNode = timeOptionValueNodes[valueIndex];
                                        if (valueNode) {
                                            departureTimeValue = valueNode.getAttribute('value');
                                            departureTimeTxt = valueNode.textContent;
                                        }
                                        break;
                                    }
                                }
                            } else {
                                console.error(`Uknown relative logic: ${bookAfter}\n\neventsBetween ${eventsBetween.join('\n')}`)
                            }

                            // We finally check all the conditions and if they are true, we show the book image in the left TD element
                            if (departureNode && arrivalNode && departureDateNode && departureDateValue !== '' && departureTimeNode && departureTimeValue !== '') {

                                // Travel Icon
                                let iconElem = document.createElement('span');
                                iconElem.textContent = '🚌';
                                iconElem.setAttribute('title', chrome.i18n.getMessage('bshBookTransport', [previousShow.cityName, currentShow.cityName, departureDateTxt, departureTimeTxt]));
                                iconElem.style.cssText = `font-size:${enhancedLinksFontSize}px; cursor:pointer; margin-left:5px; user-select:none;`;
                                iconElem.classList.add('bsh-book-transport');
                                iconElem.dataset.departureCity = previousShow.cityId;
                                iconElem.dataset.arrivalCity = currentShow.cityId;
                                iconElem.dataset.departureDate = departureDateValue;
                                iconElem.dataset.departureTime = departureTimeValue;

                                currentShow.appendNode.appendChild(iconElem);

                            }
                        }
                        // Something is wrong with transports?!?!
                        else if (transports.length != 2) {
                            console.log(`Wrong number of booked transports? ${transports.length}\n\n${transports.join("\n")}`);
                        }
                    }
                }
            }
        });
    }

}

document.addEventListener('click', event => {
    if (!event.target.classList.contains('bsh-book-transport')) return;

    let iconElem = event.target;

    let departureNode = new CssSelectorHelper("select[name*='DepartureCity']").getSingle();
    let arrivalNode = new CssSelectorHelper("select[name*='ArrivalCity']").getSingle();
    let departureDateNode = new CssSelectorHelper("select[name*='DepartureDate']").getSingle();
    let departureTimeNode = new CssSelectorHelper("select[name*='DepartureTime']").getSingle();

    if (departureNode && arrivalNode && departureDateNode && departureTimeNode) {
        departureNode.value = iconElem.dataset.departureCity;
        arrivalNode.value = iconElem.dataset.arrivalCity;
        departureDateNode.value = iconElem.dataset.departureDate;
        departureTimeNode.value = iconElem.dataset.departureTime;

        // When Searchabe selects is enabled, the select with the arrival node is not visible.
        if (!searchable_selects)
            arrivalNode.scrollIntoView({ behavior: "smooth" });
        else {
            departureNode.dispatchEvent(new Event('change', { bubbles: true }));
            arrivalNode.dispatchEvent(new Event('change', { bubbles: true }));
            departureDateNode.dispatchEvent(new Event('change', { bubbles: true }));
            departureTimeNode.dispatchEvent(new Event('change', { bubbles: true }));
            arrivalNode.parentNode.scrollIntoView({ behavior: "smooth" });
        }
            
    }
});

// When page is loaded we get value from settings and start the logic.
chrome.storage.sync.get(tourBusHelperOptionsValues, items => {
    isEnabled = items.tb_enable;
    bookAfter = items.tb_book_after;
    bookRange = items.tb_hour_range;
    enhancedLinksFontSize = items.enhanced_links_font_size;
    searchable_selects = items.searchable_selects;

    manageTourBusHelper();
});

// When settings are changed, we update the global varialbes
chrome.storage.onChanged.addListener(function (changes, namespace) {
    let reload = false;

    if (namespace == 'sync') {
        for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
            if (key.startsWith('tb_')) {
                reload = true;

                switch (key) {
                    case 'tb_enable':
                        isEnabled = newValue
                        break;
                    case 'tb_book_after':
                        bookAfter = newValue
                        break;
                    case 'tb_hour_range':
                        bookRange = newValue;
                        break;
                    case 'enhanced_links_font_size':
                        enhancedLinksFontSize = newValue;
                        break;
                    case 'searchable_selects':
                        searchable_selects = newValue;
                        break;
                    default:
                        reload = false;
                        break;
                }
            }
        }
    }

    if (reload) location.reload();

});