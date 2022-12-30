const scoringOptionsValues = { 'redirect_to_login': true };

//e.g. https://74.popmundo.com/Default.aspx
const loginURLRegex = /\d{2,}\.popmundo.com\/Default.aspx(\?logout=true){0,1}/gm;

function redirectToLoginPage() {

    var notifications = new Notifications();
    notifications.hideAll();
    notifications.notifySuccess("Redirecting to to standard login page...");

    window.setTimeout(() => { window.location.href = "http://www.popmundo.com"; }, 1000);
}

// When page is loaded we get value from settings and we trigger the logic if the redirect option is enabled
debugger;
if (loginURLRegex.test(window.location.href)) {
    chrome.storage.sync.get(scoringOptionsValues, items => {
        if (items.redirect_to_login) redirectToLoginPage();
    });
}
