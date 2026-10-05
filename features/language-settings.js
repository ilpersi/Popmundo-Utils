// On the language settings page we keep the cached game language up to date (see Utils.getGameLanguage).
(async () => {
    const language = Utils.parseGameLanguage(document);
    if (language) {
        await Utils.setGameLanguage(language);
    }
})();
