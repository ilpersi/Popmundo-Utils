(function () {
    'use strict';
    let timeInFirstCollect = 0;
    let firstBookTimestamp = null;
    let minuteDelay = 5; // Delay padrão de 5 minutos
    let remainingDelay = 0;
    let firstBookId = 0;
    let indexPeopleBloc = 0;
    let fixedBookIds = [];
    let isProcessingBlock = false; // Para evitar múltiplas chamadas ao temporizador
    let continuaColeta = false;

    const fetcher = new TimedFetch(false);

    const STORAGE_KEYS = {
        BOOK_NAME: 'autograph_book_name',
        BLOCKED_CHARS: 'chars-block-itens'
    };

    function getBlockedChars() {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEYS.BLOCKED_CHARS], (items) => {
                const blocked = items[STORAGE_KEYS.BLOCKED_CHARS];
                resolve(Array.isArray(blocked) ? blocked : []);
            });
        });
    }

    function setBlockedChars(blockedChars) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_CHARS]: blockedChars }, resolve);
        });
    }

    function getBookName() {
        return new Promise((resolve) => {
            chrome.storage.sync.get([STORAGE_KEYS.BOOK_NAME], (items) => {
                resolve(items[STORAGE_KEYS.BOOK_NAME] || 'Livro de autógrafos');
            });
        });
    }

    // Função para coletar as pessoas
    async function getPeopleToCollect() {
        let people = [];
        const hostName = window.location.hostname;
        const peopleOnlineUrl = `https://${hostName}/World/Popmundo.aspx/City/PeopleOnline/`;

        try {
            // Passo 1: GET inicial para obter o formulário
            const html = await fetcher.fetch(peopleOnlineUrl, { method: "GET" });

            // Passo 2: Parse HTML e extrair FormData
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const docForm = doc.getElementById('aspnetForm');

            if (!docForm) {
                throw new Error("Form 'aspnetForm' not found in page.");
            }

            const formDataOrig = new FormData(docForm);

            // Passo 3: Configurar valores do formulário
            formDataOrig.set('ctl00$cphLeftColumn$ctl00$btnFilter', doc.getElementById('ctl00_cphLeftColumn_ctl00_btnFilter').value);
            formDataOrig.set('__EVENTTARGET', '');
            formDataOrig.set('__EVENTARGUMENT', '');
            formDataOrig.set('ctl00$cphLeftColumn$ctl00$chkAutograph', 'on');

            if (formDataOrig.has('ctl00$cphLeftColumn$ctl00$chkOnline')) {
                formDataOrig.delete('ctl00$cphLeftColumn$ctl00$chkOnline');
            }
            if (formDataOrig.has('ctl00$cphLeftColumn$ctl00$chkGame')) {
                formDataOrig.delete('ctl00$cphLeftColumn$ctl00$chkGame');
            }
            if (formDataOrig.has('ctl00$cphLeftColumn$ctl00$chkRelationships')) {
                formDataOrig.delete('ctl00$cphLeftColumn$ctl00$chkRelationships');
            }

            // Passo 4: POST com FormData configurado
            const postHtml = await fetcher.fetch(peopleOnlineUrl, {
                method: "POST",
                body: formDataOrig
            });

            const postDoc = parser.parseFromString(postHtml, "text/html");

            // Passo 5: Extrair pessoas da tabela (independente de idioma)
            const peopleTable = postDoc.querySelector('#tablepeople');

            if (peopleTable) {
                Array.from(peopleTable.querySelectorAll('tbody tr')).forEach(row => {
                    const characterLink = row.querySelector('a');
                    const statusCell = row.querySelectorAll('td')[1];
                    const statusText = statusCell ? statusCell.textContent.trim() : '';
                    const isAvailable = !statusText || statusText === '';

                    if (isAvailable && characterLink) {
                        const href = characterLink.getAttribute('href');
                        const characterId = href.split('/').pop();

                        people.push({
                            name: characterLink.textContent.trim(),
                            id: characterId,
                            status: 'Disponível'
                        });
                    }
                });
            }
            console.log(people);
            return people;
        } catch (error) {
            console.error('Error in getPeopleToCollect:', error);
            throw error;
        }
    }


    const LOG_TYPE_COLORS = {
        info: '#1976d2',
        warning: '#f9a825',
        error: '#d32f2f'
    };

    let LOG_INDEX = 0;
    function log(data, type = 'info') {
        if (window.parent === window) {
            const now = new Date();
            const time = now.toLocaleTimeString();
            const typeColor = LOG_TYPE_COLORS[type] || LOG_TYPE_COLORS.info;
            const typeCell = `<span style="color: ${typeColor}; font-weight: 600;" drinkwater>${type}</span>`;
            jQuery("#logs-autografos tbody").append(`<tr class="${LOG_INDEX % 2 === 0 ? "odd" : "even"}" drinkwater><td drinkwater>${time}</td><td drinkwater>${typeCell}</td><td drinkwater>${data}</td></tr>`);
            LOG_INDEX++;
        }
    }


    async function goToLocation(charId, charName) {
        const hostName = window.location.hostname;
        const characterUrl = `https://${hostName}/World/Popmundo.aspx/Character/${charId}`;
        let finalUrl = null;

        try {
            // Passo 1: GET inicial da página do personagem via HTTP
            const html = await fetcher.fetch(characterUrl, { method: "GET" });

            // Passo 2: Parse HTML com DOMParser
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Passo 3: Detectar método de navegação e executar
            const linkInteract = doc.querySelector('#ctl00_cphRightColumn_ctl00_lnkInteract');
            const btnInteract = doc.querySelector('#ctl00_cphRightColumn_ctl00_btnInteract');

            if (linkInteract) {
                const href = linkInteract.getAttribute('href');
                if (href && !href.startsWith('javascript:')) {
                    finalUrl = href.startsWith('http') ? href : `https://${hostName}${href}`;
                    await fetcher.fetch(finalUrl, { method: "GET" });
                    log(`Moving to location of <b>${charName}</b>`, 'info');
                    return;
                }
            }

            if (btnInteract) {
                const btnHref = btnInteract.getAttribute('href');

                if (btnHref && !btnHref.startsWith('javascript:')) {
                    finalUrl = btnHref.startsWith('http') ? btnHref : `https://${hostName}${btnHref}`;
                    await fetcher.fetch(finalUrl, { method: "GET" });
                    log(`Moving to location of <b>${charName}</b>`, 'info');
                    return;
                }

                if (btnHref && btnHref.includes('__doPostBack')) {
                    const doPostBackMatch = btnHref.match(/javascript:__doPostBack\('([^']+?)','([^']*?)'\)/);
                    if (doPostBackMatch) {
                        const eventTarget = doPostBackMatch[1];
                        const eventArgument = doPostBackMatch[2] || '';

                        const form = doc.getElementById('aspnetForm');
                        if (form) {
                            const formData = new FormData(form);
                            formData.set('__EVENTTARGET', eventTarget);
                            formData.set('__EVENTARGUMENT', eventArgument);

                            const postHtml = await fetcher.fetch(characterUrl, {
                                method: "POST",
                                body: formData
                            });

                            const postDoc = parser.parseFromString(postHtml, "text/html");
                            const redirectLink = postDoc.querySelector('#ctl00_cphRightColumn_ctl00_lnkInteract')?.getAttribute('href') ||
                                postDoc.querySelector('a[href*="/Locale/MoveToLocale/"]')?.getAttribute('href');

                            if (redirectLink && !redirectLink.startsWith('javascript:')) {
                                finalUrl = redirectLink.startsWith('http') ? redirectLink : `https://${hostName}${redirectLink}`;
                            } else {
                                finalUrl = characterUrl;
                            }
                            log(`Moving to location of <b>${charName}</b>`, 'info');
                            return;
                        }
                    }
                }

                if (btnInteract.type === 'submit' || btnInteract.tagName.toLowerCase() === 'button') {
                    const form = btnInteract.closest('form') || doc.getElementById('aspnetForm');
                    if (form) {
                        const formData = new FormData(form);
                        const btnName = btnInteract.getAttribute('name');
                        const btnValue = btnInteract.getAttribute('value') || '';

                        if (btnName) {
                            formData.set(btnName, btnValue);
                        }

                        const formAction = form.getAttribute('action') || characterUrl;
                        const postUrl = formAction.startsWith('http') ? formAction : `https://${hostName}${formAction}`;

                        const postHtml = await fetcher.fetch(postUrl, {
                            method: "POST",
                            body: formData
                        });

                        const postDoc = parser.parseFromString(postHtml, "text/html");
                        log(`Moving to location of <b>${charName}</b>`, 'info');
                        return;
                    }
                }
            }

            const characterPresentation = doc.querySelector('.characterPresentation');
            if (characterPresentation) {
                const links = characterPresentation.querySelectorAll('a');
                if (links.length > 0) {
                    const lastLink = links[links.length - 1];
                    const href = lastLink.getAttribute('href');
                    if (href) {
                        const locationId = href.split('/').pop();
                        if (locationId) {
                            finalUrl = `https://${hostName}/World/Popmundo.aspx/Locale/MoveToLocale/${locationId}/${charId}`;
                            await fetcher.fetch(finalUrl, { method: "GET" });
                            log(`Moving to location of <b>${charName}</b>`, 'info');
                            return;
                        }
                    }
                }
            }

            let locationLink = linkInteract?.getAttribute('href') || btnInteract?.getAttribute('href');
            if (locationLink && locationLink.startsWith('javascript:') && !locationLink.includes('__doPostBack')) {
                if (btnInteract) {
                    const form = doc.getElementById('aspnetForm');
                    if (form) {
                        const formData = new FormData(form);
                        const btnName = btnInteract.getAttribute('name');
                        const btnId = btnInteract.getAttribute('id');

                        if (btnName) {
                            formData.set(btnName, btnInteract.getAttribute('value') || '');
                        } else if (btnId) {
                            const eventTarget = btnId.replace(/_/g, '$');
                            formData.set('__EVENTTARGET', eventTarget);
                            formData.set('__EVENTARGUMENT', '');
                        }

                        const postHtml = await fetcher.fetch(characterUrl, {
                            method: "POST",
                            body: formData
                        });

                        const postDoc = parser.parseFromString(postHtml, "text/html");
                        const redirectLink = postDoc.querySelector('#ctl00_cphRightColumn_ctl00_lnkInteract')?.getAttribute('href') ||
                            postDoc.querySelector('a[href*="/Locale/MoveToLocale/"]')?.getAttribute('href');

                        if (redirectLink && !redirectLink.startsWith('javascript:')) {
                            finalUrl = redirectLink.startsWith('http') ? redirectLink : `https://${hostName}${redirectLink}`;
                        } else {
                            finalUrl = characterUrl;
                        }
                        log(`Moving to location of <b>${charName}</b>`, 'info');
                        return;
                    }
                }
            }

            if (locationLink && locationLink.includes('/World/')) {
                const relativePath = locationLink.split('/World/')[1];
                if (relativePath) {
                    finalUrl = `https://${hostName}/World/${relativePath}`;
                    await fetcher.fetch(finalUrl, { method: "GET" });
                    log(`Moving to location of <b>${charName}</b>`, 'info');
                    return;
                }
            }

            log(`Maybe ${charName} is no longer in the city, or something happened!`, 'warning');
            console.log('Could not determine navigation method for character:', charId);

        } catch (error) {
            console.error('Error in goToLocation:', error);
            log(`Error navigating to ${charName}: ${error.message}`, 'error');
        }
    }


    async function collectAutograph(person, bookIndex, isLastPersonInBlock = false) {
        const hostName = window.location.hostname;
        const interactUrl = `https://${hostName}/World/Popmundo.aspx/Interact/${person.id}`;
        let bookIds = [];

        try {
            const html = await fetcher.fetch(interactUrl, { method: "GET" });

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const select = doc.querySelector('#ctl00_cphTopColumn_ctl00_ddlUseItem');
            if (!select) {
                log(`Apparently <b>${person.name}</b> is no longer available or doesn't allow item usage`);
                const blockedChars = await getBlockedChars();
                if (!blockedChars.includes(person.id)) {
                    blockedChars.push(person.id);
                    await setBlockedChars(blockedChars);
                    log(`Storing char ${person.name} (${person.id}) in storage to not try again.`, 'warning');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                return { success: false, bookIds: [] };
            }

            const bookName = await getBookName();
            const fallbackNames = ['Livro de autógrafos', 'Autograph book'];
            const searchNames = bookName ? [bookName, ...fallbackNames] : fallbackNames;

            const options = select.querySelectorAll('option');
            options.forEach(option => {
                const optionText = option.textContent.trim();
                const optionValue = option.getAttribute('value');

                if (searchNames.some(name => optionText === name)) {
                    bookIds.push(optionValue);

                    if (firstBookId === 0) {
                        firstBookId = optionValue;
                    }
                }
            });

            if (bookIds.length === 0) {
                return { success: false, bookIds: [] };
            }

            const selectedBookId = bookIds[bookIndex % bookIds.length];

            const docForm = doc.getElementById('aspnetForm');
            if (!docForm) {
                throw new Error("Form 'aspnetForm' not found in page.");
            }

            const formData = new FormData(docForm);

            formData.set('ctl00$cphTopColumn$ctl00$ddlInteractionTypes', '1');
            formData.set('ctl00$cphTopColumn$ctl00$ddlUseItem', selectedBookId);
            formData.set('ctl00$cphTopColumn$ctl00$btnUseItem', doc.getElementById('ctl00_cphTopColumn_ctl00_btnUseItem').value);
            formData.set('__EVENTTARGET', '');
            formData.set('__EVENTARGUMENT', '');

            if (selectedBookId === firstBookId && !firstBookTimestamp) {
                firstBookTimestamp = Date.now();
                log(`First book use at: ${new Date(firstBookTimestamp).toLocaleTimeString()}`);
            }

            log(`Collecting autograph from <b>${person.name}</b> using book ID: ${selectedBookId}`, 'info');
            await fetcher.fetch(interactUrl, {
                method: "POST",
                body: formData
            });

            if (isLastPersonInBlock && firstBookTimestamp) {
                let now = Date.now();
                let elapsedMs = now - firstBookTimestamp;
                let elapsedTime = Math.floor(elapsedMs / 60000);
                remainingDelay = Math.max(0, minuteDelay - elapsedTime);

                log(`Tempo decorrido desde o primeiro uso: ${elapsedTime} minutos.`);
                log(`Delay restante para o próximo bloco: ${remainingDelay} minutos.`);

                firstBookTimestamp = null;
            }

            return { success: true, bookIds: bookIds };
        } catch (error) {
            console.error('Error in collectAutograph:', error);
            log(`Error collecting autograph from ${person.name}: ${error.message}`, 'error');
            return { success: false, bookIds: [] };
        }
    }

    function startDelayTimer(minutes) {
        let timerMessage = jQuery('#timer-message');
        let totalSeconds = minutes * 60;

        return new Promise((resolve) => {
            const interval = setInterval(() => {
                let minutesLeft = Math.floor(totalSeconds / 60);
                let secondsLeft = totalSeconds % 60;

                timerMessage.text(`Waiting: ${minutesLeft} minutes and ${secondsLeft} seconds remaining...`);

                if (totalSeconds <= 0) {
                    clearInterval(interval);
                    timerMessage.text('Continuing autograph collection...');
                    setTimeout(() => timerMessage.text(''), 2000);
                    resolve();
                }

                totalSeconds--;
            }, 1000);
        });
    }



    jQuery(document).ready(function () {
        jQuery('#checkedlist').before('<div class="box" id="autografos-box" drinkwater><h2 drinkwater>Collect Autographs</h2></div>');
        jQuery('#autografos-box').append('<p drinkwater>The script will use all books in your inventory to collect autographs from popstars present in the city!</p>');

        const domain = window.location.hostname;
        const settingsUrl = `https://${domain}/User/Popmundo.aspx/User/ContentSettings`;
        jQuery('#autografos-box').append(`
            <div style="background-color: #ffeb3b; border: 3px solid #f57f17; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;" drinkwater>
                <h3 style="color: #d32f2f; margin-top: 0; font-size: 24px; font-weight: bold;" drinkwater>⚠️ ATTENTION ⚠️</h3>
                <p style="font-size: 18px; font-weight: bold; color: #333; margin: 10px 0;" drinkwater>
                    YOU MUST DISABLE CONFIRMATION POPUPS FOR THE SCRIPT TO WORK PROPERLY!
                </p>
                <p style="font-size: 16px; margin: 15px 0;" drinkwater>
                    <a href="${settingsUrl}" target="_blank" style="color: #1976d2; font-weight: bold; text-decoration: underline; font-size: 18px;" drinkwater>
                        Click here to open content settings
                    </a>
                </p>
            </div>
        `);

        jQuery('#autografos-box').append(`
            <div style="display: flex; flex-direction: column; gap: 16px; margin: 16px 0;" drinkwater>
                <div style="display: flex; flex-direction: column; gap: 6px;" drinkwater>
                    <label for="autograph-book-name" drinkwater>Book name in your language:</label>
                    <input type="text" id="autograph-book-name" class="round width95" placeholder="Livro de autógrafos / Autograph book" style="width: 300px; max-width: 100%; padding: 5px;" drinkwater>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;" drinkwater>
                    <label for="btn-clear-storage" drinkwater>Clear chars that don't accept item usage from the storage?</label>
                    <input type="button" name="btn-clear-storage" value="Clear" id="limpar-chars" class="rmargin5" drinkwater>
                 </div>
                <style drinkwater>#inicar-coleta:disabled, #parar-coleta:disabled { background-color: #9e9e9e !important; color: #bdbdbd !important; cursor: not-allowed; opacity: 0.7; }</style>
                <div class="actionbuttons" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;" drinkwater>
                    <input type="button" name="btn-iniciar-coleta" value="Start" id="inicar-coleta" style="background-color: #4CAF50; color: white;" class="rmargin5" drinkwater>
                    <input type="button" name="btn-parar-coleta" value="Stop" id="parar-coleta" style="background-color: #f44336; color: white;" class="rmargin5" drinkwater>
                </div>

            </div>
        `);

        jQuery('#autografos-box').append('<div id="timer-message" style="font-weight: bold; color: red;" drinkwater></div>');
        jQuery('#autografos-box').append('<table id="logs-autografos" class="data dataTable" drinkwater></table>');

        chrome.storage.sync.get([STORAGE_KEYS.BOOK_NAME], (items) => {
            const savedBookName = items[STORAGE_KEYS.BOOK_NAME];
            if (savedBookName) {
                jQuery('#autograph-book-name').val(savedBookName);
            }
        });

        jQuery('#autograph-book-name').on('input', function () {
            const bookName = jQuery(this).val().trim();
            if (bookName) {
                chrome.storage.sync.set({ [STORAGE_KEYS.BOOK_NAME]: bookName });
                console.log('Nome do item salvo:', bookName);
            }
        });
        jQuery('#logs-autografos').append('<thead drinkwater><tr drinkwater><th drinkwater>Time</th><th drinkwater>Type</th><th drinkwater>Message</th></tr></thead><tbody drinkwater></tbody>');

        let bookAmount;
        const bookElement = jQuery('#checkedlist a:contains("Livro de autógrafos")');
        if (bookElement.length > 0) {
            const bookQuantity = bookElement.closest('td').find('em').text().trim();

            if (bookQuantity.startsWith('x')) {
                bookAmount = parseInt(bookQuantity.substring(1));
                log(`Number of autograph books found: ${bookAmount}`, 'info');
            } else {
                bookAmount = bookElement.length;
            }


        } else {
            log('No autograph books found.');
        }


        let bookIndex = 0;
        let lastCycleIds = [];


        jQuery('#inicar-coleta').click(async function () {
            continuaColeta = true;
            jQuery('#inicar-coleta').prop('disabled', true);
            jQuery('#parar-coleta').prop('disabled', false);
            jQuery('#inicar-coleta').prop('value', 'Collecting Autographs...');
            const esperarSegundos = s => new Promise(r => setTimeout(r, s * 1000));

            while (continuaColeta) {
                try {
                    let queue = await getPeopleToCollect();
                    const blockedChars = await getBlockedChars();
                    queue = queue.filter(
                        p => !blockedChars.includes(p.id) && !lastCycleIds.includes(p.id)
                    );

                    if (queue.length === 0) {
                        log('No eligible person found. Will try again in 60 s.', 'warning');
                        await esperarSegundos(60);
                        continue;
                    }

                    let livrosUsados = 0;
                    let primeiroUsoTs = null;
                    let currentCycleIds = [];

                    while (livrosUsados < bookAmount && continuaColeta) {

                        if (queue.length === 0) {
                            const freshQueue = await getPeopleToCollect();
                            const currentBlocked = await getBlockedChars();
                            queue = freshQueue.filter(p => !currentBlocked.includes(p.id));

                            if (queue.length === 0) break;
                        }

                        const person = queue.shift();
                        if (!person) continue;

                        await goToLocation(person.id, person.name);

                        if (!primeiroUsoTs) primeiroUsoTs = Date.now();

                        const result = await collectAutograph(person, bookIndex, (livrosUsados + 1 === bookAmount));
                        if (!result.success || result.bookIds.length === 0) {
                            continue;
                        }

                        currentCycleIds.push(person.id);
                        bookIndex = (bookIndex + 1) % result.bookIds.length;
                        livrosUsados++;
                    }
                    lastCycleIds = currentCycleIds;

                    if (livrosUsados > 0 && primeiroUsoTs) {
                        const elapsedMin = Math.floor((Date.now() - primeiroUsoTs) / 60000);
                        const delayMinRest = Math.max(0, minuteDelay - elapsedMin);

                        if (delayMinRest > 0) {
                            log(`Cooldown de ${delayMinRest} min antes do próximo ciclo…`);
                            await startDelayTimer(delayMinRest);
                        }
                    }

                } catch (err) {
                    console.error(err);
                    log('Error during script execution – check the console.', 'error');
                }
            }

            jQuery('#inicar-coleta').prop('disabled', false);
            jQuery('#inicar-coleta').prop('value', 'Start');
            jQuery('#parar-coleta').prop('disabled', true);
            log('Autograph collection stopped.');
        });

        jQuery('#parar-coleta').prop('disabled', true);
        jQuery('#parar-coleta').click(function () {
            continuaColeta = false;
            jQuery('#parar-coleta').prop('disabled', true);
            jQuery('#inicar-coleta').prop('disabled', false);
            jQuery('#inicar-coleta').prop('value', 'Start');
            log('Autograph collection stopped by user.', 'info');
        });

        jQuery('#limpar-chars').click(function () {
            chrome.storage.local.remove(STORAGE_KEYS.BLOCKED_CHARS, () => {
                log('Storage "chars-block-itens" cleared.');
            });
        });
    });

})();
