function checkForTimer() {
    // Timer Regex
    const minRegex = /(\d{1,})\s+minutes/gi;
    const hourRegex = /(\d{1,})\s+hours/gi;
    const daysRegex = /(\d{1,})\s+days/gi;
    const weeksRegex = /(\d{1,})\s+weeks/gi;

    // URL Regex for item id
    const itemIDRegex = /\d{2}.popmundo.com\/World\/Popmundo.aspx\/Character\/ItemDetails\/(\d+)/gi;

    // We initialize the varibles we need later on
    let minutes, hours, days, weeks, itemID;
    
    // We get the timer
    let notifications = new Notifications();
    let errors = notifications.getErrorsAsText();

    // debugger;

    if (errors.length > 0) {
        let idMatch = itemIDRegex.exec(window.location.href);
        itemID = idMatch ? parseInt(idMatch[1]) : 0;

        errors.forEach(errorTxt => {
            let minMatch = minRegex.exec(errorTxt);
            let hourMatch = hourRegex.exec(errorTxt);
            let daysMatch = daysRegex.exec(errorTxt);
            let weeksMatch = weeksRegex.exec(errorTxt);

            minutes = minMatch ? parseInt(minMatch[1]) : 0;
            hours = hourMatch ? parseInt(hourMatch[1]) : 0;
            days = daysMatch ? parseInt(daysMatch[1]) : 0;
            weeks= weeksMatch ? parseInt(weeksMatch[1]) : 0;
        });



    }

}

window.setTimeout(() => { checkForTimer(); }, 2000);