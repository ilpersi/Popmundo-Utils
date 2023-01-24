const optionDetails = [
    { 'name': 'searchable_tables', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'progress_bar_percent', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'recent_progress_popup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'score_highlight', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'move_to_shortcut', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'redirect_to_login', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },

    // call all options
    { 'name': 'call_all_wazzup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_prank', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_sms_pic', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_sms_txt', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_gossip', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_exclude_id', 'default': [], 'save_cb': saveCSVString, 'load_cb': loadCSVstring },
]

function saveCSVString(optionName, defaultVaule) {
    let result = defaultVaule;

    let txtElem = document.getElementById(optionName);
    if (txtElem != null) {
        let value = txtElem.value;

        // Characters sanitization. We only accept numbers and commas
        value = value.replace(/[^0-9,]/g, '');

        // Initial split
        let splitStr = value.split(',');
        if (splitStr.length > 0) {
            result = [];

            splitStr.forEach(element => {
                // We make sure to save integers in preferences
                if (element.length > 0)
                    result.push(parseInt(element));
            });
        }

        if (Array.isArray(result))
            txtElem.value = result.join(',');
    }

    return result;
}

function loadCSVstring(optionName, optionValue) {
    let txtElem = document.getElementById(optionName);

    if (txtElem != null) {
        txtElem.value = optionValue.join(',');
    }
}

function saveCheckBox(optionName, defaultVaule) {
    let result = defaultVaule;

    let cbElem = document.getElementById(optionName);
    if (cbElem != null) {
        result = cbElem.checked;
    }

    return result;
}

function loadCheckBox(optionName, optionValue) {
    let cbElem = document.getElementById(optionName);

    if (cbElem != null) {
        cbElem.checked = optionValue;
    }

}

// Saves options to chrome.storage
function save_options() {
    let optionsToSave = {};

    optionDetails.forEach(option => {
        if (option.hasOwnProperty('save_cb')) {
            let optionValue = option.save_cb(option.name, option.default);
            optionsToSave[option.name] = optionValue;
        }
    });

    chrome.storage.sync.set(optionsToSave, function () {
        // Update status to let user know options were saved.
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function () {
            status.textContent = '';
        }, 1000);
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
    let defaultOptions = {};
    let optionsLoadCB = {};
    optionDetails.forEach(option => {
        defaultOptions[option.name] = option.default;

        if (option.load_cb != null)
            optionsLoadCB[option.name] = option.load_cb;
    });

    // Use default value color = 'red' and likesColor = true.
    chrome.storage.sync.get(defaultOptions, items => {
        for (let option in items) {
            // by default options match the ids of form elements
            if (optionsLoadCB.hasOwnProperty(option))
                optionsLoadCB[option](option, items[option]);
        }
    });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
