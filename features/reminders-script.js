/**
 * Get day of the year and year number for a specific data
 *
 * @param {Date} [date=new Date()] The input date 
 * @return {object} An object with two keys 'year' for the number of the year and 'day' for the number of the day
 */
 function getDayDetails(date = new Date()) {

    const YEAR_DAYS = 56;
    const DAY_DURATION = 1000 * 60 * 60 * 24;
    const DAY1 = new Date(2003, 0, 1, 0, 0, 0);

    let yesterday = new Date(date - DAY_DURATION);
    // we make sure we do not include current day in computations
    yesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);

    // We cound the difference in days sinche the beginning. We make sure to add one to include today in the computation
    let dayDifference = Math.ceil((yesterday - DAY1) / (DAY_DURATION)) + 1;
    let yearNumber = Math.ceil(dayDifference / YEAR_DAYS);
    
    // As we use module operator, on day 56 we get 0
    let dayOfYear = parseInt(dayDifference % YEAR_DAYS);
    dayOfYear = dayOfYear === 0 ? 56 : dayOfYear;

    // console.log('Day ' + dayOfYear + ' of year ' + yearNumber);
    return { year: yearNumber, day: dayOfYear };

}

function checkReminders() {

    let dateDetails = getDayDetails();
    let todayStr = `Today is day ${dateDetails.day} of year ${dateDetails.year}.`;

    const REMINDERS = [
        { dayNumber: 27, reminder: `Remember to get Stockholm cemetery to get 2 experince points.` },
        { dayNumber: 28, reminder: `Is the Day of the Dead!` },
        { dayNumber: 40, reminder: `Is St Kobe's Day! Investigate the Statues of Celestial Beauty in Johannesburg, Moscow, Singapore, and Tromsø to go on a adventurous quest for improved music genre skills.` },
        { dayNumber: 48, reminder: `Remember to user your Halloween Horror!` },
        { dayNumber: 52, reminder: `Is Chirsmast!` },
        { dayNumber: 54, reminder: `Remember to wear your Marvin T-Shirt to increase your star quality and get one experince point.` },
    ];

    let notificationData = [];
    REMINDERS.forEach((info) => {
        if (info.dayNumber == dateDetails.day) {
            let details = {
                type: 'text',
                content: `${todayStr} ${info.reminder}` ,
            };

            notificationData.push(details);
        }
    });

    let notifications = new Notifications();
    notifications.deleteAll();

    notificationData.forEach((details) => {
        notifications.notifySuccess(details.content);
    });

    console.log(dateDetails);
}

checkReminders();