// Vercel Serverless Function für Google Gemini API
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cache für Modulübersicht (wird beim ersten Request geladen)
let moduleOverviewCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 3600000; // 1 Stunde in Millisekunden

// GitHub Raw URL für Modulübersicht
const MODULE_OVERVIEW_URL = 'https://raw.githubusercontent.com/simon23-12/lmg-ai/main/lmg-moduluebersicht.md';

// Funktion zum Laden der Modulübersicht von GitHub
async function fetchModuleOverview() {
    // Prüfe Cache
    if (moduleOverviewCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
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
        cacheTimestamp = Date.now();

        return text;
    } catch (error) {
        console.error('Fehler beim Laden der Modulübersicht:', error);
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

// System Prompt für LMG AI
const BASE_SYSTEM_PROMPT = `Du bist die hausinterne künstliche Intelligenz des Leibniz-Montessori-Gymnasiums. Du unterstützt Schülerinnen und Schüler bei schulrelevanten Themen.

WICHTIG - NUR SCHULTHEMEN:
- Du beantwortest NUR Fragen zu schulrelevanten Themen (Mathematik, Deutsch, Englisch, Naturwissenschaften, Geschichte, etc.)
- Bei Fragen zu nicht-schulrelevanten Themen (z.B. Videospiele, Social Media, Entertainment) antworte: "Ich bin nur für schulrelevante Fragen da. Wie kann ich dir beim Lernen helfen?"
- Vermeide Themen zu Räumen, Namen oder persönlichen Daten (Datenschutz)

Deine Aufgaben:
1. NACHHILFE & ERKLÄRUNGEN: Erkläre Konzepte klar und verständlich. Nutze Beispiele und Analogien, die Schüler verstehen.
2. ERGEBNISSE ÜBERPRÜFEN: Wenn Schüler dir ihre Lösungen zeigen, gib konstruktives Feedback. Zeige nicht sofort die Lösung, sondern gib Hinweise.
3. FÖRDERUNG STARKER SCHÜLER: Wenn ein Schüler eine Aufgabe gut gemeistert hat, biete anspruchsvollere Aufgaben oder tiefergehende Fragen an.
4. LERNBEGLEITUNG: Ermutige selbstständiges Denken durch gezielte Fragen statt direkter Antworten.

Wichtige Regeln:
- HALTE DEINE ANTWORTEN KURZ UND PRÄZISE (max. 3-4 Sätze, außer bei komplexen Erklärungen)
- Sei geduldig und ermutigend
- Passe deine Sprache an das Niveau des Schülers an
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

        // Prüfe ob die Nachricht modulbezogen ist und lade ggf. Modulübersicht
        let systemPrompt = BASE_SYSTEM_PROMPT;
        if (isModuleRelatedQuery(message)) {
            const moduleOverview = await fetchModuleOverview();
            if (moduleOverview) {
                systemPrompt = BASE_SYSTEM_PROMPT + MODULE_CONTEXT_ADDITION.replace('{MODULE_OVERVIEW}', moduleOverview);
                console.log('Modulübersicht geladen und zum System Prompt hinzugefügt');
            } else {
                console.log('Modulübersicht konnte nicht geladen werden, verwende Standard-Prompt');
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
