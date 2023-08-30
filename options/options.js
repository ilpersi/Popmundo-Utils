const optionDetails = [
    // misc options
    { 'name': 'searchable_tables', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'progress_bar_percent', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'move_to_shortcut', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'score_highlight', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'redirect_to_login', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'fast_character_switch', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'show_msg_helper', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    
    // pop up options
    { 'name': 'character_popup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'song_popup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'recent_progress_popup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'show_club_popup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'show_details_popup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    
    // tour bus helper options
    { 'name': 'tb_enable', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'tb_book_after', 'default': 'previous_event', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'tb_hour_range', 'default': 2, 'save_cb': saveInteger, 'load_cb': loadInteger },

    // call all options
    { 'name': 'call_all_wazzup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_prank', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_sms_pic', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_sms_txt', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_gossip', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_exclude_id', 'default': [], 'save_cb': saveCSVString, 'load_cb': loadCSVstring },

    // mass interact options
    { 'name': 'mass_interact_greet', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_smile', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_wink', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_insult', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_share_opinions', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_gossip', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_have_profound_discussion', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_comfort', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_talk_to', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_tease', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_fraternize', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_offer_advice', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_please_stop_flirting_with_me', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_say_im_sorry', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_compliment', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_hey_sexy_how_you_doin', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_praise', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_tell_naughty_joke', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_say_i_love_you', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_i_dont_want_to_be_friends', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_share_secrets', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_hang_out', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_play_with', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_pat_on_back', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_braid_hair', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_shake_hands', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_rub_elbows', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_hug', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_tickle', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_buy_a_drink', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_stroll_hand_in_hand', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_flex_biceps', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_caress', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_ask_for_a_dance', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_high_five', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_arm_wrestle', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_kiss_cheeks', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_embrace', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_kiss', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_kiss_passionately', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_give_massage', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_bless', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_do_funny_magic', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_tell_joke', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_seek_apprenticeship', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_sing_to', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_serenade', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_exclude_id', 'default': [], 'save_cb': saveCSVString, 'load_cb': loadCSVstring },
    { 'name': 'mass_interact_max_chars', 'default': 99, 'save_cb': saveInteger, 'load_cb': loadInteger },
    { 'name': 'mass_interact_ignore_acquaintance', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    
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

function loadInteger(optionName, optionValue) {
    let formElem = document.getElementById(optionName);

    if (formElem != null) {
        formElem.value = parseInt(optionValue);
    }
}

function saveInteger(optionName, defaultVaule) {
    let result = parseInt(defaultVaule);

    let intElem = document.getElementById(optionName);
    if (intElem != null) {
        result = parseInt(intElem.value);
    }

    return result;
}

function saveSelect(optionName, optionValue) {
    let result = String(optionValue);

    let formElem = document.getElementById(optionName);
    if (formElem != null) {
        result = String(formElem.value)
    }

    return result;

}

function loadSelect(optionName, optionValue) {
    let formElem = document.getElementById(optionName);

    if (formElem != null) {
        formElem.value = String(optionValue);
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
