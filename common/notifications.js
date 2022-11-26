class Notifications {
    #containerNode;

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
     * @param {string} [textContent=null] The text of the notification.
     * @return {Element|null} The newly created notification div is the notification bar is available, null otherwise.
     * @memberof Notifications
     */
    createNotification(level, textContent = null) {

        if (this.containerNode) {
            var newDiv = document.createElement('div');

            if ('success' === level)
                newDiv.setAttribute("class", "notification-real notification-success");
            else if ('error' === level)
                newDiv.setAttribute("class", "notification-real notification-error");
            else if ('normal' === level)
                newDiv.setAttribute("class", "notification-real notification-normal");
            else {
                throw 'Unknown notification level: ' + level;
            }

            newDiv.setAttribute("null", "");

            if (textContent)
                newDiv.textContent = textContent;

            this.containerNode.appendChild(newDiv);
            debugger;

            return newDiv;
        } else {
            alert(textContent);
            return null;
        }
    }

    /**
     * Create a success notification: the bar will be green.
     *
     * @param {string} [textContent=null] The text of the notification.
     * @return {Element|null} The newly created notification div is the notification bar is available, null otherwise. 
     * @memberof Notifications
     */
    notifySuccess(textContent = null) {
        return this.createNotification('success', textContent);
    }

    /**
     * Create an error notification: the bar will be red.
     *
     * @param {*} [textContent=null] The text of the notification.
     * @return {Element|null} The newly created notification div is the notification bar is available, null otherwise. 
     * @memberof Notifications
     */
    notifyError(textContent = null) {
        return this.createNotification('error', textContent);
    }

    /**
     * Create a normal notification: the bar will be gray.
     *
     * @param {*} [textContent=null] The text of the notification.
     * @return {Element|null} The newly created notification div is the notification bar is available, null otherwise. 
     * @memberof Notifications
     */
    notifyNormal(textContent = null) {
        return this.createNotification('normal', textContent);
    }
}