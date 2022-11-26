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

    createNotification (level, textContent = null) {
        
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

        return newDiv;
    }

    notifySuccess (textContent = null) {
        return this.createNotification('success', textContent);
    }

    notifyError (textContent = null) {
        return this.createNotification('error', textContent);
    }

    notifyNormal (textContent = null) {
        return this.createNotification('normal', textContent);
    }
}