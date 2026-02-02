// ==UserScript==
// @name        Gotta go fast - PPM Autographs
// @namespace   Violentmonkey Scripts
// @author      Drinkwater
// @license     MIT
// @match       https://*.popmundo.com/World/Popmundo.aspx/Character/Items/*
// @grant       none
// @version     1.7
// @description Go, go, go, go, go, go, go Gotta go fast Gotta go fast Gotta go faster, faster, faster, faster, faster! Sonic X
// ==/UserScript==

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


    // Função para coletar as pessoas
    async function getPeopleToCollect() {
        let people = [];
        const hostName = window.location.hostname;
        const peopleOnlineUrl = `https://${hostName}/World/Popmundo.aspx/City/PeopleOnline/`;

        try {
            // Passo 1: GET inicial para obter o formulário
            const response = await fetch(peopleOnlineUrl, { method: "GET" });
            if (!response.ok || response.status < 200 || response.status >= 300) {
                throw new Error(`Failed to fetch initial page: ${response.status}`);
            }
            const html = await response.text();

            // Passo 2: Parse HTML e extrair FormData
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const docForm = doc.getElementById('aspnetForm');

            if (!docForm) {
                throw new Error("Form 'aspnetForm' not found in page.");
            }

            const formDataOrig = new FormData(docForm);

            // Passo 3: Configurar valores do formulário
            // Configurar botão de filtro (submit button)
            formDataOrig.set('ctl00$cphLeftColumn$ctl00$btnFilter', doc.getElementById('ctl00_cphLeftColumn_ctl00_btnFilter').value);
            formDataOrig.set('__EVENTTARGET', '');
            formDataOrig.set('__EVENTARGUMENT', '');

            // Marcar checkbox autógrafo
            formDataOrig.set('ctl00$cphLeftColumn$ctl00$chkAutograph', 'on');

            // Desmarcar outros checkboxes (remover do FormData se existirem)
            // Checkboxes desmarcados não são enviados em formulários HTML normais
            if (formDataOrig.has('ctl00$cphLeftColumn$ctl00$chkOnline')) {
                formDataOrig.delete('ctl00$cphLeftColumn$ctl00$chkOnline');
            }
            if (formDataOrig.has('ctl00$cphLeftColumn$ctl00$chkGame')) {
                formDataOrig.delete('ctl00$cphLeftColumn$ctl00$chkGame');
            }
            if (formDataOrig.has('ctl00$cphLeftColumn$ctl00$chkRelationships')) {
                formDataOrig.delete('ctl00$cphLeftColumn$ctl00$chkRelationships');
            }

            // Todos os outros campos (ctl00$ctl08$ucCharacterBar$ddlCurrentCharacter,
            // ctl00$cphLeftColumn$ctl00$language, ctl00$cphRightColumn$ctl01$ddlCities, etc.)
            // já estarão no FormData com seus valores corretos da página inicial

            // Passo 4: POST com FormData configurado
            const postResponse = await fetch(peopleOnlineUrl, {
                method: "POST",
                body: formDataOrig
            });

            if (!postResponse.ok || postResponse.status < 200 || postResponse.status >= 300) {
                throw new Error(`Failed to post filter request: ${postResponse.status}`);
            }

            const postHtml = await postResponse.text();
            const postDoc = parser.parseFromString(postHtml, "text/html");

            // Passo 5: Extrair pessoas da tabela (independente de idioma)
            const peopleTable = postDoc.querySelector('#tablepeople');

            if (peopleTable) {
                Array.from(peopleTable.querySelectorAll('tbody tr')).forEach(row => {
                    const characterLink = row.querySelector('a');
                    const statusCell = row.querySelectorAll('td')[1];
                    const statusText = statusCell ? statusCell.textContent.trim() : '';

                    // Independente de idioma: vazio = disponível, qualquer texto = ocupado
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


   
    // Função para logar dados
    let LOG_INDEX = 0;
    function log(data) {
        if (window.parent === window) {
            jQuery("#logs-autografos").append(`<tr class="${LOG_INDEX % 2 == 0 ? "odd" : "even"}" drinkwater><td drinkwater>${data}</td></tr>`);
            LOG_INDEX++;
        }
    }


    async function goToLocation(charId, charName) {
        const hostName = window.location.hostname;
        const characterUrl = `https://${hostName}/World/Popmundo.aspx/Character/${charId}`;
        let finalUrl = null;

        try {
            // Passo 1: GET inicial da página do personagem via HTTP
            const response = await fetch(characterUrl, { method: "GET" });
            if (!response.ok || response.status < 200 || response.status >= 300) {
                throw new Error(`Failed to fetch character page: ${response.status}`);
            }
            const html = await response.text();

            // Passo 2: Parse HTML com DOMParser
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Passo 3: Detectar método de navegação e executar

            // Caso 1: Link direto de interação (lnkInteract ou btnInteract)
            const linkInteract = doc.querySelector('#ctl00_cphRightColumn_ctl00_lnkInteract');
            const btnInteract = doc.querySelector('#ctl00_cphRightColumn_ctl00_btnInteract');

            if (linkInteract) {
                const href = linkInteract.getAttribute('href');
                if (href && !href.startsWith('javascript:')) {
                    // Link direto - GET
                    finalUrl = href.startsWith('http') ? href : `https://${hostName}${href}`;
                    await fetch(finalUrl, { method: "GET" });
                    log(`Movendo até o local de <b>${charName}</b>`);

                    return;
                }
            }

            if (btnInteract) {
                const btnHref = btnInteract.getAttribute('href');
                
                // Link com href direto (não javascript) - GET
                if (btnHref && !btnHref.startsWith('javascript:')) {
                    finalUrl = btnHref.startsWith('http') ? btnHref : `https://${hostName}${btnHref}`;
                    await fetch(finalUrl, { method: "GET" });
                    log(`Movendo até o local de <b>${charName}</b>`);

                    return;
                }

                // Link com javascript:__doPostBack - POST via formulário
                if (btnHref && btnHref.includes('__doPostBack')) {
                    // Extrair parâmetros do __doPostBack: javascript:__doPostBack('eventTarget','eventArgument')
                    const doPostBackMatch = btnHref.match(/javascript:__doPostBack\('([^']+?)','([^']*?)'\)/);
                    if (doPostBackMatch) {
                        const eventTarget = doPostBackMatch[1]; // 'ctl00$cphRightColumn$ctl00$btnInteract'
                        const eventArgument = doPostBackMatch[2] || ''; // ''
                        
                        const form = doc.getElementById('aspnetForm');
                        if (form) {
                            const formData = new FormData(form);
                            // Configurar __EVENTTARGET e __EVENTARGUMENT para simular __doPostBack
                            formData.set('__EVENTTARGET', eventTarget);
                            formData.set('__EVENTARGUMENT', eventArgument);
                            
                            const postResponse = await fetch(characterUrl, {
                                method: "POST",
                                body: formData
                            });

                            if (postResponse.ok && postResponse.status >= 200 && postResponse.status < 300) {
                                const postHtml = await postResponse.text();
                                const postDoc = parser.parseFromString(postHtml, "text/html");
                                // Tentar encontrar URL de redirecionamento na resposta
                                const redirectLink = postDoc.querySelector('#ctl00_cphRightColumn_ctl00_lnkInteract')?.getAttribute('href') ||
                                                   postDoc.querySelector('a[href*="/Locale/MoveToLocale/"]')?.getAttribute('href');
                                
                                if (redirectLink && !redirectLink.startsWith('javascript:')) {
                                    finalUrl = redirectLink.startsWith('http') ? redirectLink : `https://${hostName}${redirectLink}`;
                                } else {
                                    finalUrl = characterUrl;
                                }
                                log(`Movendo até o local de <b>${charName}</b>`);
                                return;
                            }
                        }
                    }
                }

                // Botão submit (caso seja realmente um botão) - POST via formulário
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
                        
                        const postResponse = await fetch(postUrl, {
                            method: "POST",
                            body: formData
                        });

                        if (postResponse.ok && postResponse.status >= 200 && postResponse.status < 300) {
                            const postHtml = await postResponse.text();
                            const postDoc = parser.parseFromString(postHtml, "text/html");
                            finalUrl = postUrl;
                            log(`Movendo até o local de <b>${charName}</b>`);
                            return;
                        }
                    }
                }
            }

            // Caso 2: Link na apresentação do personagem
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
                            await fetch(finalUrl, { method: "GET" });
                            log(`Movendo até o local de <b>${charName}</b>`);
                            return;
                        }
                    }
                }
            }

            // Caso 3: Link javascript: (fallback para outros casos javascript: não tratados acima)
            // Este caso já deve ter sido tratado no Caso 1 se for __doPostBack
            // Mas mantemos como fallback para outros tipos de javascript:
            let locationLink = linkInteract?.getAttribute('href') || btnInteract?.getAttribute('href');
            if (locationLink && locationLink.startsWith('javascript:') && !locationLink.includes('__doPostBack')) {
                // Outros tipos de javascript: (não __doPostBack) - tentar POST genérico
                if (btnInteract) {
                    const form = doc.getElementById('aspnetForm');
                    if (form) {
                        const formData = new FormData(form);
                        const btnName = btnInteract.getAttribute('name');
                        const btnId = btnInteract.getAttribute('id');
                        
                        // Tentar usar o ID como EVENTTARGET se não tiver name
                        if (btnName) {
                            formData.set(btnName, btnInteract.getAttribute('value') || '');
                        } else if (btnId) {
                            // Converter ID para formato de name (ctl00_cphRightColumn_ctl00_btnInteract -> ctl00$cphRightColumn$ctl00$btnInteract)
                            const eventTarget = btnId.replace(/_/g, '$');
                            formData.set('__EVENTTARGET', eventTarget);
                            formData.set('__EVENTARGUMENT', '');
                        }

                        const postResponse = await fetch(characterUrl, {
                            method: "POST",
                            body: formData
                        });

                        if (postResponse.ok && postResponse.status >= 200 && postResponse.status < 300) {
                            const postHtml = await postResponse.text();
                            const postDoc = parser.parseFromString(postHtml, "text/html");
                            const redirectLink = postDoc.querySelector('#ctl00_cphRightColumn_ctl00_lnkInteract')?.getAttribute('href') ||
                                               postDoc.querySelector('a[href*="/Locale/MoveToLocale/"]')?.getAttribute('href');
                            
                            if (redirectLink && !redirectLink.startsWith('javascript:')) {
                                finalUrl = redirectLink.startsWith('http') ? redirectLink : `https://${hostName}${redirectLink}`;
                            } else {
                                finalUrl = characterUrl;
                            }
                            log(`Movendo até o local de <b>${charName}</b>`);
                            return;
                        }
                    }
                }
            }

            // Caso 4: Navegação direta (fallback)
            if (locationLink && locationLink.includes('/World/')) {
                const relativePath = locationLink.split('/World/')[1];
                if (relativePath) {
                    finalUrl = `https://${hostName}/World/${relativePath}`;
                    await fetch(finalUrl, { method: "GET" });
                    log(`Movendo até o local de <b>${charName}</b>`);

                    return;
                }
            }

            // Se nenhum caso funcionou
            log(`Talvez ${charName} não está mais na cidade, ou algo aconteceu!`);
            console.log('Could not determine navigation method for character:', charId);

        } catch (error) {
            console.error('Error in goToLocation:', error);
            log(`Erro ao navegar até ${charName}: ${error.message}`);
        }
    }


    async function collectAutograph(person, bookIndex, isLastPersonInBlock = false) {
        const hostName = window.location.hostname;
        const interactUrl = `https://${hostName}/World/Popmundo.aspx/Interact/${person.id}`;
        let bookIds = [];

        try {
            // GET da página de interação via HTTP
            const response = await fetch(interactUrl, { method: "GET" });
            if (!response.ok || response.status < 200 || response.status >= 300) {
                throw new Error(`Failed to fetch interact page: ${response.status}`);
            }
            const html = await response.text();

            // Parse HTML com DOMParser
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Buscar o select de itens
            const select = doc.querySelector('#ctl00_cphTopColumn_ctl00_ddlUseItem');
            if (!select) {
                log(`Aparentemente <b>${person.name}</b> não está mais disponível ou não deixa usar itens`);
                // Armazenar o char no localStorage para não tentar novamente
                let blockedChars = JSON.parse(localStorage.getItem('chars-block-itens')) || [];
                if (!blockedChars.includes(person.id)) {
                    blockedChars.push(person.id);
                    localStorage.setItem('chars-block-itens', JSON.stringify(blockedChars));
                    log(`Armazenando char ${person.name} (${person.id}) no localStorage para não tentar novamente.`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                return { success: false, bookIds: [] };
            }

            // Obter nome do item do localStorage (com fallback para valores padrão)
            const bookName = localStorage.getItem('autograph_book_name') || 'Livro de autógrafos';
            const fallbackNames = ['Livro de autógrafos', 'Autograph book'];
            const searchNames = bookName ? [bookName, ...fallbackNames] : fallbackNames;

            // Buscar todas as opções do select e filtrar pelos nomes
            const options = select.querySelectorAll('option');
            options.forEach(option => {
                const optionText = option.textContent.trim();
                const optionValue = option.getAttribute('value');

                // Verificar se o texto da opção corresponde ao nome salvo ou aos fallbacks
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

            // Selecionar o livro baseado no bookIndex
            const selectedBookId = bookIds[bookIndex % bookIds.length];

            // Extrair FormData do formulário
            const docForm = doc.getElementById('aspnetForm');
            if (!docForm) {
                throw new Error("Form 'aspnetForm' not found in page.");
            }

            const formData = new FormData(docForm);

            // Configurar valores do formulário para POST
            formData.set('ctl00$cphTopColumn$ctl00$ddlInteractionTypes', '1');
            formData.set('ctl00$cphTopColumn$ctl00$ddlUseItem', selectedBookId);
            formData.set('ctl00$cphTopColumn$ctl00$btnUseItem', doc.getElementById('ctl00_cphTopColumn_ctl00_btnUseItem').value);
            formData.set('__EVENTTARGET', '');
            formData.set('__EVENTARGUMENT', '');

            // Todos os outros campos (ctl00$ctl08$ucCharacterBar$ddlCurrentCharacter,
            // ctl00$cphTopColumn$ctl00$hidSecurityCheck, etc.) já estarão no FormData

            // Marcar timestamp do primeiro uso
            if (selectedBookId === firstBookId && !firstBookTimestamp) {
                firstBookTimestamp = Date.now();
                log(`Primeiro uso do livro às: ${new Date(firstBookTimestamp).toLocaleTimeString()}`);
            }

            // POST para usar o item
            log(`Coletando autógrafo de <b>${person.name}</b> usando livro ID: ${selectedBookId}`);
            const postResponse = await fetch(interactUrl, {
                method: "POST",
                body: formData
            });

            if (!postResponse.ok || postResponse.status < 200 || postResponse.status >= 300) {
                throw new Error(`Failed to post use item request: ${postResponse.status}`);
            }

            // Na última pessoa, calcular o delay restante baseado no primeiro uso do livro
            if (isLastPersonInBlock && firstBookTimestamp) {
                let now = Date.now();
                let elapsedMs = now - firstBookTimestamp;
                let elapsedTime = Math.floor(elapsedMs / 60000);
                remainingDelay = Math.max(0, minuteDelay - elapsedTime);

                log(`Tempo decorrido desde o primeiro uso: ${elapsedTime} minutos.`);
                log(`Delay restante para o próximo bloco: ${remainingDelay} minutos.`);

                // Resetar o timestamp para o próximo bloco
                firstBookTimestamp = null;
            }

            return { success: true, bookIds: bookIds };
        } catch (error) {
            console.error('Error in collectAutograph:', error);
            log(`Erro ao coletar autógrafo de ${person.name}: ${error.message}`);
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

                timerMessage.text(`Esperando: ${minutesLeft} minutos e ${secondsLeft} segundos restantes...`);

                if (totalSeconds <= 0) {
                    clearInterval(interval);
                    timerMessage.text('Continuando a coleta de autógrafos...');
                    setTimeout(() => timerMessage.text(''), 2000); // Limpa a mensagem após 2 segundos
                    resolve();
                }

                totalSeconds--;
            }, 1000);
        });
    }



    jQuery(document).ready(function () {
        jQuery('#checkedlist').before('<div class="box" id="autografos-box" drinkwater><h2 drinkwater>Coletar Autógrafos</h2></div>');
        jQuery('#autografos-box').append('<p drinkwater>O script usará todos os livros do seu inventário, para coletar autógrafos de popstars presentes na cidade!</p>');

        // Aviso sobre popups de confirmação
        const domain = window.location.hostname;
        const settingsUrl = `https://${domain}/User/Popmundo.aspx/User/ContentSettings`;
        jQuery('#autografos-box').append(`
            <div style="background-color: #ffeb3b; border: 3px solid #f57f17; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;" drinkwater>
                <h3 style="color: #d32f2f; margin-top: 0; font-size: 24px; font-weight: bold;" drinkwater>⚠️ ATENÇÃO ⚠️</h3>
                <p style="font-size: 18px; font-weight: bold; color: #333; margin: 10px 0;" drinkwater>
                    É NECESSÁRIO DESABILITAR OS POPUPS DE CONFIRMAÇÃO PARA O SCRIPT FUNCIONAR CORRETAMENTE!
                </p>
                <p style="font-size: 16px; margin: 15px 0;" drinkwater>
                    <a href="${settingsUrl}" target="_blank" style="color: #1976d2; font-weight: bold; text-decoration: underline; font-size: 18px;" drinkwater>
                        Clique aqui para abrir as configurações de conteúdo
                    </a>
                </p>
            </div>
        `);

        jQuery('#autografos-box').append('<p class="actionbuttons" drinkwater> <input type="button" name="btn-iniciar-coleta" value="Iniciar" id="inicar-coleta" class="rmargin5" drinkwater> <input type="button" name="btn-parar-coleta" value="Parar" id="parar-coleta" class="rmargin5" drinkwater> <input type="button" name="btn-clear-storage" value="Limpar chars que não aceitam uso de itens" id="limpar-chars" class="rmargin5" drinkwater></p>');
        
        // Input para nome do item no idioma do usuário
        jQuery('#autografos-box').append('<p drinkwater><label for="autograph-book-name" drinkwater>Nome do item no seu idioma:</label><br/><input type="text" id="autograph-book-name" placeholder="Livro de autógrafos / Autograph book" style="width: 300px; padding: 5px; margin-top: 5px;" drinkwater></p>');
        
        jQuery('#autografos-box').append('<div id="timer-message" style="font-weight: bold; color: red;" drinkwater></div>');
        jQuery('#autografos-box').append('<table id="logs-autografos" class="data dataTable" drinkwater></table>');
        
        // Carregar valor salvo do localStorage
        const savedBookName = localStorage.getItem('autograph_book_name');
        if (savedBookName) {
            jQuery('#autograph-book-name').val(savedBookName);
        }
        
        // Salvar no localStorage quando o usuário digitar
        jQuery('#autograph-book-name').on('input', function() {
            const bookName = jQuery(this).val().trim();
            if (bookName) {
                localStorage.setItem('autograph_book_name', bookName);
                console.log('Nome do item salvo:', bookName);
            }
        });
        jQuery('#logs-autografos').append('<tbody drinkwater><tr drinkwater><th drinkwater>Logs</th></tr></tbody>');

        let bookAmount;
        const bookElement = jQuery('#checkedlist a:contains("Livro de autógrafos")');
        if (bookElement.length > 0) {
            const bookQuantity = bookElement.closest('td').find('em').text().trim();
      
            if (bookQuantity.startsWith('x')) {
                bookAmount = parseInt(bookQuantity.substring(1));
                log(`Quantidade de livros de autógrafos encontrada: ${bookAmount}`);
            } else {
                bookAmount = bookElement.length;
            }

            // Exibir quantidade de livros com aviso sobre popups
            const domain = window.location.hostname;
            const settingsUrl = `https://${domain}/User/Popmundo.aspx/User/ContentSettings`;
            jQuery('#autografos-box').append(`
                <div style="background-color: #fff3cd; border: 2px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 5px;" drinkwater>
                    <p style="font-size: 16px; margin: 5px 0; font-weight: bold;" drinkwater>
                        📚 Quantidade de livros encontrados: <span style="color: #1976d2; font-size: 18px;">${bookAmount}</span>
                    </p>
                    <div style="background-color: #ffeb3b; border: 2px solid #f57f17; padding: 15px; margin-top: 10px; border-radius: 5px; text-align: center;" drinkwater>
                        <p style="font-size: 16px; font-weight: bold; color: #d32f2f; margin: 5px 0;" drinkwater>
                            ⚠️ IMPORTANTE: Desabilite os popups de confirmação!
                        </p>
                        <p style="margin: 5px 0;" drinkwater>
                            <a href="${settingsUrl}" target="_blank" style="color: #1976d2; font-weight: bold; text-decoration: underline; font-size: 16px;" drinkwater>
                                Abrir configurações de conteúdo
                            </a>
                        </p>
                    </div>
                </div>
            `);
        } else {
            log('Nenhum Livro de autógrafos encontrado.');
        }


        let bookIndex = 0; // Inicia o índice do livro
        let lastCycleIds = [];       // ← NOVO: quem recebeu autógrafo no ciclo anterior


        jQuery('#inicar-coleta').click(async function () {
            continuaColeta = true;
            jQuery('#inicar-coleta').prop('disabled', true);
            jQuery('#parar-coleta').prop('disabled', false);
            jQuery('#inicar-coleta').prop('value', 'Coletando Autografos...');
            // utilitário de espera
            const esperarSegundos = s => new Promise(r => setTimeout(r, s * 1000));

            /* ------------------------------------------------------------------
             * LOOP PRINCIPAL • tenta usar exatamente "bookAmount" livros por ciclo
             * -----------------------------------------------------------------*/
            while (continuaColeta) {
                try {
                    /* ---------- snapshot inicial ---------- */
                    let queue = await getPeopleToCollect();
                    const blockedChars = JSON.parse(localStorage.getItem('chars-block-itens')) || [];
                    queue = queue.filter(
                        p => !blockedChars.includes(p.id) && !lastCycleIds.includes(p.id)
                    );

                    if (queue.length === 0) {
                        log('Nenhuma pessoa elegível encontrada. Tentarei novamente em 60 s.');
                        await esperarSegundos(60);
                        continue;
                    }

                    let livrosUsados = 0;      // quantos livros já foram consumidos neste ciclo
                    let primeiroUsoTs = null;   // marca o 1.º autógrafo do ciclo
                    let currentCycleIds = [];    // ← NOVO

                    /* ---------- continua até consumir "bookAmount" livros ---------- */
                    while (livrosUsados < bookAmount && continuaColeta) {

                        // se a fila esvaziar antes de completar a cota, faz novo snapshot
                        if (queue.length === 0) {
                            queue = (await getPeopleToCollect())
                                .filter(p => !blockedChars.includes(p.id));

                            if (queue.length === 0) break;   // ninguém mais disponível
                        }

                        const person = queue.shift();
                        if (!person) continue;             // segurança

                        await goToLocation(person.id, person.name);
                        
                        if (!primeiroUsoTs) primeiroUsoTs = Date.now();

                        const result = await collectAutograph(person, bookIndex, (livrosUsados + 1 === bookAmount));
                        if (!result.success || result.bookIds.length === 0) {
                            continue;  // não aceita itens → tenta próximo
                        }

                        currentCycleIds.push(person.id);
                        bookIndex = (bookIndex + 1) % result.bookIds.length;
                        livrosUsados++;
                    }
                    lastCycleIds = currentCycleIds;

                    /* ---------- cooldown baseado no 1.º uso do ciclo ---------- */
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
                    log('Erro durante a execução do script – consulte o console.');
                }
            }

            jQuery('#inicar-coleta').prop('disabled', false);
            jQuery('#inicar-coleta').prop('value', 'Iniciar');
            jQuery('#parar-coleta').prop('disabled', true);
            log('Coleta de autógrafos interrompida.');
        });

        jQuery('#parar-coleta').prop('disabled', true);
        jQuery('#parar-coleta').click(function () {
            continuaColeta = false;
            jQuery('#parar-coleta').prop('disabled', true);
            jQuery('#inicar-coleta').prop('disabled', false);
            jQuery('#inicar-coleta').prop('value', 'Iniciar');
            log('Coleta de autógrafos interrompida pelo usuário.');
        });

        // Limpar chars que não aceitam uso de itens
        jQuery('#limpar-chars').click(function () {
            localStorage.removeItem('chars-block-itens');
            log('Storage "chars-block-itens" limpo.');
        });
    });

})();