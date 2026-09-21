/**
 * Attribute Export (Popmundo Bible)
 *
 * Adds an opt-in "Export attributes (JSON)" button to the in-game Character
 * Attributes page (https://<server>.popmundo.com/World/Popmundo.aspx/Character/Health/<id>).
 * When clicked it scrapes the visible attributes table and downloads a JSON
 * file ready to import into https://popmundo-bible.net.
 *
 * The feature is disabled by default and enabled from Misc Options
 * (`attribute_export_enable` in chrome.storage.sync).
 *
 * Output shape:
 *   {
 *     "character_name": "Homer Garnett",
 *     "character_id": 572434,
 *     "character_picture": "https://i.ibb.co/rKdhPFcv/Sofia.png",
 *     "game": "ppm",
 *     "attributes": [
 *       { "name": "Charm", "local_name": "Charm", "score": 21, "score_label": "perfect" }
 *     ]
 *   }
 */
(function () {
    'use strict';

    const CHAR_ID_SELECTOR = '#ppm-content > div.box.ofauto.charPresBox > div.avatar.pointer.idTrigger > div';
    const CHAR_NAME_SELECTOR = '#ppm-content > div.box.ofauto.charPresBox > h2';
    const ATTRIBUTE_LINK_SELECTOR = 'a[href*="/World/Popmundo.aspx/Help/Attributes"]';
    const SCORE_LINK_SELECTOR = 'a[href*="/World/Popmundo.aspx/Help/Scoring/"]';
    const SCORE_HREF_RE = /\/Help\/Scoring\/(\d+)/;

    const POPMUNDO_ATTRIBUTE_NAMES = ['Charm', 'Looks', 'Voice', 'Musicality', 'Intelligence', 'Constitution', 'Strength', 'Dexterity'];
    const GREAT_HEIST_ATTRIBUTE_NAMES = ['Charm', 'Looks', 'Intelligence', 'Constitution', 'Strength', 'Dexterity'];

    const notifications = new Notifications();

    /**
     * Reads the current character's {id, name, pictureUrl, game} from the presentation box.
     *
     * @return {{id: number, name: string, pictureUrl: string, game: string}} id is 0 when it cannot be parsed.
     */
    function getCharacterDetails() {
        const idNode = new CssSelectorHelper(CHAR_ID_SELECTOR).getSingle();
        const nameNode = new CssSelectorHelper(CHAR_NAME_SELECTOR).getSingle();

        const id = idNode ? parseInt(idNode.textContent.trim(), 10) : 0;
        const name = nameNode ? nameNode.textContent.trim() : '';
        const pictureUrl = Utils.getCharacterPictureURL();
        const game = Utils.getGameCode();

        return { id: Number.isFinite(id) ? id : 0, name, pictureUrl, game };
    }

    /**
     * The ordered hard-coded attribute names for the current game flavor.
     *
     * @return {string[]}
     */
    function getExpectedAttributeNames() {
        return Utils.isGreatHeist() ? GREAT_HEIST_ATTRIBUTE_NAMES : POPMUNDO_ATTRIBUTE_NAMES;
    }

    /**
     * Scrapes every attribute row on the page, matching each attribute link to the
     * hard-coded name at the same position (the game always renders attributes in
     * the fixed order documented for Popmundo / The Great Heist).
     *
     * @return {{attributes: Array<{name: string, local_name: string, score: number, score_label: string}>|null, error: 'count'|'score'|null}}
     */
    function collectAttributes() {
        const expectedNames = getExpectedAttributeNames();
        const links = new CssSelectorHelper(ATTRIBUTE_LINK_SELECTOR).getAll();

        // Either the game flavor could not be identified reliably, or the page
        // does not carry the exact number of attributes we expect for it.
        if (links.length !== expectedNames.length) {
            return { attributes: null, error: 'count' };
        }

        const attributes = [];
        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            const row = link.closest('tr');
            const scoreLink = row ? new CssSelectorHelper(SCORE_LINK_SELECTOR, row).getSingle() : null;

            if (!scoreLink) {
                return { attributes: null, error: 'score' };
            }

            const hrefMatch = SCORE_HREF_RE.exec(scoreLink.getAttribute('href') || '');
            const score = hrefMatch ? parseInt(hrefMatch[1], 10) : NaN;

            if (!Number.isFinite(score) || score < 1 || score > 27) {
                return { attributes: null, error: 'score' };
            }

            attributes.push({
                name: expectedNames[i],
                local_name: link.textContent.trim(),
                score: score,
                score_label: scoreLink.textContent.trim(),
            });
        }

        return { attributes, error: null };
    }

    /**
     * Turns a character name into a filesystem-friendly slug.
     *
     * @param {string} name
     * @return {string}
     */
    function slugify(name) {
        // NFKD splits accented letters into base + combining mark; the
        // subsequent non-alphanumeric strip then removes those marks too
        // (e.g. "Andrew Kovač" -> "Andrew_Kovac").
        return (name || '')
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    /**
     * Triggers a browser download of the given text as a file.
     *
     * @param {string} filename
     * @param {string} text
     */
    function downloadTextFile(filename, text) {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        // Give the browser a tick to start the download before revoking.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * Builds the payload, downloads it and notifies the user.
     */
    function exportAttributes() {
        const { id, name, pictureUrl, game } = getCharacterDetails();
        if (!id) {
            notifications.notifyError(null, chrome.i18n.getMessage('attributeExportCharError'));
            return;
        }

        const { attributes, error } = collectAttributes();
        if (error === 'count') {
            notifications.notifyError(null, chrome.i18n.getMessage('attributeExportInvalidCount'));
            return;
        }
        if (error === 'score') {
            notifications.notifyError(null, chrome.i18n.getMessage('attributeExportInvalidScore'));
            return;
        }
        if (!attributes || attributes.length === 0) {
            notifications.notifyError(null, chrome.i18n.getMessage('attributeExportInvalidCount'));
            return;
        }

        const payload = {
            character_name: name,
            character_id: id,
            character_picture: pictureUrl,
            game: game,
            attributes: attributes,
        };

        const filename = `popmundo_attributes_${id}_${slugify(name)}.json`;
        downloadTextFile(filename, JSON.stringify(payload, null, 2));

        notifications.notifySuccess(
            null,
            chrome.i18n.getMessage('attributeExportSuccess', [String(attributes.length), name])
        );
    }

    /**
     * Injects the export button below the attributes table.
     */
    function injectButton() {
        if (document.getElementById('pm-attribute-export-btn')) return;

        const firstLink = new CssSelectorHelper(ATTRIBUTE_LINK_SELECTOR).getSingle();
        const table = firstLink ? firstLink.closest('table') : null;
        if (!table) return;

        const row = document.createElement('p');
        row.className = 'actionbuttons';

        const button = document.createElement('input');
        button.type = 'submit';
        button.className = 'cns';
        button.id = 'pm-attribute-export-btn';
        button.value = chrome.i18n.getMessage('attributeExportButton');
        button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            exportAttributes();
        });

        row.appendChild(button);
        table.parentNode.insertBefore(row, table.nextSibling);
    }

    chrome.storage.sync.get({ attribute_export_enable: false }, function (items) {
        if (!items.attribute_export_enable) return;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectButton);
        } else {
            injectButton();
        }
    });
})();
