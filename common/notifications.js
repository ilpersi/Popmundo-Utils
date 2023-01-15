class Notifications {
    #containerNode;

    static LEVELS = {
        ERROR: 'error',
        SUCCESS: 'success',
        NORMAL: 'normal',
    }

    constructor() {
        this.containerNode = document.getElementById('notifications');
    }

    /**
     * Hide all the currently visible notifications in the main notification DIV
     *
     * @memberof Notifications
     */
    hideAll() {
        for (var child = this.containerNode.firstChild; child !== null; child = child.nextSibling) {
            if ('DIV' === child.tagName) {
                if (child.getAttribute('style'))
                    child.setAttribute('style', child.getAttribute('style') + ' display:none;');
                else
                    child.setAttribute('style', 'display:none;');
            }
        }

    }

    /**
     * Delete all the currently visible notifications in the main notification DIV
     *
     * @memberof Notifications
     */
    deleteAll() {
        while (this.containerNode.firstChild) {
            this.containerNode.removeChild(this.containerNode.lastChild);
        }
    }

    /**
     * Notify the user within the game. If it is not possible to find the notificatin bar, a standard alert is raised.
     *
     * @param {string} level The type of notification: three possible values: success, error, normal. If wront type is provided, an exception will be triggered.
     * @param {string|int} [id] The id that will be used to create the div
     * @param {string} [textContent=null] The text of the notification.
     * @return {Element|null} The newly created notification div is the notification bar is available, null otherwise.
     * @memberof Notifications
     */
    createNotification(level, id = null, textContent = null) {

        if (this.containerNode) {
            var newDiv = document.createElement('div');

            if (Notifications.LEVELS.SUCCESS === level)
                newDiv.setAttribute("class", "notification-real notification-success");
            else if (Notifications.LEVELS.ERROR === level)
                newDiv.setAttribute("class", "notification-real notification-error");
            else if (Notifications.LEVELS.NORMAL === level)
                newDiv.setAttribute("class", "notification-real notification-normal");
            else {
                throw 'Unknown notification level: ' + level;
            }

            newDiv.setAttribute("null", "");

            if (id)
                newDiv.setAttribute('id', id);

            if (textContent)
                newDiv.textContent = textContent;

            this.containerNode.appendChild(newDiv);

            return newDiv;
        } else {
            alert(textContent);
            return null;
        }
    }

    /**
     * Create a success notification: the bar will be green.
     *
     * @param {string|int} [id] The id that will be used to create the notification div
     * @param {string} [textContent=null] The text of the notification.
     * @return {Element|null} The newly created notification div is the notification bar is available, null otherwise. 
     * @memberof Notifications
     */
    notifySuccess(id = null, textContent = null) {
        return this.createNotification(Notifications.LEVELS.SUCCESS, id, textContent);
    }

    /**
     * Create an error notification: the bar will be red.
     *
     * @param {string|int} [id] The id that will be used to create the notification div
     * @param {string} [textContent=null] The text of the notification.
     * @return {Element|null} The newly created notification div is the notification bar is available, null otherwise. 
     * @memberof Notifications
     */
    notifyError(id = null, textContent = null) {
        return this.createNotification(Notifications.LEVELS.ERROR, id, textContent);
    }

    /**
     * Create a normal notification: the bar will be gray.
     *
     * @param {string|int} [id] The id that will be used to create the notification div
     * @param {*} [textContent=null] The text of the notification.
     * @return {Element|null} The newly created notification div is the notification bar is available, null otherwise. 
     * @memberof Notifications
     */
    notifyNormal(id = null, textContent = null) {
        return this.createNotification(Notifications.LEVELS.NORMAL, id, textContent);
    }

    /**
     * Get all the notifications currently displayed in the notification bar
     *
     * @param {string} level
     * @return {string[]} 
     * @memberof Notifications
     */
    getNotificationsAsText(level = null) {
        const CLASS_PREFIX = 'notification-';
        let results = [];

        let className = CLASS_PREFIX + level;
        for (var child = this.containerNode.firstChild; child !== null; child = child.nextSibling) {
            if ('DIV' === child.tagName) {
                let divClass = child.getAttribute('class');

                if ((level !== null && divClass.includes(className)) || (level === null && divClass.includes(CLASS_PREFIX))) {
                    results.push(child.textContent);
                }
            }
        }

        return results;
    }

    /**
     * Get all the success notifications currently present on screen.
     *
     * @return {string[]} An array of strings with notifications' text 
     * @memberof Notifications
     */
    getSuccessesAsText() {
        return this.getNotificationsAsText(Notifications.LEVELS.SUCCESS);
    }

    /**
     * Get all the error notifications currently present on screen.
     *
     * @return {string[]} An array of strings with notifications' text 
     * @memberof Notifications
     */
    getErrorsAsText() {
        return this.getNotificationsAsText(Notifications.LEVELS.ERROR);
    }

    /**
     * Get all the normal notifications currently present on screen.
     *
     * @return {string[]} An array of strings with notifications' text 
     * @memberof Notifications
     */
    getNormalsAsText() {
        return this.getNotificationsAsText(Notifications.LEVELS.NORMAL);
    }
}