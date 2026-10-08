// Game wording of the interaction groups, per game language id (the ids of Utils.getGameLanguage()).
//
// The Interact page tags every option with a localized data-group (e.g. "Phone" is "Telefoniche" in Italian), so
// the group name cannot be compared with an English string. The names below were read from the interaction
// dropdown of the Interact page in each of the 25 game languages. Only the groups that dropdown showed for the
// scraped character pair are listed: more are expected to be added by the community collection.
const INTERACTION_GROUP_NAMES = {
    basic: {
        1: 'Grundläggande', 2: 'Basic', 3: 'Grundlegend', 4: 'Base', 5: 'Élémentaires', 6: 'Básica', 7: 'Grunnleggende',
        8: 'Basal', 9: 'Perus', 10: 'Basis', 11: 'Básicas', 13: 'Podstawowe', 14: 'Основные', 19: 'Temel', 23: 'De Bază',
        24: 'Basic', 33: 'Alap', 36: 'Üldine', 39: 'Osnovne', 43: 'Обикновени', 50: 'Básicas', 51: 'Básicas',
        56: 'Pradinis', 60: 'Básica', 106: '普通类'
    },
    verbal: {
        1: 'Verbalt', 2: 'Verbal', 3: 'Mündlich', 4: 'Verbali', 5: 'Verbales', 6: 'Verbal', 7: 'Verbalt', 8: 'Verbal',
        9: 'Puhe', 10: 'Verbaal', 11: 'Verbais', 13: 'Werbalne', 14: 'Вербальные', 19: 'Sözlü', 23: 'Verbal',
        24: 'Verbal', 33: 'Szóbeli', 36: 'Suuline', 39: 'Usmene', 43: 'Вербални', 50: 'Verbais', 51: 'Verbales',
        56: 'Žodinis', 60: 'Verbal', 106: '言辞'
    },
    phone: {
        1: 'Över telefonen', 2: 'Phone', 3: 'Telefonisch', 4: 'Telefoniche', 5: 'Téléphoniques', 6: 'Telefónica',
        7: 'Telefon', 8: 'Telefon', 9: 'Puhelin', 10: 'Telefoon', 11: 'Telefónicas', 13: 'Telefoniczne', 14: 'Телефон',
        19: 'Telefon', 23: 'Telefon', 24: 'Phone', 33: 'Telefonos', 36: 'Telefon', 39: 'Telefonske', 43: 'Телефон',
        50: 'Telefônicas', 51: 'Telefónicas', 56: 'Telefoninis', 60: 'Telefónica', 106: '电话'
    },
    medical: {
        1: 'Medicinskt', 2: 'Medical', 3: 'Medizinisch', 4: 'Mediche', 5: 'Médicales', 6: 'Médica', 7: 'Medisinsk',
        8: 'Medicinsk', 9: 'Lääketieteellinen', 10: 'Medisch', 11: 'Médicas', 13: 'Medyczne', 14: 'Медицинские',
        19: 'Tıbbî', 23: 'Medical', 24: 'Medical', 33: 'Gyógyászati', 36: 'Meditsiiniline', 39: 'Medicinske',
        43: 'Здравни', 50: 'Médicas', 51: 'Medicinales', 56: 'Medicininis', 60: 'Médica', 106: '医学的'
    }
};

// Every spelling of the Phone group, in all the languages. It is language-agnostic on purpose: the group is
// recognized by its data-group value whatever the game language is, so no language lookup is needed.
const INTERACTION_PHONE_GROUP_LABELS = new Set(Object.values(INTERACTION_GROUP_NAMES.phone));
