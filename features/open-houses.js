// Big object with all the open houses details
/* Thanks to the following projects to make this possible:
 * - https://75.popmundo.com/Forum/Popmundo.aspx/Thread/2255371.1
 * - https://75.popmundo.com/Forum/Popmundo.aspx/Thread/2284021.1
 */
const openHousesDB = {
    "1": [{
        "name": "Smör:+:gås \"bord",
        "id": 3341178,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Barrowbury",
        "id": 3161976,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "STO Big family house",
        "id": 3188497,
        "features": ["S", "P", "B", "O"]
    }],
    "5": [{
        "name": "Diagon.A:+:Sword \"Magic",
        "id": 3339448,
        "features": ["S", "B", "BL", "P", "O", "X"]
    }, {
        "name": "Lowden Paradise",
        "id": 3165868,
        "features": ["BL", "B", "S", "P", "O"]
    }, {
        "name": "Planet X",
        "id": 3243295,
        "features": ["BL", "B", "S", "P", "O"]
    }, {
        "name": "#SkyHigh",
        "id": 3177647,
        "features": ["BL", "B", "S", "P", "O"]
    }, {
        "name": "Miracles-O-Mystical Realm",
        "id": 3329556,
        "features": ["P", "S", "BL", "B", "O"]
    }, {
        "name": "~ Casa Papaya ~",
        "id": 3325595,
        "features": ["P", "O", "BL", "B", "S"]
    }, {
        "name": "Hjöme sweet hjöme",
        "id": 3320355,
        "features": ["S", "B", "O"]
    }, {
        "name": "The Ninth Circle of Hell",
        "id": 3229739,
        "features": ["S", "O"]
    }, {
        "name": "The Lockhart Mansion",
        "id": 3258135,
        "features": ["B", "BL", "P", "O"]
    }, {
        "name": "The Shemale Mansion",
        "id": 3258179,
        "features": ["BL", "P", "O"]
    }, {
        "name": "Pööriöö Villa",
        "id": 3227843,
        "features": ["S", "B", "P", "O"]
    }, {
        "name": "Mikaela's Pad",
        "id": 3160262,
        "features": ["O"]
    }, {
        "name": "Chugg's Attic",
        "id": 3160512,
        "features": ["S", "O", "B"]
    }, {
        "name": "Fosdyke Penthouse",
        "id": 3161774,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Nicolás estuvo aquí",
        "id": 3199605,
        "features": ["S", "B", "BL", "O"]
    }, {
        "name": "OS#2",
        "id": 3124342,
        "features": ["S", "B", "P", "O", "BL"]
    }, {
        "name": "Jellybean Pen",
        "id": 3160559,
        "features": ["S", "B", "P", "O"]
    }, {
        "name": "Loving hay barns",
        "id": 3158900,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "N-Cube",
        "id": 3204399,
        "features": ["S"]
    }, {
        "name": "Madeleine's Funhouse",
        "id": 3331467,
        "features": ["B", "BL", "P", "O", "X"]
    }, {
        "name": "Wood's Mansion",
        "id": 3306676,
        "features": ["B", "BL", "P", "O"]
    }, {
        "name": "The Black Maиsioи",
        "id": 3326187,
        "features": ["B", "P", "O"]
    }, {
        "name": "LO Big Family House",
        "id": 3162105,
        "features": ["P", "S", "O"]
    }, {
        "name": "House of Yes",
        "id": 3267534,
        "features": ["O"]
    }, {
        "name": "Ode to my Coffee Bean",
        "id": 3269907,
        "features": ["S", "O"]
    }, {
        "name": "The Stoner Fatale Ranch",
        "id": 3266152,
        "features": ["BL", "P", "O"]
    }],
    "6": [{
        "name": "Marvel:+:DC \"so Dark!",
        "id": 3339266,
        "features": ["S", "B", "BL", "P", "O", "X"]
    }, {
        "name": "The House That Jack Built",
        "id": 3124531,
        "features": ["S", "O"]
    }, {
        "name": "Quantum Tunnel To Bombay",
        "id": 3161256,
        "features": ["S", "BL", "O"]
    }, {
        "name": "New York Artists Home",
        "id": 2986433,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Tommy's",
        "id": 3195125,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "The little coffe shop",
        "id": 3259328,
        "features": [""]
    }, {
        "name": "N.Y. Big Family House",
        "id": 3200357,
        "features": ["P", "B", "O"]
    }],
    "7": [{
        "name": "Albert:+:Einstein \"Eニmc2",
        "id": 3341221,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "m i n d s c a p e",
        "id": 3231072,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Himmelsgarten",
        "id": 3161092,
        "features": ["S", "O"]
    }, {
        "name": "BER Big family house",
        "id": 3205484,
        "features": ["O"]
    }],
    "8": [{
        "name": "Bar:+:Rococo \"Lolita |AMS",
        "id": 3339578,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Mira, papá",
        "id": 3229994,
        "features": ["B", "O"]
    }, {
        "name": "Palacio d'Amsterdam",
        "id": 3161145,
        "features": ["BL", "P", "B", "S", "O"]
    }, {
        "name": "AMS Big Family House",
        "id": 3216379,
        "features": ["B", "O"]
    }],
    "9": [{
        "name": "Loco:+:4Besos \"Sin Pijama",
        "id": 3339267,
        "features": ["S", "B", "BL", "P", "O", "X"]
    }, {
        "name": "Rancho Chugg",
        "id": 3159414,
        "features": ["S", "P", "O"]
    }, {
        "name": "El Caballo Hacienda",
        "id": 3179879,
        "features": ["S", "O"]
    }, {
        "name": "BAR Big Family House",
        "id": 3218757,
        "features": ["O"]
    }],
    "10": [{
        "name": "Kangaroo:+:Koala \"Wombat",
        "id": 3340689,
        "features": ["S", "B", "BL", "P", "O", "X"]
    }, {
        "name": "Home of the Fickle Fairy",
        "id": 3198312,
        "features": ["B", "BL", "P", "O"]
    }],
    "11": [{
        "name": "Bar:+:Rococo \"Lolita |NAS",
        "id": 3340662,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "NAS Big family house",
        "id": 3188878,
        "features": ["S", "B", "P", "O"]
    }],
    "14": [{
        "name": "Disney:+:Princess \"Castle",
        "id": 3339579,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Ella's Paradise LA",
        "id": 3155839,
        "features": ["S", "P", "O"]
    }, {
        "name": "L.A. Big Family House",
        "id": 3207485,
        "features": ["P", "O"]
    }, {
        "name": "FPPA Sanctuary",
        "id": 3260016,
        "features": ["B", "O"]
    }],
    "16": [{
        "name": "The Külliye of Toronto",
        "id": 3268245,
        "features": ["S", "B", "P", "BL", "O"]
    }, {
        "name": "Judicial Retreat",
        "id": 3160034,
        "features": ["S"]
    }, {
        "name": "TOR Big family house",
        "id": 3219341,
        "features": ["O"]
    }],
    "17": [{
        "name": "Tango:+:Caballero \"Señora",
        "id": 3340667,
        "features": ["S", "B", "BL", "P", "O", "X"]
    }, {
        "name": "Fund. Bs. As. Somos Todos",
        "id": 3303749,
        "features": ["P", "B", "O", "S", "BL"]
    }, {
        "name": "Good Winds",
        "id": 3202410,
        "features": ["S", "O"]
    }, {
        "name": "El Mirador",
        "id": 3161537,
        "features": ["S", "P", "O"]
    }],
    "18": [{
        "name": "Bar:+:Rococo \"Lolita |MOS",
        "id": 3341757,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "sweet home - Moscou",
        "id": 3172295,
        "features": [""]
    }, {
        "name": "MO Big family house",
        "id": 3205941,
        "features": ["B", "O"]
    }, {
        "name": "lyubit' mir i garmoniyu",
        "id": 3278957,
        "features": ["O"]
    }],
    "19": [{
        "name": "Joulu:+:Lahja \"Poro",
        "id": 3341180,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Dasmory",
        "id": 3208968,
        "features": ["S", "BL", "O"]
    }, {
        "name": "Rajamökki",
        "id": 3155730,
        "features": ["S", "BL", "O"]
    }, {
        "name": "The Temple of Kalliope",
        "id": 3237480,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "HEL Big family house",
        "id": 3219338,
        "features": ["B", "O"]
    }],
    "20": [{
        "name": "Baroque:+:Rococo \"Lolita",
        "id": 3331210,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "VOODOO MANSION",
        "id": 3162065,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Centre de Méditation Cyab",
        "id": 3145400,
        "features": [""]
    }, {
        "name": "Paris Surf Camp. LVP.",
        "id": 3237362,
        "features": ["S", "O"]
    }, {
        "name": "PA Big family house",
        "id": 3206891,
        "features": ["O"]
    }],
    "21": [{
        "name": "FIFA:+:Mundo \"Futebol",
        "id": 3340668,
        "features": ["S", "B", "BL", "P", "O", "X"]
    }, {
        "name": "S.P Big family house",
        "id": 3262551,
        "features": ["B", "O"]
    }],
    "22": [{
        "name": "Den:+:lille \"Havfrue",
        "id": 3341914,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Baiad Mansion",
        "id": 3204935,
        "features": ["S", "O"]
    }],
    "23": [{
        "name": "Meglio:+:di \"Sera",
        "id": 3341174,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Parish in Rome",
        "id": 3198853,
        "features": ["S", "P", "O"]
    }, {
        "name": "ROM Big family house",
        "id": 3160151,
        "features": ["S", "O"]
    }, {
        "name": "When in Rome",
        "id": 3243856,
        "features": ["S", "O"]
    }],
    "24": [{
        "name": "Niña:+:De La \"Escuela",
        "id": 3339270,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Melroce Meplace",
        "id": 3158957,
        "features": ["S", "B", "O"]
    }, {
        "name": "MAD Big family house",
        "id": 3208050,
        "features": ["B", "O"]
    }, {
        "name": "Palacio Andalusí",
        "id": 3162492,
        "features": ["B", "BL", "P", "O"]
    }],
    "25": [{
        "name": "Samba:+:Feliz \"Melodia",
        "id": 3340669,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Cloud Nine",
        "id": 3192236,
        "features": ["S", "O"]
    }, {
        "name": "Dragon Seaside Cove",
        "id": 3272012,
        "features": ["S", "BL", "B", "P", "O"]
    }, {
        "name": "EDU's GOO",
        "id": 3199641,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Church of the Iron Duck",
        "id": 3160797,
        "features": ["B", "BL", "P", "O"]
    }, {
        "name": "Hottage",
        "id": 3241617,
        "features": ["O"]
    }, {
        "name": "RIO Big family house",
        "id": 3207693,
        "features": ["P", "B", "BL", "O"]
    }, {
        "name": "Villa de Amor",
        "id": 3283824,
        "features": ["S", "B", "P", "O"]
    }],
    "26": [{
        "name": "Atlantique Nord",
        "id": 3192752,
        "features": ["O"]
    }, {
        "name": "In Transit",
        "id": 3204426,
        "features": ["S", "B", "O"]
    }, {
        "name": "Dave & Destiny",
        "id": 3206522,
        "features": ["S", "O"]
    }],
    "27": [{
        "name": "Bar:+:Rococo \"Lolita |GLA",
        "id": 3341756,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "St. Mungo's",
        "id": 3205233,
        "features": ["S", "O"]
    }, {
        "name": "that old deserted cottage",
        "id": 3008769,
        "features": ["S", "O"]
    }, {
        "name": "GLA Big Family House",
        "id": 3210891,
        "features": ["O"]
    }, {
        "name": "Trongate",
        "id": 3266915,
        "features": ["B", "BL", "P", "S", "O"]
    }],
    "28": [{
        "name": "Bar:+:Rococo \"Lolita |VIL",
        "id": 3341761,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Roux Davenport Galerija",
        "id": 3335134,
        "features": ["S", "P", "B", "O"]
    }, {
        "name": "Rojaus g. 13",
        "id": 3212630,
        "features": ["P", "O"]
    }],
    "29": [{
        "name": "Bar:+:Rococo \"Lolita |DUB",
        "id": 3341911,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Smelly Zombie",
        "id": 3200488,
        "features": ["S", "O"]
    }, {
        "name": "Guvernerova Palača",
        "id": 3205457,
        "features": ["B", "O", ""]
    }],
    "30": [{
        "name": "Sıcak:+:Hava \"Balon",
        "id": 3339402,
        "features": ["S", "B", "BL", "P", "O", "X"]
    }, {
        "name": "Don't park your Mercedes",
        "id": 3228756,
        "features": ["O"]
    }, {
        "name": "IST Big Family House",
        "id": 3224963,
        "features": ["S", "B", "O"]
    }],
    "31": [{
        "name": "Pastéis:+:de Belém \"1837",
        "id": 3341262,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Sex Passion True Love",
        "id": 2986566,
        "features": ["S", "P", "O"]
    }],
    "32": [{
        "name": "Bar:+:Rococo \"Lolita |MEX",
        "id": 3340666,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Ándele, ándele, ándele..",
        "id": 3218344,
        "features": ["S", "B", "O"]
    }, {
        "name": "MEX Big family house",
        "id": 3179478,
        "features": ["B", "O"]
    }],
    "33": [{
        "name": "Bar:+:Rococo \"Lolita |BRU",
        "id": 3341754,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Praatcafee",
        "id": 2965425,
        "features": ["S", "B", "BL", "O"]
    }, {
        "name": "180, Boulevard des Cyprès",
        "id": 3164232,
        "features": ["O"]
    }],
    "34": [{
        "name": "Bar:+:Rococo \"Lolita |TAL",
        "id": 3341179,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Random House",
        "id": 3153221,
        "features": ["S", "O"]
    }, {
        "name": "Casherosa",
        "id": 3169289,
        "features": ["S", "P", "BL", "B", "O"]
    }],
    "35": [{
        "name": "Dostlar Konağı",
        "id": 3338952,
        "features": ["S", "BL", "P", "O"]
    }, {
        "name": "Bar:+:Rococo \"Lolita |ANK",
        "id": 3339582,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "ANK Big family house",
        "id": 3197921,
        "features": ["S", "B", "P", "BL", "O"]
    }],
    "36": [{
        "name": "Fruškogorska Koliba",
        "id": 3161317,
        "features": [""]
    }, {
        "name": "BEL Big family house",
        "id": 3218479,
        "features": ["B"]
    }],
    "38": [{
        "name": "Bar:+:Rococo \"Lolita |MON",
        "id": 3340665,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "MON Big family house",
        "id": 3218991,
        "features": ["O"]
    }],
    "39": [{
        "name": "SIN Big family house",
        "id": 3222154,
        "features": ["B", "O"]
    }],
    "42": [{
        "name": "Bar:+:Rococo \"Lolita |BUD",
        "id": 3341910,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Sly's open home",
        "id": 3204435,
        "features": ["O"]
    }, {
        "name": "Virág Villa",
        "id": 3231282,
        "features": ["S", "P", "B", "O"]
    }, {
        "name": "VÁR-I-LAK",
        "id": 3064294,
        "features": ["S", "O"]
    }, {
        "name": "BUD Big family house",
        "id": 3222558,
        "features": ["O", "S"]
    }],
    "45": [{
        "name": "cho chin",
        "id": 3255714,
        "features": ["O"]
    }, {
        "name": "SHA Big family house",
        "id": 3217828,
        "features": ["O"]
    }, {
        "name": "彼岸花:+:曼珠沙華 \"Bi An Hua",
        "id": 3331211,
        "features": ["S", "B", "BL", "P", "O", "X", ""]
    }],
    "46": [{
        "name": "Bar:+:Rococo \"Lolita |BUC",
        "id": 3341755,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Bükreş Duş Evi",
        "id": 3198948,
        "features": ["S", "BL", "O"]
    }, {
        "name": "BUC Big family house",
        "id": 3218643,
        "features": ["O"]
    }],
    "47": [{
        "name": "Bar:+:Rococo \"Lolita |IZM",
        "id": 3340318,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "The Phoenix PentHouse",
        "id": 3160545,
        "features": ["S", "O"]
    }, {
        "name": "SMI Big family house",
        "id": 3218305,
        "features": ["O"]
    }, {
        "name": "1453 Kıbrıs Şehitleri Cd",
        "id": 3198021,
        "features": ["O"]
    }],
    "48": [{
        "name": "Wojtek:+:Niedźwiedź \"3522",
        "id": 3341173,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Mrs & Mr V.'s Palace",
        "id": 3162567,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "VA Big family house",
        "id": 3216564,
        "features": ["O"]
    }],
    "49": [{
        "name": "Bar:+:Rococo \"Lolita |SAR",
        "id": 3341912,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Jackson's Home",
        "id": 3196356,
        "features": ["S", "O"]
    }, {
        "name": "SAR Big family house",
        "id": 3205697,
        "features": ["P", "B", "O"]
    }, {
        "name": "GanjaDome",
        "id": 3218131,
        "features": ["S", "P", "O"]
    }],
    "50": [{
        "name": "Temple of the G-Man",
        "id": 3264967,
        "features": ["B", "O", "S"]
    }, {
        "name": "Seattle Home",
        "id": 3023079,
        "features": ["P", "O"]
    }, {
        "name": "SEA Big family house",
        "id": 3219761,
        "features": ["B", "O"]
    }],
    "51": [{
        "name": "TauTona:+:Kruger \"Goud",
        "id": 3340688,
        "features": ["S", "B", "BL", "P", "O", "X"]
    }, {
        "name": "Rachel's Home Villa",
        "id": 3202857,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "JOH Big family house",
        "id": 3218176,
        "features": ["B", "O"]
    }, {
        "name": "(Summernight Palace/)",
        "id": 3259397,
        "features": ["B", "P", "O"]
    }],
    "52": [{
        "name": "Bar:+:Rococo \"Lolita |MIL",
        "id": 3341380,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "MIL Big family house",
        "id": 3218697,
        "features": ["S", "O"]
    }],
    "53": [{
        "name": "Bar:+:Rococo \"Lolita |SOF",
        "id": 3341913,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "старчески дом",
        "id": 3201807,
        "features": ["S", "B", "O"]
    }, {
        "name": "Къща за гости",
        "id": 3252482,
        "features": ["S", "B", "P", "O"]
    }],
    "54": [{
        "name": "MAN Big family house",
        "id": 3188092,
        "features": ["O"]
    }],
    "55": [{
        "name": "Bar:+:Rococo \"Lolita |JAK",
        "id": 3340690,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "GIA Big family house",
        "id": 3222289,
        "features": ["B", "BL"]
    }],
    "56": [{
        "name": "Слава:+:Украина \"Героям",
        "id": 3340831,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Basham Cottage",
        "id": 3162898,
        "features": ["O"]
    }, {
        "name": "KIE Big family house",
        "id": 3220994,
        "features": ["O"]
    }],
    "58": [{
        "name": "You are welcome",
        "id": 3207951,
        "features": ["B", "S", "O"]
    }, {
        "name": "BAK Big family house",
        "id": 3206100,
        "features": ["O"]
    }],
    "60": [{
        "name": "Bar:+:Rococo \"Lolita |CHI",
        "id": 3340663,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "Lake Forrest House",
        "id": 3200260,
        "features": ["S", "B", "O"]
    }, {
        "name": "The Playhouse",
        "id": 2980699,
        "features": ["S"]
    }, {
        "name": "CHI Big family house",
        "id": 3219163,
        "features": ["O"]
    }],
    "61": [{
        "name": "Bar:+:Rococo \"Lolita |ANT",
        "id": 3339583,
        "features": ["S", "B", "BL", "P", "O"]
    }, {
        "name": "ANT Big family house",
        "id": 3210022,
        "features": ["O"]
    }],
    "62": [{
        "name": "再会:+:おもかげ \"恋愛サーキュレーション",
        "id": 3339221,
        "features": ["S", "B", "BL", "P", "O", "X"]
    }, {
        "name": "Tokyo Hostel",
        "id": 3047285,
        "features": ["S", "O"]
    }, {
        "name": "TOK Big family house",
        "id": 3221967,
        "features": ["O"]
    }, {
        "name": "Izumi's House, Shibuya #7",
        "id": 3227018,
        "features": ["B", "P", "S", "O"]
    }, {
        "name": "Moon Cave",
        "id": 3249130,
        "features": ["S", "BL", "O"]
    }]
}

let cities = { "1": "Stockholm", "5": "London", "6": "New York", "7": "Berlin", "8": "Amsterdam", "9": "Barcelona", "10": "Melbourne", "11": "Nashville", "14": "Los Angeles", "16": "Toronto", "17": "Buenos Aires", "18": "Moscow", "19": "Helsinki", "20": "Paris", "21": "São Paulo", "22": "Copenhagen", "23": "Rome", "24": "Madrid", "25": "Rio de Janeiro", "26": "Tromsø", "27": "Glasgow", "28": "Vilnius", "29": "Dubrovnik", "30": "Istanbul", "31": "Porto", "32": "Mexico City", "33": "Brussels", "34": "Tallinn", "35": "Ankara", "36": "Belgrade", "38": "Montreal", "39": "Singapore", "42": "Budapest", "45": "Shanghai", "46": "Bucharest", "47": "Izmir", "48": "Warsaw", "49": "Sarajevo", "50": "Seattle", "51": "Johannesburg", "52": "Milan", "53": "Sofia", "54": "Manila", "55": "Jakarta", "56": "Kyiv", "58": "Baku", "60": "Chicago", "61": "Antalya", "62": "Tokyo" }




function injectOpenHouseHTML() {
    // The XPATH used to get the current city ID
    const CITY_ID_XPATH = '//select[@id="ctl00_cphRightColumn_ctl01_ddlCities"]/option[@selected="selected"]';

    let cityIDXpathHelper = new XPathHelper(CITY_ID_XPATH);
    let cityNode = cityIDXpathHelper.getFirstOrderedNode(document);

    if (cityNode.singleNodeValue) {
        let cityID = parseInt(cityNode.singleNodeValue.getAttribute('value'));

        // Once we have the ID, we check if data is available for a specific city
        if (openHousesDB.hasOwnProperty(cityID)) {
            // Xpath used to get the node that will be used to inject the new HTML content
            const TRAVEL_TO_XPATH = '//*[@id="ppm-sidemenu"]/div[2]/div[2]';
            let travelToXPathHelper = new XPathHelper(TRAVEL_TO_XPATH);
            let travelToNode = travelToXPathHelper.getFirstOrderedNode(document)


            if (travelToNode.singleNodeValue) {
                let foundHouses = 0;
                travelToNode = travelToNode.singleNodeValue;

                let newMenuDiv = document.createElement('div');
                newMenuDiv.setAttribute('class', 'menu');

                let newMenuH3 = document.createElement('h3');
                newMenuH3.setAttribute('class', 'menu');
                newMenuH3.textContent = 'Open Houses';
                newMenuDiv.appendChild(newMenuH3);

                let newMenuUL = document.createElement('ul');
                newMenuDiv.appendChild(newMenuUL);

                openHousesDB[cityID]
                    .sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0))
                    .forEach((houseDetails) => {
                        if (houseDetails.hasOwnProperty('name') && houseDetails.hasOwnProperty('id')) {
                            let newMenuLI = document.createElement('li');
                            newMenuUL.appendChild(newMenuLI);

                            let newMenuA = document.createElement('a');
                            newMenuA.setAttribute('href', `https://${window.location.hostname}/World/Popmundo.aspx/Locale/${houseDetails.id}`);
                            newMenuA.textContent = houseDetails.name
                            newMenuUL.appendChild(newMenuA);
                            foundHouses++;
                        }
                    });

                if (foundHouses > 0)
                    travelToNode.parentNode.insertBefore(newMenuDiv, travelToNode);
            }
        }
    }

}

injectOpenHouseHTML();