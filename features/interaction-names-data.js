// Game wording of the interaction groups, per game language id (the ids of Utils.getGameLanguage()).
//
// The Interact page tags every option with a localized data-group (e.g. "Phone" is "Telefoniche" in Italian), so
// the group name cannot be compared with an English string. The names below were read from the interaction
// dropdown of the Interact page in each of the 25 game languages, and are extended with the names sent by the
// community (see worker/README.md and scripts/sync-interaction-names.mjs, which rewrites this whole file).
// Only groups that were seen in the game are listed.
const INTERACTION_GROUP_NAMES = {
    basic: {
        1: 'Grundläggande', 2: 'Basic', 3: 'Grundlegend', 4: 'Base', 5: 'Élémentaires', 6: 'Básica',
        7: 'Grunnleggende', 8: 'Basal', 9: 'Perus', 10: 'Basis', 11: 'Básicas', 13: 'Podstawowe', 14: 'Основные',
        19: 'Temel', 23: 'De Bază', 24: 'Basic', 33: 'Alap', 36: 'Üldine', 39: 'Osnovne', 43: 'Обикновени',
        50: 'Básicas', 51: 'Básicas', 56: 'Pradinis', 60: 'Básica', 106: '普通类'
    },
    verbal: {
        1: 'Verbalt', 2: 'Verbal', 3: 'Mündlich', 4: 'Verbali', 5: 'Verbales', 6: 'Verbal', 7: 'Verbalt', 8: 'Verbal',
        9: 'Puhe', 10: 'Verbaal', 11: 'Verbais', 13: 'Werbalne', 14: 'Вербальные', 19: 'Sözlü', 23: 'Verbal',
        24: 'Verbal', 33: 'Szóbeli', 36: 'Suuline', 39: 'Usmene', 43: 'Вербални', 50: 'Verbais', 51: 'Verbales',
        56: 'Žodinis', 60: 'Verbal', 106: '言辞'
    },
    special: {
        1: 'Speciellt', 2: 'Special', 3: 'Spezial', 4: 'Speciali', 5: 'Spéciales', 6: 'Especial', 7: 'Spesielt',
        8: 'Speciel', 9: 'Erikoinen', 10: 'Speciaal', 11: 'Especiais', 13: 'Specjalne', 14: 'Особые', 19: 'Özel',
        23: 'Special', 24: 'Special', 33: 'Speciális', 36: 'Eriline', 39: 'Posebne', 43: 'Специални', 50: 'Especiais',
        51: 'Especiales', 56: 'Ypatingas', 60: 'Especial', 106: '特殊类'
    },
    phone: {
        1: 'Över telefonen', 2: 'Phone', 3: 'Telefonisch', 4: 'Telefoniche', 5: 'Téléphoniques', 6: 'Telefónica',
        7: 'Telefon', 8: 'Telefon', 9: 'Puhelin', 10: 'Telefoon', 11: 'Telefónicas', 13: 'Telefoniczne',
        14: 'Телефон', 19: 'Telefon', 23: 'Telefon', 24: 'Phone', 33: 'Telefonos', 36: 'Telefon', 39: 'Telefonske',
        43: 'Телефон', 50: 'Telefônicas', 51: 'Telefónicas', 56: 'Telefoninis', 60: 'Telefónica', 106: '电话'
    },
    medical: {
        1: 'Medicinskt', 2: 'Medical', 3: 'Medizinisch', 4: 'Mediche', 5: 'Médicales', 6: 'Médica', 7: 'Medisinsk',
        8: 'Medicinsk', 9: 'Lääketieteellinen', 10: 'Medisch', 11: 'Médicas', 13: 'Medyczne', 14: 'Медицинские',
        19: 'Tıbbî', 23: 'Medical', 24: 'Medical', 33: 'Gyógyászati', 36: 'Meditsiiniline', 39: 'Medicinske',
        43: 'Здравни', 50: 'Médicas', 51: 'Medicinales', 56: 'Medicininis', 60: 'Médica', 106: '医学的'
    },
    physical: {
        1: 'Fysiskt', 2: 'Physical', 3: 'Körperlich', 4: 'Fisiche', 5: 'Physiques', 6: 'Física', 7: 'Fysisk',
        8: 'Fysisk', 9: 'Fyysinen', 10: 'Fysiek', 11: 'Físicas', 13: 'Fizyczne', 14: 'Физические', 19: 'Fiziksel',
        23: 'Fizic', 24: 'Physical', 33: 'Fizikai', 36: 'Füüsiline', 39: 'Fizičke', 43: 'Физически', 50: 'Físicas',
        51: 'Físicas', 56: 'Fizinis', 60: 'Física', 106: '身体行为'
    },
    closePhysical: {
        1: 'Intimt', 2: 'Close Physical', 3: 'Eng körperlich', 4: 'Fisiche intime', 5: 'Physiquement intimes',
        6: 'Física, cercana', 7: 'Nært fysisk', 8: 'Tæt fysisk', 9: 'Fyysinen läheisyys', 10: 'Intiem',
        11: 'Físicas Íntimas', 13: 'Bliskie fizyczne', 14: 'Физическая близость', 19: 'Yakın Temas',
        23: 'Apropiere Fizică', 24: 'Close Physical', 33: 'Szoros fizikai', 36: 'Intiimne', 39: 'Bliske fizičke',
        43: 'Физически (близки)', 50: 'Íntimas', 51: 'Directamente físicas', 56: 'Glaudus fizinis',
        60: 'Física cercana', 106: '亲密身体行为'
    },
    sexual: {
        2: 'Sexual', 19: 'Cinsel', 24: 'Sexual', 50: 'Sexuais', 51: 'Sexuales'
    },
    spiritual: {
        2: 'Spiritual', 19: 'Ruhanî'
    },
    bestFriends: {
        2: 'Best Friends', 19: 'En iyi arkadaş', 24: 'Best Friends', 50: 'Melhores Amigos', 51: 'Mejores amigos',
        60: 'Mejores amigos'
    },
    matrimonial: {
        2: 'Matrimonial', 19: 'Evlilik', 50: 'Matrimonial', 51: 'Matrimoniales'
    },
    pirating: {
        2: 'Pirating', 19: 'Korsanca', 24: 'Pirating', 50: 'Piratês'
    }
};

// The game group of each interaction id, as a language-independent key (the English group name, in camelCase).
// Only the interactions that were seen in the game are listed: the others are unlocked by the relationship level
// and are expected to be added by the community collection.
const INTERACTION_GROUP_BY_ID = {
    1: 'basic', 15: 'basic', 54: 'basic', 161: 'basic',
    3: 'verbal', 5: 'verbal', 14: 'verbal', 34: 'verbal', 51: 'verbal', 57: 'verbal', 62: 'verbal', 65: 'verbal',
    68: 'verbal', 71: 'verbal', 75: 'verbal', 76: 'verbal', 77: 'verbal', 79: 'verbal', 81: 'verbal', 100: 'verbal',
    119: 'verbal', 154: 'verbal', 155: 'verbal', 156: 'verbal', 160: 'verbal', 166: 'verbal',
    4: 'special', 21: 'special', 29: 'special', 33: 'special', 78: 'special',
    24: 'phone', 25: 'phone', 26: 'phone', 46: 'phone', 58: 'phone', 61: 'phone', 73: 'phone', 74: 'phone',
    80: 'phone', 121: 'phone', 157: 'phone', 162: 'phone', 165: 'phone', 171: 'phone',
    32: 'medical', 44: 'medical',
    7: 'physical', 8: 'physical', 12: 'physical', 18: 'physical', 30: 'physical', 35: 'physical', 36: 'physical',
    55: 'physical', 59: 'physical', 63: 'physical', 66: 'physical', 89: 'physical', 106: 'physical', 124: 'physical',
    129: 'physical', 158: 'physical',
    9: 'closePhysical', 10: 'closePhysical', 41: 'closePhysical', 56: 'closePhysical', 60: 'closePhysical',
    64: 'closePhysical', 67: 'closePhysical',
    11: 'sexual', 13: 'sexual', 19: 'sexual', 20: 'sexual', 164: 'sexual',
    39: 'spiritual',
    69: 'bestFriends', 70: 'bestFriends',
    144: 'matrimonial', 145: 'matrimonial', 147: 'matrimonial', 149: 'matrimonial', 150: 'matrimonial',
    167: 'pirating', 168: 'pirating', 169: 'pirating'
};

// The game groups in the order the dropdown showed them (provisional, to be confirmed with the full data).
const INTERACTION_GROUP_ORDER = ['basic', 'verbal', 'special', 'phone', 'medical', 'physical', 'closePhysical', 'sexual', 'spiritual', 'bestFriends', 'matrimonial', 'pirating'];

// The game's name of each interaction, per game language id: { langId: { options: { interactionId: name } } }.
// Only the interactions that were seen in the game are listed: the options page falls back to the extension's own
// label for the missing ones.
const INTERACTION_NAMES_DB = {
    1: {
        options: {
            1: 'Säg hej!', 3: 'Prata med', 4: 'Dra ett skämt', 5: 'Retas', 15: 'Förolämpa', 24: 'Kolla läget',
            26: 'Busringning', 32: 'Ge första hjälpen', 33: 'Gör ett roligt trick', 46: 'Kyss-mig-i-röven-samtal',
            54: 'Le', 55: 'Skaka hand', 56: 'Kyss på kinden', 58: 'Skicka rolig bild', 61: 'Skicka ett vänligt SMS',
            71: 'Hej snygging, hur mår du?', 73: 'Flörtigt telefonsamtal', 74: 'Flörtigt textmeddelande',
            79: 'Dra dit pepparn växer!', 80: 'Skicka förolämpning', 119: 'Öh!', 121: 'Ring upp och skvallra',
            124: 'Kasta boll', 154: 'Snälla, sluta flörta med mig.', 156: 'Jag vill inte vara vän med dig.',
            161: 'Blinka', 162: 'Födelsedagssamtal', 166: 'Säg förlåt', 171: 'Thank You call'
        }
    },
    2: {
        options: {
            1: 'Greet', 3: 'Talk to', 4: 'Tell joke', 5: 'Tease', 7: 'Buy a drink', 8: 'Hug', 9: 'Kiss',
            10: 'Kiss passionately', 11: 'Make Love', 12: 'Tickle', 13: '5 minute quickie', 14: 'Compliment',
            15: 'Insult', 18: 'Play with', 19: 'Tantric Sex', 20: 'Spank', 21: 'Sing to', 24: 'Wazzup call',
            25: 'Dirty call', 26: 'Prank call', 29: 'Seek apprenticeship', 30: 'Caress', 32: 'Give first aid',
            33: 'Do funny magic', 34: 'Have profound discussion', 35: 'Ask for a dance', 36: 'Evil Eye', 39: 'Bless',
            41: 'Pull hair', 44: 'Give Massage', 46: 'Kiss my ass call', 51: 'Comfort', 54: 'Smile',
            55: 'Shake hands', 56: 'Kiss Cheeks', 57: 'Fraternize', 58: 'SMS funny pic', 59: 'Rub elbows',
            60: 'High Five', 61: 'SMS friendly text', 62: 'Share Opinions', 63: 'Pat on back', 64: 'Embrace',
            65: 'Gossip', 66: 'Braid Hair', 67: 'Arm Wrestle', 68: 'Offer Advice', 69: 'Share secrets',
            70: 'Hang out', 71: 'Hey sexy, how you doin\'?', 73: 'Flirty Phone call', 74: 'Flirty SMS', 75: 'Praise',
            76: 'Tell naughty joke', 77: 'Say I love you', 78: 'Serenade', 79: 'Get lost!', 80: 'SMS insult',
            81: 'Badmouth', 89: 'Flex biceps', 119: 'Yo!', 121: 'Gossip on phone', 124: 'Play catch',
            129: 'Stroll hand in hand', 144: 'Argue about money', 145: 'Plan future', 147: 'Role-play',
            149: 'Compliment partner', 150: 'Shave', 154: 'Please stop flirting with me.',
            155: 'Please don\'t fight with me.', 156: 'I don\'t want to be friends.',
            157: 'It\'s not you, it\'s me...', 161: 'Wink', 162: 'Birthday call', 164: 'Enjoy Kobe Sutra',
            165: 'Romantic call', 166: 'Say I\'m sorry', 167: 'Say Arrr!', 168: 'Say Ahoy, me hearty!',
            169: 'Say Yo ho ho!', 171: 'Thank You call'
        }
    },
    3: {
        options: {
            1: 'Begrüßen', 3: 'Unterhalten', 4: 'Witz erzählen', 5: 'Necken', 15: 'Beleidigen', 24: 'Durchklingeln',
            26: 'Telefonstreich', 32: 'Erste Hilfe leisten', 33: 'Einen lustigen Zaubertrick machen',
            46: '"Leck mich!"-Anruf', 54: 'Lächeln', 55: 'Hand schütteln', 56: 'Wangen küssen',
            58: 'Lustiges Bild simsen', 61: 'Freundlichen Text simsen', 71: 'Hey Süße(r), wie geht\'s denn so?',
            73: 'Per Telefon flirten', 74: 'Per SMS flirten', 79: 'Zieh Leine!', 80: 'SMS-Beleidigung', 119: 'Hey!',
            121: 'Am Telefon tratschen', 124: 'Ball spielen', 154: 'Hör bitte auf, mit mir zu flirten.',
            156: 'Ich möchte nicht befreundet sein.', 161: 'Zuzwinkern', 162: 'Geburtstagsanruf',
            166: 'Es tut mir leid sagen', 171: 'Dankeschönanruf'
        }
    },
    4: {
        options: {
            1: 'Saluta', 3: 'Attacca bottone', 4: 'Fai una battuta', 5: 'Stuzzica', 15: 'Insulta',
            24: 'Telefonata informale', 26: 'Scherzo telefonico', 32: 'Presta primo soccorso',
            33: 'Fai un gioco di prestigio', 46: '"Baciami il culo!"', 54: 'Sorridi', 55: 'Stringetevi la mano',
            56: 'Bacia sulle guance', 58: 'Immagine buffa via MMS', 61: 'Invia SMS amichevole',
            71: 'Hey sexy, come va?', 73: 'Flirta al telefono', 74: 'Flirta con un SMS', 79: 'Levati dalle palle!',
            80: 'Insulta con un SMS', 119: 'Yo!', 121: 'Spettegola al telefono', 124: 'Gioca ad acchiapparello',
            154: 'Per favore, smetti di flirtare con me.', 156: 'Non voglio che continuiamo ad essere amici.',
            161: 'Ammicca', 162: 'Telefonata di buon compleanno', 166: 'Di\' che ti dispiace',
            171: 'Chiamata di ringraziamento'
        }
    },
    5: {
        options: {
            1: 'Saluer', 3: 'Parler', 4: 'Blaguer', 5: 'Taquiner', 15: 'Insulter', 24: 'Appel d\'un ami',
            26: 'Blague', 32: 'Apporter un premier secours', 33: 'Faire un tour de magie', 46: 'Appel injurieux',
            54: 'Sourire', 55: 'Serrer la main', 56: 'Faire la bise', 58: 'Envoyer une image marrante',
            61: 'Envoyer un texto amical', 71: 'Hé toi, t\'as de beaux yeux tu sais ?', 73: 'Appel dragueur',
            74: 'Texto dragueur', 79: 'Allez-vous-en !', 80: 'Envoyer un message d\'insulte', 119: 'Yo !',
            121: 'Échanger des ragots au téléphone', 124: 'Jouer à la balle', 154: 'Veuillez ne plus me draguer.',
            156: 'Je ne veux pas que l\'on soit ami(e)s.', 161: 'Clin d\'œil', 162: 'Appel d\'anniversaire',
            166: 'Demander pardon', 171: 'Appel de remerciement'
        }
    },
    6: {
        options: {
            1: 'Saludar', 3: 'Conversar', 4: 'Bromear', 5: 'Provocar', 15: 'Insultar', 24: '¿Qué tal?',
            26: 'Llamada de broma', 32: 'Dar los primeros auxilios', 33: 'Hacer magia divertida',
            46: 'Llamada de "bésame el culo"', 54: 'Sonreír', 55: 'Dar un apretón de manos',
            56: 'Besar en las mejillas', 58: 'Enviar una foto divertida', 61: 'Enviar un mensaje amistoso',
            71: 'Hola, ¿cómo va eso?', 73: 'Llamada de flirteo', 74: 'Mensaje de flirteo', 79: '¡Mandar a la porra!',
            80: 'Enviar mensaje insultante', 119: '¡Oye!', 121: 'Cotillear por teléfono', 124: 'Jugar al pilla-pilla',
            154: 'Por favor, no tontees conmigo.', 156: 'No quiero que seamos amigos.', 161: 'Guiñar el ojo',
            162: 'Llamada de cumpleaños', 166: 'Decir lo siento', 171: 'Llamada de agradecimiento'
        }
    },
    7: {
        options: {
            1: 'Hils', 3: 'Snakk med', 4: 'Fortell en vits', 5: 'Ert', 15: 'Fornærm', 24: 'Hvaskjera telefon',
            26: 'Tulleringe', 32: 'Gi førstehjelp', 33: 'Gjør et triks', 46: '"Kiss my ass"-telefon', 54: 'Smil',
            55: 'Håndhilse', 56: 'Kyss kinnet', 58: 'MMS morsomt bilde', 61: 'SMS vennlig melding',
            71: 'Hei sexy! Hva skjer\'a?', 73: 'Flørtete telefonsamtale', 74: 'Flørtete SMS', 79: 'Stikk av!',
            80: 'SMS fornærmelse', 119: 'Yo!', 121: 'Sladre på telefonen', 124: 'Kaste ball',
            154: 'Slutt å flørt med meg.', 156: 'Jeg vil ikke være venner.', 161: 'Blunke', 162: 'Bursdagshilsen',
            166: 'Si at jeg er lei meg', 171: 'Tusen takk telefonsamtale'
        }
    },
    8: {
        options: {
            1: 'Hils', 3: 'Snak med', 4: 'Fortæl vittighed', 5: 'Dril', 15: 'Fornærm', 24: 'Hva\' sååå opkald',
            26: 'Telefonfis', 32: 'Giv førstehjælp', 33: 'Lav sjov magi', 46: 'Rend mig i røven-opkald', 54: 'Smil',
            55: 'Giv hånden', 56: 'Kys kind', 58: 'MMS sjovt billede', 61: 'SMS venlig besked',
            71: 'Hej frække, hvor\'n skær\'n?', 73: 'Flirtende opkald', 74: 'Flirtende SMS', 79: 'Forsvind!',
            80: 'Fornærmende SMS', 119: 'Yo!', 121: 'Sladder over telefonen', 124: 'Leg fange',
            154: 'Lad være med at flirte med mig.', 156: 'Jeg vil ikke være venner.', 161: 'Blink',
            162: 'Fødselsdagsopkald', 166: 'Sig du er ked af det', 171: 'Ring og sig tak'
        }
    },
    9: {
        options: {
            1: 'Tervehdi', 3: 'Juttele', 4: 'Kerro vitsi', 5: 'Kiusoittele', 15: 'Loukkaa', 24: 'Wazzup-puhelu',
            26: 'Pilasoitto', 32: 'Anna ensiapua', 33: 'Tee taikatemppu', 46: 'Haista home -puhelu', 54: 'Hymyile',
            55: 'Kättele', 56: 'Suutele poskia', 58: 'Lähetä hauska multimediaviesti',
            61: 'Lähetä ystävällinen tekstiviesti', 71: 'Hei seksikäs, käyt sä usein täällä?',
            73: 'Flirttaileva puhelinsoitto', 74: 'Flirttaileva tekstiviesti', 79: 'Suksi kuuseen!',
            80: 'Loukkaava tekstiviesti', 119: 'Yo!', 121: 'Juorua puhelimessa', 124: 'Kopittele pallolla',
            154: 'Lopeta tuo flirttailu.', 156: 'En halua, että me olisimme ystäviä.', 161: 'Iske silmää',
            162: 'Syntymäpäiväpuhelu', 166: 'Pyydä anteeksi', 171: 'Kiitospuhelu'
        }
    },
    10: {
        options: {
            1: 'Groet', 3: 'Maak praatje', 4: 'Vertel grap', 5: 'Plaag', 15: 'Beledig',
            24: '"Hoe gaat ie?" telefoontje', 26: 'Plaag telefoontje', 32: 'Verleen eerste hulp',
            33: 'Doe grappige goocheltruc', 46: 'Lik m\'n reet telefoontje', 54: 'Lach', 55: 'Schud de hand',
            56: 'Kus op de wangen', 58: 'SMS grappige foto', 61: 'SMS iets aardigs',
            71: 'Hoi sexy, hoe gaat het ermee?', 73: 'Flirt per telefoon', 74: 'Flirt per SMS', 79: 'Rot op',
            80: 'SMS belediging', 119: 'Yo!', 121: 'Roddel per telefoon', 124: 'Speel pakkertje',
            154: 'Houd alsjeblieft op met me te flirten', 156: 'Ik wil niet met je bevriend zijn', 161: 'Knipoog',
            162: 'Verjaardagstelefoontje', 166: 'Bied je excuses aan', 171: 'Bedankt telefoontje'
        }
    },
    11: {
        options: {
            1: 'Cumprimentar', 3: 'Falar com', 4: 'Contar anedota', 5: 'Provocar', 15: 'Insultar',
            24: 'Chamada para dizer olá', 26: 'Chamada de travessura', 32: 'Prestar primeiros-socorros',
            33: 'Fazer uma Magia', 46: 'Chamada insultuosa', 54: 'Sorrir', 55: 'Dar aperto de mão',
            56: 'Beijar as bochechas', 58: 'Foto engraçada MMS', 61: 'Texto simpático SMS',
            71: 'Olá sexy, como é que estás?', 73: 'Chamada de engate', 74: 'SMS de engate', 79: 'Põe-te a milhas!',
            80: 'SMS insultuosa', 119: 'Yo!', 121: 'Cuscar ao telefone', 124: 'Jogar à apanhada',
            154: 'Pára de me tentar seduzir por favor.', 156: 'Não quero que sejamos amigos.', 161: 'Piscar o olho',
            162: 'Chamada de feliz aniversário', 166: 'Pedir desculpa', 171: 'Chamada de Agradecimento'
        }
    },
    13: {
        options: {
            1: 'Pozdrów', 3: 'Porozmawiaj', 4: 'Opowiedz kawał', 5: 'Podrocz się', 15: 'Obraź', 24: 'Co słychać?',
            26: 'Żart telefoniczny', 32: 'Udziel pierwszej pomocy', 33: 'Zrób magiczną sztuczkę',
            46: 'Pocałuj mnie gdzieś!', 54: 'Uśmiechnij się', 55: 'Podaj rękę', 56: 'Całuj w policzki',
            58: 'Wyślij śmieszny obrazek SMS-em', 61: 'Wyślij przyjaznego SMS-a', 71: 'Jak się masz, słodziaku?',
            73: 'Flirt przez telefon', 74: 'SMS-owy flirt', 79: 'Odwal się!', 80: 'Obraźliwy SMS', 119: 'Joł!',
            121: 'Plotki przez telefon', 124: 'Baw się w ganianego', 154: 'Przestań ze mną flirtować.',
            156: 'Nie chcę Cię znać.', 161: 'Mrugnij', 162: 'Urodzinowa rozmowa telefoniczna', 166: 'Przeproś',
            171: 'Telefoniczne podziękowania'
        }
    },
    14: {
        options: {
            1: 'Приветствовать', 3: 'Поговорить', 4: 'Рассказать анекдот', 5: 'Дразнить', 15: 'Оскорбить',
            24: 'Узнать, как дела', 26: 'Приколоться', 32: 'Оказать первую помощь', 33: 'Показать смешные фокусы',
            46: 'Послать в жопу', 54: 'Улыбнуться', 55: 'Пожать руку', 56: 'Поцеловать в щёчку',
            58: 'Отправить смешную MMS-картинку', 61: 'Отправить дружескую смску', 71: 'Эй секси, как поживаешь?',
            73: 'Позвонить и пофлиртовать', 74: 'Отправить кокетливую смс', 79: 'Отвали!',
            80: 'Отправить смс с оскорблением', 119: 'Эй!', 121: 'Посплетничать', 124: 'Поиграть в мяч',
            154: 'Попросить перестать со мной флиртовать.', 156: 'Я не хочу с тобой дружить.', 161: 'Подмигнуть',
            162: 'Поздравить с днём рождения', 166: 'Извиниться', 171: 'Позвонить и поблагодарить'
        }
    },
    19: {
        options: {
            1: 'Selamla', 3: 'Konuş', 4: 'Fıkra anlat', 5: 'Şakalaş', 7: 'İçki ısmarla', 8: 'Sarıl', 9: 'Öp',
            10: 'Tutkulu öp', 11: 'Seviş', 12: 'Gıdıkla', 13: 'Ayaküstü bi\' posta', 14: 'İltifat et',
            15: 'Hakaret et', 18: 'Oyna', 19: 'Tantrik seks', 20: 'Şaplak at', 21: 'Şarkı söyle',
            24: 'N\'aber demek için ara', 25: 'Açık saçık konuş', 26: 'İşletmek için ara', 29: 'Öğrencilik talep et',
            30: 'Okşa', 32: 'İlk yardımda bulun', 33: 'Komik büyü yap', 34: 'Ciddi konulardan bahset',
            35: 'Dansa kaldır', 39: 'Kutsa', 40: 'Lanetle', 44: 'Masaj yap', 46: 'Aç telefonu saydır',
            47: 'Eski günlerden bahset', 49: 'Dürtükle', 51: 'Yatıştır', 54: 'Gülümse', 55: 'El sıkış',
            56: 'Yanaklarından öp', 57: 'Arkadaşlık et', 58: 'Komik resimli SMS at', 59: 'Kaynaş',
            60: 'Çak bi\' beşlik', 61: 'Dostane bir SMS at', 62: 'Fikir alışverişinde bulun', 63: 'Sırtını sıvazla',
            64: 'Bağrına bas', 65: 'Dedikodu et', 66: 'Saçını ör', 67: 'Bilek güreşi yap', 68: 'Tavsiye ver',
            69: 'Sırlarını paylaş', 70: 'Takıl', 71: 'Hey seksi şey, n\'aber?', 73: 'Telefonda yaz',
            74: 'Asılmak için SMS at', 75: 'Öv', 76: 'Belden aşağı bir fıkra anlat', 77: '"Seni seviyorum!" de',
            78: 'Serenat yap', 79: 'S*ktir lan!', 80: 'Aşağılayıcı bir SMS gönder', 89: 'Bisepslerini aç',
            119: 'N\'aber!', 121: 'Telefonda dedikodu et', 124: 'Elim sende oyna', 129: 'El ele dolaş',
            139: 'Notlarını karşılaştır', 145: 'Geleceğe dair planlar yap', 147: 'Rol yap', 149: 'Eşine iltifat et',
            154: 'Lütfen bana asılmayı kes.', 156: 'Arkadaş olmak falan istemiyorum.',
            157: 'Sorun sen değilsin, benim...', 161: 'Göz kırp', 162: 'Doğum gününü kutlamak için ara',
            164: 'Kobe Sutra\'nın Tadını Çıkar', 165: 'Aşk meşk için ara', 166: 'Özür dile',
            167: '"Arrr!" diye haykır', 168: '"Ahoy, canımın içi!" de', 169: '"Yo ho ho!" de',
            171: 'Teşekkür etmek için ara'
        }
    },
    23: {
        options: {
            1: 'Salută', 3: 'Discutaţi', 4: 'Spune banc', 5: 'Tachinează', 15: 'Insultă', 24: 'Telefon de bineţe',
            26: 'Farsă', 32: 'Oferă primul ajutor', 33: 'Scamatorie haioasă', 46: 'Pupă-mă-n fund!', 54: 'Zâmbeşte',
            55: 'Dă mâna', 56: 'Sărută obrajii', 58: 'SMS poză amuzantă', 61: 'SMS amical',
            71: 'Hei sexy, ce mai faci?', 73: 'Telefon de flirt', 74: 'SMS de flirt', 79: 'Du-te naiba!',
            80: 'SMS de insultă', 119: 'Yo!', 121: 'Bârfeşte la telefon', 124: 'Joacă prinselea',
            154: 'Te rog, nu mai flirta cu mine', 156: 'Nu vreau să fim prieteni.', 161: 'Fă cu ochiul',
            162: 'Apel zi de naștere', 166: 'Spune "Îmi pare rău"', 171: 'Apel de mulțumire'
        }
    },
    24: {
        options: {
            1: 'Greet', 3: 'Talk to', 4: 'Tell joke', 5: 'Tease', 7: 'Buy a drink', 8: 'Hug', 9: 'Kiss',
            10: 'Kiss passionately', 11: 'Make love', 12: 'Tickle', 13: '5 minute quickie', 14: 'Compliment',
            15: 'Insult', 18: 'Play with', 19: 'Tantric sex', 20: 'Spank', 21: 'Sing to', 24: 'Wazzup call',
            25: 'Dirty call', 26: 'Prank call', 29: 'Seek apprenticeship', 30: 'Caress', 32: 'Give first aid',
            33: 'Do funny magic', 34: 'Have profound discussion', 35: 'Ask for a dance', 44: 'Give massage',
            46: 'Kiss my arse call', 51: 'Comfort', 54: 'Smile', 55: 'Shake hands', 56: 'Kiss cheeks',
            57: 'Fraternise', 58: 'Send funny pic MMS', 59: 'Rub elbows', 60: 'High five', 61: 'Send friendly text',
            62: 'Share opinions', 63: 'Pat on back', 64: 'Embrace', 65: 'Gossip', 66: 'Plait hair', 67: 'Arm wrestle',
            68: 'Offer advice', 69: 'Share secrets', 70: 'Hang out', 71: 'Hey sexy, how you doin\'?',
            73: 'Flirty phone call', 74: 'Flirty text', 75: 'Praise', 76: 'Tell naughty joke', 77: 'Say I love you',
            78: 'Serenade', 79: 'Piss off!', 80: 'Send insulting text', 119: 'Yo!', 121: 'Gossip on phone',
            124: 'Play catch', 154: 'Please stop flirting with me.', 156: 'I don\'t want to be friends.',
            157: 'It\'s not you, it\'s me...', 158: 'Do the fish slapping dance', 161: 'Wink', 162: 'Birthday call',
            164: 'Enjoy Kobe Sutra', 165: 'Romantic call', 166: 'Say I\'m sorry', 167: 'Say Arrr!',
            168: 'Say Ahoy, me hearty!', 169: 'Say Yo ho ho!', 171: 'Thank You call'
        }
    },
    33: {
        options: {
            1: 'Üdvözlés', 3: 'Beszélgetés', 4: 'Viccmesélés', 5: 'Ugratás', 15: 'Inzultálás', 24: 'Mizujs hívás',
            26: 'Vicces hívás', 32: 'Elsősegélynyújtás', 33: 'Vicces varázslat', 46: 'Csókold meg a seggem!',
            54: 'Mosolygás', 55: 'Kézfogás', 56: 'Puszi az arcra', 58: 'Vicces mms küldés', 61: 'Baráti sms küldés',
            71: 'Na mi a helyzet, szexi?', 73: 'Flörtölős hívás', 74: 'Flörtölős sms', 79: 'Kopj le!',
            80: 'Sértő sms küldés', 119: 'Hé!', 121: 'Telefonon pletykálkodás', 124: 'Fogócskázás',
            154: 'Kérlek, fejezd be a flörtölést!', 156: 'Nem akarok a barátod lenni.', 161: 'Kacsintás',
            162: 'Születésnapi hívás', 166: 'Kérj bocsánatot', 171: 'Köszönő hívás'
        }
    },
    36: {
        options: {
            1: 'Tervita', 3: 'Räägi', 4: 'Naljata', 5: 'Õrrita', 15: 'Solva', 24: '"Kuidas läheb"-kõne',
            26: 'Tüngakõne', 32: 'Anna esmaabi', 33: 'Tee naljakas trikk', 46: '\'Mine perse\'-kõne', 54: 'Naerata',
            55: 'Suru kätt', 56: 'Suudle põsele', 58: 'SMSi naljakas pilt', 61: 'SMSi sõbralik jutt',
            71: 'Hei, kaunitar, kuidas läheb?', 73: 'Flirtiv telefonikõne', 74: 'Flirtiv SMS', 79: 'Tõmba uttu!',
            80: 'SMS-solvang', 119: 'Yo!', 121: 'Klatši telefonitsi', 124: 'Mängi kulli',
            154: 'Palun, lõpeta see flirt', 156: 'Ma ei soovi su sõber olla', 161: 'Pilguta silma',
            162: 'Sünnipäevakõne', 166: 'Palu andestust', 171: 'Tänukõne'
        }
    },
    39: {
        options: {
            1: 'Pozdravi', 3: 'Razgovaraj', 4: 'Ispričaj šalu', 5: 'Zadirkuj', 15: 'Uvrijedi', 24: 'Alo, di si poziv',
            26: 'Šaljivi poziv', 32: 'Ukaži prvu pomoć', 33: 'Izvedi magičan trik', 46: '"Poljubi me u dupe" poziv',
            54: 'Nasmiješi se', 55: 'Rukuj se', 56: 'Poljubi obraze', 58: 'SMSaj smiješnu sliku',
            61: 'SMSaj prijateljski tekst', 71: 'Hej seksi, kak\' si?', 73: 'Flertujući poziv', 74: 'Flertujući SMS',
            79: 'Marš od mene!', 80: 'SMSaj uvredu', 119: 'Yo!', 121: 'Tračaj preko telefona', 124: 'Igraj se lovice',
            154: 'Molim te prestani flertovati sa mnom.', 156: 'Ne želim ti biti prijatelj', 161: 'Namigni',
            162: 'Rođendanski Poziv', 166: 'Reci "oprosti"', 171: '"Hvala ti" poziv'
        }
    },
    43: {
        options: {
            1: 'Поздрави', 3: 'Разговаряй', 4: 'Кажи виц', 5: 'Пошегувай се', 15: 'Обиди', 24: 'Как е хавата?',
            26: 'Шеговито обаждане', 32: 'Окажи първа помощ', 33: 'Направи смешна магия', 46: 'Цуни ме отзад!',
            54: 'Усмихни се', 55: 'Здрависай се', 56: 'Целуни по бузите', 58: 'Смешна снимка на MMS',
            61: 'Изпрати приятелски SMS', 71: 'Хей секси, какво правиш?', 73: 'Флиртувай по телефона',
            74: 'Флиртувай с SMS', 79: 'Разкарай се!', 80: 'SMS обида', 119: 'Йо!', 121: 'Клюкарствай по телефона',
            124: 'Хвърляй топка', 154: 'Моля те, спри да флиртуваш с мен!', 156: 'Не искам да сме приятели.',
            161: 'Намигни', 162: 'Обаждане за рожден ден', 166: 'Извини се', 171: 'Обади се да благодариш'
        }
    },
    50: {
        options: {
            1: 'Cumprimentar', 3: 'Conversar', 4: 'Contar piada', 5: 'Fazer graça', 6: 'Gugu-dadá',
            7: 'Oferecer bebida', 8: 'Abraçar', 9: 'Beijar', 10: 'Beijar apaixonadamente', 11: 'Fazer amor',
            12: 'Fazer cócegas', 13: 'Rapidinha', 14: 'Elogiar', 15: 'Insultar', 18: 'Brincar com',
            19: 'Sexo tântrico', 20: 'Dar uns tapinhas...', 21: 'Cantar para', 24: 'Ligar para papear',
            25: 'Ligação safadinha', 26: 'Passar trote', 29: 'Buscar aprendizagem', 30: 'Acariciar',
            32: 'Fazer primeiros socorros', 33: 'Fazer uma mágica divertida', 34: 'Ter uma discussão profunda',
            35: 'Tirar para dançar', 44: 'Fazer massagem', 46: 'Ligar para xingar', 51: 'Consolar', 52: 'Acalmar',
            54: 'Sorrir', 55: 'Aperto de mão', 56: 'Beijar o rosto', 57: 'Fraternizar',
            58: 'Mandar foto engraçada por MMS', 59: 'Passar um tempo junto', 60: 'High Five',
            61: 'Mandar mensagem no celular', 62: 'Dizer o que pensa', 63: 'Tapinha nas costas', 64: 'Envolver',
            65: 'Fofocar', 66: 'Trançar o cabelo', 67: 'Queda de braço', 68: 'Dar conselhos', 69: 'Contar segredos',
            70: 'Dar uma volta', 71: 'Você vem sempre aqui?', 73: 'Ligar para flertar', 74: 'Flertar por SMS',
            75: 'Louvar', 76: 'Contar piada safada', 77: 'Dizer "eu amo você"', 78: 'Fazer serenata',
            79: 'Vai se ferrar!', 80: 'Insultar por SMS', 89: 'Mostrar os músculos', 93: 'Pegar no colo',
            94: 'Auxiliar', 100: 'Perguntar coisas', 101: 'Explicar coisas', 102: 'Bagunçar o cabelo',
            103: 'Beijinho na testa', 104: 'Contar conto-de-fadas', 106: 'Admirar', 119: 'Ae!',
            121: 'Fofocar ao telefone', 124: 'Brincar de pega-pega', 127: 'Guerra de travesseiros',
            129: 'Caminhar de mãos dadas', 144: 'Discutir sobre dinheiro', 145: 'Planejar o futuro',
            146: 'Lavar a louça', 147: 'Brincar de médico', 149: 'Elogiar a aparência', 150: 'Depilar/Barbear',
            151: 'Beliscar as gordurinhas', 154: 'Pare de flertar comigo, por favor.',
            156: 'Eu não quero amizade com você.', 157: 'Não é você, o problema é comigo...',
            158: 'Dançar o fish slapping', 160: 'Gritar', 161: 'Piscar', 162: 'Ligação de aniversário',
            164: 'Desfrutar do Kobe Sutra', 165: 'Ligação romântica', 166: 'Pedir desculpas', 167: 'Dizer "Arrr!"',
            168: 'Dizer "Saudações, marujos!"', 169: 'Dizer "Yo ho ho!"', 171: 'Ligar para agradecer'
        }
    },
    51: {
        options: {
            1: 'Saludar', 3: 'Conversar', 4: 'Contar un chiste', 5: 'Bromear', 6: 'Cuchi cuchi',
            7: 'Invitar una bebida', 8: 'Abrazar', 9: 'Besar', 10: 'Besar apasionadamente', 11: 'Hacer el amor',
            12: 'Hacer cosquillas', 13: 'Aventura de una noche', 14: 'Hacer un cumplido', 15: 'Insultar', 18: 'Jugar',
            19: 'Sexo tántrico', 20: 'Azotar', 21: 'Cantar', 24: '¿Qué tal?', 25: 'Llamada pícara',
            26: 'Llamada bromista', 27: 'Guiñar un ojo', 29: 'Pedir enseñanza', 30: 'Acariciar',
            32: 'Dar los primeros auxilios', 33: 'Hacer un truco de magia', 34: 'Tener una charla interesante',
            35: 'Invitar a bailar', 44: 'Hacer un masaje', 46: 'Vete al carajo', 51: 'Confortar', 52: 'Calmar',
            54: 'Sonreír', 55: 'Estrechar la mano', 56: 'Besar mejillas', 57: 'Fraternizar',
            58: 'Mensaje de fotos graciosas', 59: 'Codearse', 60: 'Dame los cinco', 61: 'Mensaje de texto amigable',
            62: 'Compartir opiniones', 63: 'Palmada en la espalda', 64: 'Abrazar apasionadamente', 65: 'Chismear',
            66: 'Trenzar cabello', 67: 'Jugar una pulseada', 68: 'Ofrecer consejo', 69: 'Compartir secretos',
            70: 'Salir un rato', 71: 'Hola sexy, ¿cómo estás?', 73: 'Llamada de coqueteo', 74: 'Mensaje de coqueteo',
            75: 'Elogiar', 76: 'Contar un chiste picante', 77: 'Decir "Te amo"', 78: 'Dar una serenata',
            79: '¡Cállate!', 80: 'Mensaje de texto ofensivo', 89: 'Flexionar los bíceps', 93: 'Cargar',
            97: 'Hablar mal de los padres', 98: 'Hablar sobre los pasatiempos', 99: 'Jugar al escondite',
            100: 'Preguntar acerca de cosas', 101: 'Explicar cosas', 102: 'Despeinar pelo', 103: 'Besar la frente',
            104: 'Contar cuentos de hadas', 105: 'Cuando yo era joven...', 106: 'Admirar', 117: 'Jugar a las canicas',
            119: '¡Yo!', 120: 'Dar un vistazo previo', 121: 'Chismear por teléfono', 122: 'Pellizcar',
            123: 'Mirar fijamente a los ojos', 124: 'Jugar a atrapar', 125: 'Besuquear', 126: 'Acariciar',
            127: 'Pelea de almohadas', 129: 'Pasear de la mano', 144: 'Discutir sobre dinero',
            145: 'Hacer planes para el futuro', 147: 'Rolear', 149: 'Piropear', 151: 'Apretar los rollitos',
            154: 'Deja de coquetear conmigo, por favor.', 156: 'No quiero que seamos amigos.',
            157: 'No eres tú, soy yo...', 160: 'Chillar', 161: 'Guiño', 162: 'Llamada de cumpleaños',
            164: 'Disfrutar del Kobe Sutra', 166: 'Decir “Lo siento”', 171: 'Llamada de agradecimiento'
        }
    },
    56: {
        options: {
            1: 'Pasisveikinti', 3: 'Pasikalbėti', 4: 'Suskelti juokelį', 5: 'Paerzinti', 15: 'Įžeisti',
            24: '„Kaip sekasi?“ skambutis', 26: 'Skambutis-pokštas', 32: 'Suteikti pirmąją pagalbą',
            33: 'Atlikti triuką', 46: '„Pabučiuok į užpakalį!“ skambutis', 54: 'Nusišypsoti', 55: 'Paspausti ranką',
            56: 'Pabučiuoti į skruostą', 58: 'Nusiųsti linksmą MMS žinutę', 61: 'Nusiųsti draugišką žinutę',
            71: '„Labas, mažut, kaip sekasi?..“', 73: 'Koketiškas skambutis', 74: 'SMS flirtas',
            79: 'Liepti nešdintis', 80: 'Nusiųsti įžeidžiančią žinutę', 119: '„Ei!“', 121: 'Liežuvauti telefonu',
            124: 'Žaisti gaudynių', 154: '„Nebeflirtuok su manimi...“', 156: '„Nebenoriu draugauti...“',
            161: 'Mirktelėti', 162: 'Gimtadienio skambutis', 166: 'Atsiprašyti', 171: 'Padėkos skambutis'
        }
    },
    60: {
        options: {
            1: 'Saludar', 3: 'Conversar', 4: 'Bromear', 5: 'Burlar', 7: 'Invitar un trago', 8: 'Abrazar', 9: 'Besar',
            10: 'Besar apasionadamente', 12: 'Hacer cosquillas', 14: 'Halagar', 15: 'Insultar', 18: 'Jugar',
            21: 'Cantar', 24: '¿Cómo va?', 26: 'Llamada de broma', 29: 'Pedir aprendizaje', 30: 'Acariciar',
            32: 'Dar primeros auxilios', 33: 'Hacer magia divertida', 34: 'Tener una discusión profunda',
            35: 'Pedir un baile', 46: 'Llamada de besame el culo', 47: 'Hablar sobre los viejos tiempos',
            51: 'Reconfortar', 54: 'Sonreir', 55: 'Apretón de manos', 56: 'Besar en las mejillas', 57: 'Fraternizar',
            58: 'Foto divertida por MMS', 59: 'Codearse', 60: 'Chocar los cinco', 61: 'SMS amistoso',
            62: 'Compartir opiniones', 63: 'Palmadita en la espalda', 64: 'Manosear', 65: 'Chusmear',
            66: 'Hacer trenzas', 67: 'Pulseada', 68: 'Dar consejo', 69: 'Compartir secretos', 70: 'Pasar el rato',
            71: 'Hey sexy, ¿cómo te va?', 73: 'Llamada de flirteo', 74: 'SMS de flirteo', 75: 'Alabar',
            76: 'Contar un chiste verde', 77: 'Decir te amo', 78: 'Serenata', 79: '¡Mandar a la mierda!',
            80: 'SMS con insultos', 119: '¡Che!', 121: 'Chusmear por teléfono', 124: 'Jugar a atrapar la pelota',
            154: 'Por favor dejá de flirtear conmigo.', 156: 'No quiero que seamos amigos.',
            158: 'Hacer el baile del abofeteo del pescado.', 161: 'Guiñar un ojo', 162: 'Llamada de cumpleaños',
            166: 'Decir lo siento', 171: 'Llamada de agradecimiento'
        }
    },
    106: {
        options: {
            1: '问候', 3: '聊天', 4: '说个笑话', 5: '取笑', 15: '侮辱', 24: '询问近况', 26: '恶作剧', 32: '进行急救', 33: '表演有趣的魔术',
            46: '挑衅电话', 54: '微笑', 55: '握手', 56: '亲吻脸颊', 58: '用手机发送趣图', 61: '手机发送友好短信', 71: '嗨宝贝儿，最近怎样？', 73: '打电话调情',
            74: '发短信调情', 79: '滚开！', 80: '短信侮辱', 119: '哟！', 121: '打电话闲聊', 124: '打球', 154: '请停止与我调情。', 156: '我不想与你做朋友。',
            161: '抛媚眼', 162: '生日祝福电话', 166: '说对不起', 171: '致谢电话'
        }
    }
};

// Every spelling of the Phone group, in all the languages. It is language-agnostic on purpose: the group is
// recognized by its data-group value whatever the game language is, so no language lookup is needed.
const INTERACTION_PHONE_GROUP_LABELS = new Set(Object.values(INTERACTION_GROUP_NAMES.phone));
