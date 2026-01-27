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
const MODULE_OVERVIEW_URL = 'https://raw.githubusercontent.com/simon23-12/lmg-ai/main/lmg-moduluebersicht.md';
const SCHOOL_INFO_URL = 'https://raw.githubusercontent.com/simon23-12/lmg-ai/main/lmg-schulinformationen.md';
const CURRICULUM_URL = 'https://raw.githubusercontent.com/simon23-12/lmg-ai/main/Curriculum.md';

// Funktion zum Laden der Modulübersicht von GitHub
async function fetchModuleOverview() {
    // Prüfe Cache
    if (moduleOverviewCache && moduleOverviewCacheTimestamp && (Date.now() - moduleOverviewCacheTimestamp) < CACHE_DURATION) {
        return moduleOverviewCache;
    }

    try {
        const response = await fetch(MODULE_OVERVIEW_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();

        // Cache aktualisieren
        moduleOverviewCache = text;
        moduleOverviewCacheTimestamp = Date.now();

        return text;
    } catch (error) {
        console.error('Fehler beim Laden der Modulübersicht:', error);
        return null;
    }
}

// Funktion zum Laden der Schulinformationen von GitHub
async function fetchSchoolInfo() {
    // Prüfe Cache
    if (schoolInfoCache && schoolInfoCacheTimestamp && (Date.now() - schoolInfoCacheTimestamp) < CACHE_DURATION) {
        return schoolInfoCache;
    }

    try {
        const response = await fetch(SCHOOL_INFO_URL);
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
        const response = await fetch(CURRICULUM_URL);
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
function isModuleRelatedQuery(message) {
    const moduleKeywords = [
        'modul', 'module', 'modulübersicht',
        'pflichtmodul', 'wahlmodul', 'vertiefungsmodul', 'interessenmodul',
        'welche module', 'welches modul', 'was für module',
        'halbjahr', 'jahrgangsstufe', 'klasse',
        'unterrichtseinheit', 'lerneinheit',
        // Fachbezogene Keywords (Abkürzungen)
        ' pp ', 'philo', 'philosophie'
    ];

    const lowerMessage = message.toLowerCase();
    return moduleKeywords.some(keyword => lowerMessage.includes(keyword));
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

Antworte auf Deutsch und sei freundlich und unterstützend.`;

const MODULE_CONTEXT_ADDITION = `

WICHTIG - MODULÜBERSICHT:
Du hast Zugriff auf die vollständige Modulübersicht des LMG für alle Fächer und Jahrgangsstufen.
Wenn Schüler nach Modulen fragen, nutze diese Informationen um:
- Module für bestimmte Fächer und Jahrgangsstufen zu empfehlen
- Inhalte und Themen von Modulen zu erklären
- Zeitaufwand und Sozialformen zu nennen
- Zwischen Pflicht-, Übungs-, Vertiefungs- und Interessenmodulen zu unterscheiden

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

        // Prüfe ob zusätzliche Kontextinformationen benötigt werden
        let systemPrompt = BASE_SYSTEM_PROMPT;

        // Prüfe welche Kontexte benötigt werden
        const needsModuleInfo = isModuleRelatedQuery(message);
        const needsSchoolInfo = isSchoolInfoRelatedQuery(message);
        const needsCurriculum = isCurriculumRelatedQuery(message);

        // Lade benötigte Informationen parallel
        if (needsModuleInfo || needsSchoolInfo || needsCurriculum) {
            const [moduleOverview, schoolInfo, curriculum] = await Promise.all([
                needsModuleInfo ? fetchModuleOverview() : Promise.resolve(null),
                needsSchoolInfo ? fetchSchoolInfo() : Promise.resolve(null),
                needsCurriculum ? fetchCurriculum() : Promise.resolve(null)
            ]);

            // Füge Modulübersicht hinzu
            if (moduleOverview) {
                systemPrompt += MODULE_CONTEXT_ADDITION.replace('{MODULE_OVERVIEW}', moduleOverview);
                console.log('Modulübersicht geladen und zum System Prompt hinzugefügt');
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

        // Modell-Konfiguration mit Fallback
        const PRIMARY_MODEL = 'gemini-3-flash-preview'; // Das "-preview" ist hier entscheidend!
        const FALLBACK_MODEL = 'gemini-2.5-flash';

        // Baue Chat-Verlauf auf
        const chatHistory = history?.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        })) || [];

        // Funktion zum Senden der Nachricht mit einem bestimmten Modell
        const sendWithModel = async (modelName) => {
            const model = genAI.getGenerativeModel({ model: modelName });

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

            const result = await chat.sendMessage(message);
            return result.response.text();
        };

        // Versuche primäres Modell, bei Fehler Fallback
        let text;
        try {
            console.log(`Versuche mit ${PRIMARY_MODEL}...`);
            text = await sendWithModel(PRIMARY_MODEL);
        } catch (primaryError) {
            console.log(`${PRIMARY_MODEL} fehlgeschlagen, wechsle zu ${FALLBACK_MODEL}...`);
            console.error('Primärer Fehler:', primaryError.message);

            try {
                text = await sendWithModel(FALLBACK_MODEL);
            } catch (fallbackError) {
                console.error('Fallback-Fehler:', fallbackError.message);
                throw fallbackError; // Wirf den Fehler weiter, wenn beide scheitern
            }
        }

        return res.status(200).json({ response: text });

    } catch (error) {
        console.error('Fehler bei der API-Anfrage:', error);
        return res.status(500).json({
            error: 'Fehler bei der Verarbeitung der Anfrage',
            details: error.message
        });
    }
};
