// Vercel Serverless Function für Google Gemini API
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cache für Modulübersicht, Schulinformationen und Curriculum (wird beim ersten Request geladen)
let moduleOverviewCache = null;
let moduleOverviewCacheTimestamp = null;
let schoolInfoCache = null;
let schoolInfoCacheTimestamp = null;
let curriculumCache = null;
let curriculumCacheTimestamp = null;
const CACHE_DURATION = 3600000; // 1 Stunde in Millisekunden

// GitHub Raw URLs
const MODULE_OVERVIEW_BASE_URL = 'https://raw.githubusercontent.com/simon23-12/lmg-ai/main/moduluebersicht-';
const SCHOOL_INFO_URL = 'https://raw.githubusercontent.com/simon23-12/lmg-ai/main/lmg-schulinformationen.md';
const CURRICULUM_URL = 'https://raw.githubusercontent.com/simon23-12/lmg-ai/main/Curriculum.md';

// Hilfsfunktion für Fetch mit Timeout (verhindert langsame GitHub-Requests)
async function fetchWithTimeout(url, timeoutMs = 3000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        return response;
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            throw new Error(`Fetch timeout nach ${timeoutMs}ms`);
        }
        throw error;
    }
}

// Funktion zur Erkennung der Sprache einer Nachricht
function detectLanguage(message) {
    const lowerMessage = message.toLowerCase();

    // Deutsche Indikatoren (häufige Wörter und Muster)
    const germanIndicators = [
        /\b(ich|du|er|sie|es|wir|ihr)\b/,
        /\b(ist|sind|bin|bist|war|waren)\b/,
        /\b(und|oder|aber|wenn|dass|weil)\b/,
        /\b(der|die|das|den|dem|ein|eine|einer)\b/,
        /\b(nicht|auch|noch|schon|nur|sehr)\b/,
        /\b(kann|kannst|können|muss|müssen|soll|sollte)\b/,
        /\b(hallo|guten|morgen|tag|danke|bitte)\b/,
        /\b(wie|was|wer|wo|wann|warum|welche|welcher)\b/,
        /[äöüß]/
    ];

    // Englische Indikatoren
    const englishIndicators = [
        /\b(i|you|he|she|it|we|they)\b/,
        /\b(is|are|am|was|were|been|being)\b/,
        /\b(the|a|an|this|that|these|those)\b/,
        /\b(and|or|but|if|because|when|while)\b/,
        /\b(can|could|will|would|should|must|may|might)\b/,
        /\b(hello|hi|hey|thanks|thank|please)\b/,
        /\b(how|what|who|where|when|why|which)\b/,
        /\b(have|has|had|do|does|did)\b/
    ];

    // Französische Indikatoren
    const frenchIndicators = [
        /\b(je|tu|il|elle|nous|vous|ils|elles)\b/,
        /\b(est|sont|suis|es|était|étaient)\b/,
        /\b(le|la|les|un|une|des)\b/,
        /\b(et|ou|mais|si|que|parce)\b/,
        /\b(bonjour|salut|merci|s'il vous plaît|bonsoir)\b/,
        /\b(comment|quoi|qui|où|quand|pourquoi)\b/,
        /[éèêëàâùûîïôç]/
    ];

    // Spanische Indikatoren
    const spanishIndicators = [
        /\b(yo|tú|él|ella|nosotros|vosotros|ellos|ellas)\b/,
        /\b(es|son|soy|eres|era|eran|está|están)\b/,
        /\b(el|la|los|las|un|una|unos|unas)\b/,
        /\b(y|o|pero|si|que|porque)\b/,
        /\b(hola|gracias|por favor|buenos días)\b/,
        /\b(cómo|qué|quién|dónde|cuándo|por qué)\b/,
        /[ñáéíóúü¿¡]/
    ];

    // Türkische Indikatoren
    const turkishIndicators = [
        /\b(ben|sen|o|biz|siz|onlar)\b/,
        /\b(var|yok|değil|evet|hayır)\b/,
        /\b(ve|veya|ama|eğer|çünkü)\b/,
        /\b(merhaba|selam|teşekkür|lütfen)\b/,
        /\b(nasıl|ne|kim|nerede|ne zaman|neden)\b/,
        /[ğışçöü]/
    ];

    // Arabische Indikatoren (arabische Schriftzeichen)
    const arabicIndicators = [
        /[\u0600-\u06FF]/  // Arabische Schriftzeichen
    ];

    // Zähle Treffer für jede Sprache
    const countMatches = (indicators) => {
        return indicators.filter(pattern => pattern.test(lowerMessage)).length;
    };

    const scores = {
        'de': countMatches(germanIndicators),
        'en': countMatches(englishIndicators),
        'fr': countMatches(frenchIndicators),
        'es': countMatches(spanishIndicators),
        'tr': countMatches(turkishIndicators),
        'ar': countMatches(arabicIndicators)
    };

    // Finde die Sprache mit dem höchsten Score
    let maxScore = 0;
    let detectedLang = 'de'; // Standard: Deutsch

    for (const [lang, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            detectedLang = lang;
        }
    }

    // Nur wenn mindestens 2 Indikatoren gefunden wurden, als nicht-deutsch werten
    // (verhindert Fehlerkennungen bei einzelnen Wörtern)
    if (detectedLang !== 'de' && maxScore < 2) {
        return 'de';
    }

    return detectedLang;
}

// Funktion zur Erkennung der aktiven Sprache aus dem Chat-Verlauf
function detectActiveLanguage(message, history = []) {
    // Zuerst die aktuelle Nachricht prüfen
    const currentLang = detectLanguage(message);

    // Wenn die aktuelle Nachricht nicht-deutsch ist, diese Sprache verwenden
    if (currentLang !== 'de') {
        console.log(`Sprache aus aktueller Nachricht erkannt: ${currentLang}`);
        return currentLang;
    }

    // Wenn die aktuelle Nachricht deutsch ist, im Chat-Verlauf nach einer aktiven Sprache suchen
    // (nur die letzten User-Nachrichten prüfen, da der Bot evtl. auf einer anderen Sprache geantwortet hat)
    if (history && history.length > 0) {
        // Prüfe die letzten 6 Nachrichten (3 User + 3 Assistant)
        const recentHistory = history.slice(-6);
        for (let i = recentHistory.length - 1; i >= 0; i--) {
            if (recentHistory[i].role === 'user') {
                const historyLang = detectLanguage(recentHistory[i].content);
                if (historyLang !== 'de') {
                    console.log(`Aktive Sprache aus Chat-Verlauf: ${historyLang}`);
                    return historyLang;
                }
            }
        }
    }

    // Standard: Deutsch
    return 'de';
}

// Sprachnamen für den System Prompt
const LANGUAGE_NAMES = {
    'de': 'Deutsch',
    'en': 'Englisch (English)',
    'fr': 'Französisch (Français)',
    'es': 'Spanisch (Español)',
    'tr': 'Türkisch (Türkçe)',
    'ar': 'Arabisch (العربية)'
};

// Funktion zur Erkennung der Jahrgangsstufe aus der Nachricht
function detectGradeLevel(message) {
    const lowerMessage = message.toLowerCase();

    // Suche nach "klasse 5", "5. klasse", "jahrgang 5", "stufe 5", etc.
    // Inkludiert Tippfehler-Varianten wie "klase", "klass"
    const gradePatterns = [
        /klass?e?\s*(\d+)/,          // "klasse 5", "klase 5", "klass 5"
        /(\d+)\.\s*klass?e?/,        // "5. klasse", "5. klase", "5. klass"
        /jahrgang\s*(\d+)/,
        /stufe\s*(\d+)/,
        /jahrgangsstufe\s*(\d+)/,
        /\b(\d+)\s*er\b/,            // z.B. "5er"
        /\b(\d+)\.\s*(?=halbjahr)/   // "8. Halbjahr" -> extrahiert 8
    ];

    for (const pattern of gradePatterns) {
        const match = lowerMessage.match(pattern);
        if (match) {
            const grade = parseInt(match[1]);
            // Nur Klassen 5-10 sind verfügbar
            if (grade >= 5 && grade <= 10) {
                return grade;
            }
        }
    }

    return null; // Keine Jahrgangsstufe gefunden
}

// Funktion zum Laden der Modulübersicht von GitHub
async function fetchModuleOverview(grade) {
    // Wenn keine Jahrgangsstufe angegeben, können wir nichts laden
    if (!grade || grade < 5 || grade > 10) {
        console.log('Keine gültige Jahrgangsstufe für Modulübersicht gefunden');
        return null;
    }

    // Prüfe Cache für diese spezifische Jahrgangsstufe
    const cacheKey = `grade_${grade}`;
    if (moduleOverviewCache && moduleOverviewCache[cacheKey] &&
        moduleOverviewCacheTimestamp && (Date.now() - moduleOverviewCacheTimestamp) < CACHE_DURATION) {
        return moduleOverviewCache[cacheKey];
    }

    try {
        const url = `${MODULE_OVERVIEW_BASE_URL}${grade}.json`;
        console.log(`Lade Modulübersicht für Klasse ${grade} von: ${url}`);

        const response = await fetchWithTimeout(url, 3000);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();

        // Formatiere JSON in lesbaren Text für die KI
        const formattedText = formatModuleDataForAI(jsonData);

        // Cache aktualisieren (mit Dictionary für verschiedene Jahrgangsstufen)
        if (!moduleOverviewCache) {
            moduleOverviewCache = {};
        }
        moduleOverviewCache[cacheKey] = formattedText;
        moduleOverviewCacheTimestamp = Date.now();

        return formattedText;
    } catch (error) {
        console.error(`Fehler beim Laden der Modulübersicht für Klasse ${grade}:`, error);
        return null;
    }
}

// Hilfsfunktion zum Formatieren der JSON-Daten in lesbaren Text
function formatModuleDataForAI(jsonData) {
    let text = `# Modulübersicht Klasse ${jsonData.jahrgang}\n`;
    text += `Schuljahr: ${jsonData.schuljahr}\n\n`;
    text += `Abgabefristen:\n`;
    text += `- 1. Halbjahr: ${jsonData.abgabefrist_1hj}\n`;
    text += `- 2. Halbjahr: ${jsonData.abgabefrist_2hj}\n\n`;

    // Beide Halbjahre durchgehen
    for (const [halbjahrNr, halbjahr] of Object.entries(jsonData.halbjahre)) {
        text += `## ${halbjahr.bezeichnung}\n\n`;

        // Alle Fächer durchgehen
        for (const [fachKuerzel, fach] of Object.entries(halbjahr.faecher)) {
            text += `### ${fach.fachname} (${fachKuerzel})\n\n`;

            // Alle Module durchgehen
            if (fach.module && fach.module.length > 0) {
                for (const modul of fach.module) {
                    text += `**${modul.name}**\n`;
                    text += `- Sozialform: ${modul.sozialform}\n`;
                    text += `- Zeitraum: ${modul.zeitraum}\n`;
                    text += `- Dauer: ${modul.dauer} ${modul.dauer_einheit}\n`;
                    text += `- Ergebnis: ${modul.ergebnis}\n`;
                    if (modul.hinweise && modul.hinweise.length > 0) {
                        text += `- Hinweise: ${modul.hinweise.join(', ')}\n`;
                    }
                    text += `\n`;
                }
            } else {
                text += `Keine Module vorhanden.\n\n`;
            }
        }
    }

    return text;
}

// Funktion zum Laden der Schulinformationen von GitHub
async function fetchSchoolInfo() {
    // Prüfe Cache
    if (schoolInfoCache && schoolInfoCacheTimestamp && (Date.now() - schoolInfoCacheTimestamp) < CACHE_DURATION) {
        return schoolInfoCache;
    }

    try {
        const response = await fetchWithTimeout(SCHOOL_INFO_URL, 3000);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();

        // Cache aktualisieren
        schoolInfoCache = text;
        schoolInfoCacheTimestamp = Date.now();

        return text;
    } catch (error) {
        console.error('Fehler beim Laden der Schulinformationen:', error);
        return null;
    }
}

// Funktion zum Laden des Curriculums von GitHub
async function fetchCurriculum() {
    // Prüfe Cache
    if (curriculumCache && curriculumCacheTimestamp && (Date.now() - curriculumCacheTimestamp) < CACHE_DURATION) {
        return curriculumCache;
    }

    try {
        const response = await fetchWithTimeout(CURRICULUM_URL, 3000);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();

        // Cache aktualisieren
        curriculumCache = text;
        curriculumCacheTimestamp = Date.now();

        return text;
    } catch (error) {
        console.error('Fehler beim Laden des Curriculums:', error);
        return null;
    }
}

// Funktion zum Prüfen, ob eine Nachricht Modul-bezogen ist
function isModuleRelatedQuery(message, history = []) {
    const moduleKeywords = [
        'modul', 'module', 'modulübersicht',
        'pflichtmodul', 'wahlmodul', 'vertiefungsmodul', 'interessenmodul',
        'welche module', 'welches modul', 'was für module',
        'halbjahr', 'jahrgangsstufe', 'klasse',
        'unterrichtseinheit', 'lerneinheit',
        // Fachbezogene Keywords (Abkürzungen)
        ' pp ', 'philo', 'philosophie',
        // Zeitraum/Fristen-bezogene Keywords
        'frist', 'fristen', 'abgabe', 'abgabefrist', 'deadline',
        'zeitraum', 'wann muss', 'bis wann'
    ];

    // Follow-up Keywords die auf vorherige Fragen verweisen
    const followUpKeywords = [
        'dafür', 'davon', 'dazu', 'dabei', 'damit',
        'diese', 'dieser', 'dieses',
        'wie lange', 'wann'
    ];

    const lowerMessage = message.toLowerCase();

    // Direkte Modul-Anfrage
    if (moduleKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return true;
    }

    // Follow-up Frage: Prüfe ob vorherige Nachricht Modul-bezogen war
    if (history && history.length > 0) {
        const hasFollowUpKeyword = followUpKeywords.some(keyword => lowerMessage.includes(keyword));
        if (hasFollowUpKeyword) {
            // Prüfe die letzten 4 Nachrichten auf Modul-Bezug (nur die Keywords, ohne history-Rekursion)
            const recentHistory = history.slice(-4);
            for (const msg of recentHistory) {
                const lowerContent = msg.content.toLowerCase();
                if (moduleKeywords.some(keyword => lowerContent.includes(keyword))) {
                    console.log('Follow-up Frage zu Modul-Thema erkannt');
                    return true;
                }
            }
        }
    }

    return false;
}

// Funktion zum Prüfen, ob eine Nachricht schulinfo-bezogen ist
function isSchoolInfoRelatedQuery(message) {
    const schoolInfoKeywords = [
        'stundenmodell', 'stundenplan', 'unterrichtszeit', 'schulzeit',
        'wann beginnt', 'wann endet', 'uhrzeit', 'stunde',
        'pause', 'mittagspause',
        'montessori', 'freiarbeit',
        'mensa', 'essen', 'mittagessen', 'verpflegung', 'vegetarisch',
        'wettbewerb', 'ag ', ' ags ', 'arbeitsgemeinschaft', 'workshop',
        'bilingual', 'griechisch', 'fremdsprache', 'sprachen',
        'geschichte der schule', 'gründung', 'gegründet',
        'schüler', 'lehrer', 'lehrkräfte', 'schulleitung',
        'adresse', 'lage', 'standort', 'wo liegt', 'wo ist', 'düsseldorf', 'pempelfort', 'scharnhorststraße',
        'ganztagsgymnasium', 'nachmittagsbetreuung',
        'krankmeldung', 'krank melden',
        'tag der offenen tür', 'aufnahme', 'anmeldung',
        'kontakt', 'telefon', 'email',
        'website', 'webseite', 'homepage', 'internetseite', 'url', 'link',
        'lmg engagiert', 'ehrenamt',
        'chor', 'orchester', 'musical', 'theater',
        'sportfest', 'stadtmeisterschaft',
        'cambridge', 'delf', 'sprachdiplom',
        'jugend forscht', 'jugend debattiert',
        'big challenge', 'känguru', 'matheolympiade'
    ];

    const lowerMessage = message.toLowerCase();
    return schoolInfoKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Funktion zum Prüfen, ob eine Nachricht Curriculum-bezogen ist
function isCurriculumRelatedQuery(message) {
    const curriculumKeywords = [
        'thema', 'themen', 'lehrplan', 'curriculum',
        'was steht an', 'was kommt dran', 'was lernen wir', 'was behandeln wir',
        'unterrichtsstoff', 'unterrichtsinhalt', 'lerninhalt',
        'in klasse', 'in der klasse', 'jahrgangsstufe', 'jahrgang',
        'in klasse 5', 'in klasse 6', 'in klasse 7', 'in klasse 8', 'in klasse 9', 'in klasse 10',
        'in der 5', 'in der 6', 'in der 7', 'in der 8', 'in der 9', 'in der 10',
        'in der ef', 'in der q1', 'in der q2', 'in ef', 'in q1', 'in q2',
        'oberstufe', 'qualifikationsphase', 'einführungsphase',
        'welche themen', 'welches thema', 'was für themen'
    ];

    const lowerMessage = message.toLowerCase();
    return curriculumKeywords.some(keyword => lowerMessage.includes(keyword));
}

// System Prompt für LMG AI
const BASE_SYSTEM_PROMPT = `Du bist die hausinterne künstliche Intelligenz des Leibniz-Montessori-Gymnasiums. Du unterstützt Schülerinnen und Schüler sowie deren Eltern bei schulrelevanten Themen und Fragen zur Schule.

WICHTIG - SCHULWEBSITE:
Die offizielle Website der Schule ist AUSSCHLIESSLICH: https://www.leibniz-montessori.de/
NIEMALS andere URLs nennen oder erfinden! Nenne nur diese exakte URL.

WICHTIG - NUR SCHULTHEMEN:
- Du beantwortest NUR Fragen zu schulrelevanten Themen (Mathematik, Deutsch, Englisch, Naturwissenschaften, Geschichte, etc.) und Fragen zur Schulorganisation
- Bei Fragen zu nicht-schulrelevanten Themen (z.B. Videospiele, Social Media, Entertainment) antworte: "Ich bin nur für schulrelevante Fragen da. Wie kann ich dir beim Lernen helfen?"
- Vermeide Themen zu Räumen, Namen oder persönlichen Daten (Datenschutz)

Deine Aufgaben:
1. FÜR SCHÜLER - NACHHILFE & ERKLÄRUNGEN: Erkläre Konzepte klar und verständlich. Nutze Beispiele und Analogien, die Schüler verstehen.
2. FÜR SCHÜLER - ERGEBNISSE ÜBERPRÜFEN: Wenn Schüler dir ihre Lösungen zeigen, gib konstruktives Feedback. Zeige nicht sofort die Lösung, sondern gib Hinweise.
3. FÜR SCHÜLER - FÖRDERUNG STARKER SCHÜLER: Wenn ein Schüler eine Aufgabe gut gemeistert hat, biete anspruchsvollere Aufgaben oder tiefergehende Fragen an.
4. FÜR SCHÜLER - LERNBEGLEITUNG: Ermutige selbstständiges Denken durch gezielte Fragen statt direkter Antworten.
5. FÜR ELTERN - SCHULINFORMATIONEN: Beantworte Fragen zu Modulen, Stundenzeiten, AGs, Wettbewerben, Schulorganisation und dem Montessori-Konzept.

Wichtige Regeln:
- HALTE DEINE ANTWORTEN KURZ UND PRÄZISE (max. 3-4 Sätze, außer bei komplexen Erklärungen)
- Sei geduldig und ermutigend
- Passe deine Sprache an das Niveau des Gesprächspartners an (Schüler oder Eltern)
- Gib bei Hausaufgaben Hilfestellung, aber keine kompletten Lösungen
- Frage nach, wenn etwas unklar ist

Antworte auf Deutsch und sei freundlich und unterstützend.

WICHTIG - SPRACHANPASSUNG:
{LANGUAGE_INSTRUCTION}`;

const MODULE_CONTEXT_ADDITION = `

WICHTIG - MODULÜBERSICHT:
Du hast Zugriff auf die vollständige Modulübersicht des LMG für die Jahrgangsstufen 5-10.
Wenn Schüler nach Modulen fragen, nutze diese Informationen um:
- Module für bestimmte Fächer und Jahrgangsstufen zu nennen
- Inhalte, Zeitaufwand, Sozialformen und Ergebnisse von Modulen zu erklären
- Hinweise zu Fachraumpflicht oder benötigten digitalen Endgeräten zu geben
- Abgabefristen zu nennen (1. Halbjahr: letzter Schultag vor Weihnachtsferien, 2. Halbjahr: siehe Modulübersicht)

WICHTIG: Wenn nach Modulen gefragt wird, aber keine Jahrgangsstufe (Klasse 5-10) genannt wurde, frage nach der Klassenstufe, damit du die richtigen Module anzeigen kannst.

Modulübersicht:
{MODULE_OVERVIEW}`;

const SCHOOL_INFO_CONTEXT_ADDITION = `

WICHTIG - SCHULINFORMATIONEN:
Du hast Zugriff auf detaillierte Informationen über das Leibniz-Montessori-Gymnasium.
Wenn Schüler nach Schulorganisation, Zeiten, AGs, Wettbewerben oder anderen schulspezifischen Informationen fragen, nutze diese Informationen.

WICHTIG ZU KONTAKTDATEN UND DATENSCHUTZ:
- Gib NIEMALS direkte Telefonnummern, E-Mail-Adressen oder Namen von Lehrkräften heraus
- Verweise Schüler bei Kontaktfragen immer EXAKT an die Schulwebsite: https://www.leibniz-montessori.de/
- Bei Fragen zu Tag der offenen Tür, Anmeldung, etc. verweise ebenfalls auf die Website
- WICHTIG: Die Schulwebsite ist AUSSCHLIESSLICH https://www.leibniz-montessori.de/ - NIEMALS andere URLs verwenden oder erfinden!

Schulinformationen:
{SCHOOL_INFO}`;

const CURRICULUM_CONTEXT_ADDITION = `

WICHTIG - SCHULINTERNES CURRICULUM:
Du hast Zugriff auf das vollständige schulinterne Curriculum des LMG für alle Fächer und Jahrgangsstufen (5-13, EF, Q1, Q2).
Wenn Schüler oder Eltern nach Unterrichtsthemen oder Lerninhalten fragen, nutze diese Informationen um:
- Themen für bestimmte Fächer und Jahrgangsstufen aufzulisten
- Einen Überblick zu geben, was in welcher Klassenstufe behandelt wird
- Bei Fragen wie "Was steht in Klasse 6 in Mathe an?" präzise zu antworten

HINWEIS: Dies ist das offizielle Curriculum mit Unterrichtsthemen. Für Montessori-spezifische Module siehe die Modulübersicht.

Curriculum:
{CURRICULUM}`;

module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Nur POST erlauben
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, history } = req.body;

        // API Key prüfen
        if (!process.env.GOOGLE_API_KEY) {
            return res.status(500).json({
                error: 'Google API Key ist nicht konfiguriert. Bitte setze GOOGLE_API_KEY in den Vercel Environment Variables.'
            });
        }

        // Erkenne die Sprache des Benutzers
        const detectedLanguage = detectActiveLanguage(message, history);
        console.log(`Erkannte Sprache: ${detectedLanguage} (${LANGUAGE_NAMES[detectedLanguage]})`);

        // Erstelle Sprachanweisung basierend auf erkannter Sprache
        let languageInstruction;
        if (detectedLanguage === 'de') {
            languageInstruction = 'Der Benutzer schreibt auf Deutsch. Antworte auf Deutsch.';
        } else {
            const langName = LANGUAGE_NAMES[detectedLanguage];
            languageInstruction = `Der Benutzer schreibt auf ${langName}. Antworte in derselben Sprache (${langName}), bis der Benutzer wieder auf Deutsch schreibt. Behalte dabei alle anderen Regeln bei (schulrelevante Themen, kurze Antworten, etc.).`;
        }

        // Prüfe ob zusätzliche Kontextinformationen benötigt werden
        let systemPrompt = BASE_SYSTEM_PROMPT.replace('{LANGUAGE_INSTRUCTION}', languageInstruction);

        // Prüfe welche Kontexte benötigt werden (mit history für Follow-up Erkennung)
        const needsModuleInfo = isModuleRelatedQuery(message, history);
        const needsCurriculum = isCurriculumRelatedQuery(message);

        // Schulinfo nur laden wenn NICHT primär eine Modul-Anfrage ist
        // (verhindert unnötiges Laden bei Fragen wie "8. Klasse Englisch Modul")
        const isExplicitModuleQuery = /modul/i.test(message);
        const needsSchoolInfo = isSchoolInfoRelatedQuery(message) && !isExplicitModuleQuery;

        // Prüfe ob eine Datei hochgeladen wurde
        const { file } = req.body;
        const hasFile = file && file.data;

        // Füge Bild-Analyse-Anweisung hinzu wenn nötig
        if (hasFile) {
            const imageInstructions = `

WICHTIG - BILD/DOKUMENT-ANALYSE:
Der Schüler hat ein Bild oder Dokument hochgeladen.

KRITISCH - KEINE HALLUZINATIONEN:
1. Schau GENAU hin, was im Bild zu sehen ist - welches Fach, welches Thema?
2. Beschreibe kurz, was du erkennst (z.B. "Ich sehe ein Arbeitsblatt zum Thema Auge/Biologie...")
3. Erfinde NIEMALS Inhalte, die nicht klar sichtbar sind
4. Wenn das Bild unscharf ist oder du unsicher bist, frage nach: "Ich kann das Bild nicht gut erkennen. Kannst du mir sagen, um welches Fach/Thema es geht?"

Erst NACHDEM du das Thema korrekt identifiziert hast:
- Bei Arbeitsblättern: Erkläre die Aufgaben und gib Hilfestellung (keine fertigen Lösungen)
- Bei Mathe-Aufgaben: Zeige den Lösungsweg Schritt für Schritt
- Bei Texten/Aufsätzen: Gib konstruktives Feedback
- Bei Diagrammen/Grafiken: Erkläre, was dargestellt wird

Denke daran: Hilf beim Lernen, gib aber keine vollständigen Lösungen!`;
            systemPrompt += imageInstructions;
        }

        // Erkenne Jahrgangsstufe für Modulabfragen
        let detectedGrade = null;
        if (needsModuleInfo) {
            // Zuerst in aktueller Nachricht suchen
            detectedGrade = detectGradeLevel(message);

            // Falls nicht gefunden, im Chat-Verlauf suchen (neueste zuerst)
            if (!detectedGrade && history && history.length > 0) {
                for (let i = history.length - 1; i >= 0; i--) {
                    const historyGrade = detectGradeLevel(history[i].content);
                    if (historyGrade) {
                        detectedGrade = historyGrade;
                        console.log(`Jahrgangsstufe aus Chat-Verlauf erkannt: ${detectedGrade}`);
                        break;
                    }
                }
            }

            console.log(`Erkannte Jahrgangsstufe: ${detectedGrade || 'keine'}`);
        }

        // Lade benötigte Informationen parallel
        if (needsModuleInfo || needsSchoolInfo || needsCurriculum) {
            const [moduleOverview, schoolInfo, curriculum] = await Promise.all([
                needsModuleInfo && detectedGrade ? fetchModuleOverview(detectedGrade) : Promise.resolve(null),
                needsSchoolInfo ? fetchSchoolInfo() : Promise.resolve(null),
                needsCurriculum ? fetchCurriculum() : Promise.resolve(null)
            ]);

            // Füge Modulübersicht hinzu
            if (moduleOverview) {
                systemPrompt += MODULE_CONTEXT_ADDITION.replace('{MODULE_OVERVIEW}', moduleOverview);
                console.log(`Modulübersicht für Klasse ${detectedGrade} geladen und zum System Prompt hinzugefügt`);
            } else if (needsModuleInfo && !detectedGrade) {
                // Falls Module erwähnt werden, aber keine Jahrgangsstufe erkannt wurde
                console.log('Modulabfrage erkannt, aber keine Jahrgangsstufe gefunden');
            }

            // Füge Schulinformationen hinzu
            if (schoolInfo) {
                systemPrompt += SCHOOL_INFO_CONTEXT_ADDITION.replace('{SCHOOL_INFO}', schoolInfo);
                console.log('Schulinformationen geladen und zum System Prompt hinzugefügt');
            }

            // Füge Curriculum hinzu
            if (curriculum) {
                systemPrompt += CURRICULUM_CONTEXT_ADDITION.replace('{CURRICULUM}', curriculum);
                console.log('Curriculum geladen und zum System Prompt hinzugefügt');
            }
        }

        // Initialisiere Google Generative AI
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

        // Modell-Konfiguration mit Fallbacks
        // Bei Datei-Upload: Pro-Modelle zuerst (besser für Bildanalyse)
        // Bei Text-only: Flash-Modelle (schneller, günstiger)
        const MODELS = hasFile
            ? [
                'gemini-2.5-pro',          // Primär bei Uploads: stabiles Pro-Modell für Bildanalyse
                'gemini-2.5-flash'         // Fallback: schnelles Modell
            ]
            : [
                'gemini-2.5-flash',        // Primär: schnelles, stabiles Modell
                'gemini-2.5-flash-lite'    // Fallback: schnellstes Modell
            ];

        console.log(`Datei-Upload: ${hasFile ? 'Ja (' + file.type + ')' : 'Nein'}`);
        console.log(`Modell-Reihenfolge: ${MODELS.join(' → ')}`);

        // Baue Chat-Verlauf auf
        const chatHistory = history?.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        })) || [];

        // Funktion zum Senden der Nachricht mit einem bestimmten Modell (mit Timeout)
        const sendWithModel = async (modelName, timeoutMs = 7000) => {
            const model = genAI.getGenerativeModel({ model: modelName });

            // Bereite die Nachricht vor (Text + optional Bild)
            let messageParts = [];

            // Wenn eine Datei vorhanden ist, diese als multimodalen Content hinzufügen
            if (hasFile && file.data) {
                // Base64-Daten extrahieren (Format: data:image/jpeg;base64,XXXX)
                const base64Match = file.data.match(/^data:([^;]+);base64,(.+)$/);
                if (base64Match) {
                    const mimeType = base64Match[1];
                    const base64Data = base64Match[2];

                    messageParts.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    });
                    console.log(`Bild hinzugefügt: ${mimeType}, ${Math.round(base64Data.length / 1024)}KB`);
                }
            }

            // Text-Nachricht hinzufügen
            messageParts.push({ text: message });

            const chat = model.startChat({
                history: [
                    {
                        role: 'user',
                        parts: [{ text: systemPrompt }]
                    },
                    {
                        role: 'model',
                        parts: [{ text: 'Verstanden! Ich bin die hausinterne KI des Leibniz-Montessori-Gymnasiums und beantworte nur schulrelevante Fragen. Meine Antworten halte ich kurz und präzise.' }]
                    },
                    ...chatHistory
                ],
                generationConfig: {
                    maxOutputTokens: 4000,
                    temperature: 0.7,
                }
            });

            // Promise Race zwischen API-Aufruf und Timeout
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Gemini API Timeout nach ${timeoutMs}ms`)), timeoutMs)
            );

            const resultPromise = chat.sendMessage(messageParts).then(result => result.response.text());

            return Promise.race([resultPromise, timeoutPromise]);
        };

        // Timeouts pro Modell (muss in Summe unter 10s Vercel-Limit bleiben)
        // Mit Frontend-Bildkomprimierung sind Uploads jetzt ~100-300KB
        const MODEL_TIMEOUTS = hasFile
            ? [6000, 3000]        // 2.5-Pro → 2.5-Flash (total: 9s)
            : [5000, 4000];       // 2.5-Flash → 2.5-Flash-Lite (total: 9s)

        // Funktion zum Durchlaufen aller Modelle
        const tryAllModels = async () => {
            let lastError = null;

            for (let i = 0; i < MODELS.length; i++) {
                const modelName = MODELS[i];
                const timeout = MODEL_TIMEOUTS[i];

                try {
                    console.log(`Versuche mit ${modelName} (Timeout: ${timeout}ms)...`);
                    return await sendWithModel(modelName, timeout);
                } catch (error) {
                    console.log(`${modelName} fehlgeschlagen: ${error.message}`);
                    lastError = error;
                    // Weiter zum nächsten Modell
                }
            }

            // Alle Modelle fehlgeschlagen
            throw lastError;
        };

        // Mit Frontend-Bildkomprimierung reicht 1 Versuch (Bilder sind jetzt ~300-500KB)
        // Timeouts sind länger, daher kein Retry nötig
        const MAX_RETRIES = 1;
        let text;
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`=== Versuch ${attempt}/${MAX_RETRIES} ===`);
                text = await tryAllModels();
                break; // Erfolg, Schleife verlassen
            } catch (error) {
                lastError = error;
                console.error(`Alle Modelle fehlgeschlagen in Versuch ${attempt}:`, error.message);

                if (attempt < MAX_RETRIES) {
                    // Exponential Backoff: 1s, 2s, 4s... zwischen Versuchen
                    const backoffMs = 1000 * Math.pow(2, attempt - 1);
                    console.log(`Warte ${backoffMs}ms vor nächstem Versuch...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
        }

        // Prüfe ob erfolgreich
        if (text) {
            return res.status(200).json({ response: text });
        }

        // Alle Versuche fehlgeschlagen
        console.error('Alle Modelle und Retries erschöpft:', lastError?.message);
        return res.status(503).json({
            error: 'Die KI hat gerade viel zu tun, bitte versuche es in ein paar Minuten wieder.'
        });

    } catch (error) {
        console.error('Fehler bei der API-Anfrage:', error);
        return res.status(500).json({
            error: 'Die KI hat gerade viel zu tun, bitte versuche es in ein paar Minuten wieder.'
        });
    }
};
