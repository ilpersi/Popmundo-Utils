// Collects the game's own names of the interactions from the Interact page that the user has just opened.
// The logic is in common/interaction-collector.js: Mass Interact and Call All Friends use the same class on the
// pages they fetch.
(async () => {
    try {
        await Logger.init();
        await InteractionCollector.collect(document);
    } catch (e) {
        Logger.warn('Interaction collector failed', e);
    }
})();
