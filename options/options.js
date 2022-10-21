const checkBoxes = ['searchable_tables', 'progress_bar_percent', 'recent_progress_popup', 'score_highlight', 'move_to_shortcut'];

// Saves options to chrome.storage
function save_options() {
    let cbSave = {};

    checkBoxes.forEach(cbName => {
        let cbValue = document.getElementById(cbName).checked; 
        cbSave[cbName] = cbValue;
    });

    chrome.storage.sync.set(cbSave, function () {
        // Update status to let user know options were saved.
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function () {
            status.textContent = '';
        }, 750);
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
    let defaultCheckBoxes = {};
    checkBoxes.forEach(cbName => { defaultCheckBoxes[cbName] = true });

    // Use default value color = 'red' and likesColor = true.
    chrome.storage.sync.get(defaultCheckBoxes, items => {
        for (cbName in items) {
            document.getElementById(cbName).checked = items[cbName];
        }
    });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
