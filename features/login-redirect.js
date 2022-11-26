const scoringOptionsValues = { 'redirect_to_login': true };

//e.g. https://74.popmundo.com/Default.aspx
const loginURLRegex = /\d{2,}\.popmundo.com\/Default.aspx/gm;

function redirectToLoginPage() {

    // We want to be sure that we do not trigger and infinite redirect loop
    var notificationDiv = document.getElementById('notifications')

    if (notificationDiv) {
        var newDiv = document.createElement('div');
        newDiv.setAttribute("class", "notification-real notification-success");
        newDiv.setAttribute("null", "");
        newDiv.textContent = "Redirecting to to standard login page...";

        for(var child=notificationDiv.firstChild; child!==null; child=child.nextSibling) {
            if ('DIV' === child.tagName) {
                if (child.getAttribute('style'))
                    child.setAttribute('style', child.getAttribute('style') + ' display:none;');
                else
                child.setAttribute('style', 'display:none;');
            }
        }

        notificationDiv.appendChild(newDiv);

        window.setTimeout(() => { window.location.href = "http://www.popmundo.com"; }, 1000);
    }

}

// When page is loaded we get value from settings and we trigger the logic if the redirect option is enabled
if (loginURLRegex.test(window.location.href)) {
    chrome.storage.sync.get(scoringOptionsValues, items => {
        if (items.redirect_to_login) redirectToLoginPage();
    });
}
