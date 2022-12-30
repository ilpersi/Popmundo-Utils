class Utils {
    static getMyID() {
        let idHolderElem = document.querySelector('div.idHolder');

        return idHolderElem ? parseInt(idHolderElem.textContent) : 0;
    }
}