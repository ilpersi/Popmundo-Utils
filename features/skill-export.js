/**
 * Skill Export (Popmundo Bible)
 *
 * Adds an opt-in "Export skills (JSON)" button to the in-game Character Skills
 * page (https://<server>.popmundo.com/World/Popmundo.aspx/Character/Skills/<id>).
 * When clicked it scrapes the visible skill table and downloads a JSON file
 * ready to import into https://popmundo-bible.net.
 *
 * The feature is disabled by default and enabled from Misc Options
 * (`skill_export_enable` in chrome.storage.sync).
 *
 * Output shape:
 *   {
 *     "character_name": "Andrew Kovač",
 *     "character_id": 3598202,
 *     "skills": [ { "name": "Rock", "id": 35, "value": 1.5 } ]
 *   }
 */
(function () {
    'use strict';

    const CHAR_ID_SELECTOR = '#ppm-content > div.box.ofauto.charPresBox > div.avatar.pointer.idTrigger > div';
    const CHAR_NAME_SELECTOR = '#ppm-content > div.box.ofauto.charPresBox > h2';
    const SAVE_ROW_SELECTOR = '#ctl00_cphLeftColumn_ctl00_pgfSaveSkills';
    const SKILL_LINK_SELECTOR = 'a[href*="/World/Popmundo.aspx/Help/SkillType/"]';

    const notifications = new Notifications();

    /**
     * Reads the current character's {id, name} from the presentation box.
     *
     * @return {{id: number, name: string}} id is 0 when it cannot be parsed.
     */
    function getCharacterDetails() {
        const idNode = new CssSelectorHelper(CHAR_ID_SELECTOR).getSingle();
        const nameNode = new CssSelectorHelper(CHAR_NAME_SELECTOR).getSingle();

        const id = idNode ? parseInt(idNode.textContent.trim(), 10) : 0;
        const name = nameNode ? nameNode.textContent.trim() : '';

        return { id: Number.isFinite(id) ? id : 0, name };
    }

    /**
     * Extracts the skill value (0 .. 5, half steps) from the value cell of a
     * skill row. The cell holds a `drawStarCount(gold, half, grey, …)` call:
     * the first argument is the integer part, the second is 1 when the half
     * star is present.
     *
     * @param {Element} valueTd The `<td>` sibling that contains the star script.
     * @return {number|null} The skill value, or null when it cannot be parsed.
     */
    function parseSkillValue(valueTd) {
        if (!valueTd) return null;

        // Primary: reuse the shared regex that matches the full <script> tag.
        const re = Utils.starsJSRE;
        re.lastIndex = 0;
        const match = re.exec(valueTd.innerHTML);
        if (match && match.groups) {
            const gold = parseInt(match.groups.goldStars, 10);
            const half = parseInt(match.groups.whiteStars, 10);
            if (Number.isFinite(gold)) {
                return gold + (half >= 1 ? 0.5 : 0);
            }
        }

        // Fallback: parse the raw drawStarCount() call from any script element,
        // in case innerHTML serialisation does not match the strict regex.
        const scripts = new CssSelectorHelper('script', valueTd).getAll();
        for (const script of scripts) {
            const callMatch = /drawStarCount\(\s*(\d+)\s*,\s*(\d+)/.exec(script.textContent || '');
            if (callMatch) {
                const gold = parseInt(callMatch[1], 10);
                const half = parseInt(callMatch[2], 10);
                if (Number.isFinite(gold)) {
                    return gold + (half >= 1 ? 0.5 : 0);
                }
            }
        }

        return null;
    }

    /**
     * Finds the value cell for a skill link: normally the next `<td>` after the
     * one holding the link, but fall back to scanning the row for a cell that
     * carries a drawStarCount call.
     *
     * @param {HTMLAnchorElement} linkEl
     * @return {Element|null}
     */
    function findValueCell(linkEl) {
        const linkTd = linkEl.closest('td');
        if (linkTd && linkTd.nextElementSibling && linkTd.nextElementSibling.tagName === 'TD') {
            return linkTd.nextElementSibling;
        }
        const row = linkEl.closest('tr');
        if (row) {
            for (const td of row.querySelectorAll('td')) {
                if (td !== linkTd && /drawStarCount\(/.test(td.innerHTML)) {
                    return td;
                }
            }
        }
        return null;
    }

    /**
     * Scrapes every skill row on the page.
     *
     * @return {{skills: Array<{name: string, id: number, value: number}>, skipped: string[]}}
     */
    function collectSkills() {
        const skills = [];
        const skipped = [];

        const links = new CssSelectorHelper(SKILL_LINK_SELECTOR).getAll();
        for (const link of links) {
            const href = link.getAttribute('href') || '';
            const idMatch = /\/Help\/SkillType\/(\d+)/.exec(href);
            if (!idMatch) continue;

            const id = parseInt(idMatch[1], 10);

            // The trailing " *" only marks the skill currently being improved;
            // it is not part of the skill name.
            const name = link.textContent.trim().replace(/\s*\*\s*$/, '');

            const value = parseSkillValue(findValueCell(link));
            if (value === null) {
                skipped.push(name);
                continue;
            }

            skills.push({ name, id, value });
        }

        return { skills, skipped };
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
    function exportSkills() {
        const { id, name } = getCharacterDetails();
        if (!id) {
            notifications.notifyError(null, chrome.i18n.getMessage('skillExportError'));
            return;
        }

        const { skills, skipped } = collectSkills();
        if (skills.length === 0) {
            notifications.notifyError(null, chrome.i18n.getMessage('skillExportNoSkills'));
            return;
        }

        const payload = {
            character_name: name,
            character_id: id,
            skills: skills,
        };

        const filename = `popmundo_skills_${id}_${slugify(name)}.json`;
        downloadTextFile(filename, JSON.stringify(payload, null, 2));

        notifications.notifySuccess(
            null,
            chrome.i18n.getMessage('skillExportSuccess', [String(skills.length), name])
        );

        if (skipped.length > 0) {
            notifications.notifyError(
                null,
                chrome.i18n.getMessage('skillExportPartial', [String(skipped.length), skipped.join(', ')])
            );
        }
    }

    /**
     * Injects the export button after the skills table.
     */
    function injectButton() {
        const saveRow = new CssSelectorHelper(SAVE_ROW_SELECTOR).getSingle();
        if (!saveRow) return;
        if (document.getElementById('pm-skill-export-btn')) return;

        const row = document.createElement('p');
        row.className = 'actionbuttons';

        const button = document.createElement('input');
        button.type = 'submit';
        button.className = 'cns';
        button.id = 'pm-skill-export-btn';
        button.value = chrome.i18n.getMessage('skillExportButton');
        button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            exportSkills();
        });

        row.appendChild(button);
        saveRow.parentNode.insertBefore(row, saveRow.nextSibling);
    }

    chrome.storage.sync.get({ skill_export_enable: false }, function (items) {
        if (!items.skill_export_enable) return;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectButton);
        } else {
            injectButton();
        }
    });
})();
