# LMG AI Chatbot - Projektdokumentation

## Projektübersicht
Ein KI-gestützter Chatbot für das Leibniz-Montessori-Gymnasium (LMG) zur Unterstützung von Schülerinnen und Schülern bei schulrelevanten Fragen.

**Live URL**: Wird automatisch über Vercel deployt
**GitHub Repository**: https://github.com/simon23-12/lmg-ai

## Technologie-Stack
- **Frontend**: HTML, CSS (Vanilla), JavaScript (Vanilla)
- **Backend**: Vercel Serverless Functions
- **KI-Modell**: Google Gemini API
  - Primär: `gemini-3-flash-preview`
  - Fallback: `gemini-2.5-flash`
- **Deployment**: Vercel (automatisch bei Git Push)

## Wichtige Konfiguration

### API-Setup
```javascript
// In api/chat.js
const PRIMARY_MODEL = 'gemini-3-flash-preview';
const FALLBACK_MODEL = 'gemini-2.5-flash';

// Modell-Konfiguration
maxOutputTokens: 4000  // Erhöht für längere Antworten
temperature: 0.7
```

### Environment Variables (Vercel)
- `GOOGLE_API_KEY`: API-Schlüssel für Google Gemini

## Features

### Implementierte Funktionen
1. **Zeichenlimit**: 250 Zeichen pro Benutzereingabe
2. **Chat-History löschen**: Gelber Button (LMG-Farbe #FFB900) oben links
3. **Schulthemen-Filter**: Beantwortet nur schulrelevante Fragen
4. **Kurze Antworten**: KI ist instruiert, präzise zu antworten (max. 3-4 Sätze)
5. **Fallback-Logik**: Automatischer Wechsel zu Backup-Modell bei Fehlern
6. **LMG-Branding**: Logo, angepasste Texte und Farben
7. **Modulübersicht-Integration**: Dynamisches Laden der Modulübersicht von GitHub bei modul-bezogenen Fragen

### UI-Komponenten
- **Logo**: `LMG.png` im Header (60px Höhe)
- **Clear-Button**: Position `left: 20px, top: 20px`, Farbe `#FFB900`
- **Begrüßung**: "Hallo, ich bin die hausinterne künstliche Intelligenz des Leibniz-Montessori-Gymnasiums. Wie kann ich dir helfen?"
- **Footer**: Leer (kein "Powered by" Text)

## System Prompt

Der aktuelle System Prompt befindet sich in `api/chat.js`:

```javascript
const SYSTEM_PROMPT = `Du bist die hausinterne künstliche Intelligenz des Leibniz-Montessori-Gymnasiums. Du unterstützt Schülerinnen und Schüler bei schulrelevanten Themen.

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
```

## Modulübersicht-Integration

### Funktionsweise
Die API lädt bei Bedarf automatisch die Modulübersicht von GitHub:

```javascript
// GitHub Raw URL
const MODULE_OVERVIEW_URL = 'https://raw.githubusercontent.com/simon23-12/lmg-ai/main/lmg-moduluebersicht.md';

// Keyword-Erkennung
function isModuleRelatedQuery(message) {
    // Prüft auf Keywords wie "modul", "modulübersicht", "halbjahr", etc.
}

// Lädt Modulübersicht von GitHub (mit 1-Stunden-Cache)
async function fetchModuleOverview() {
    // Lädt lmg-moduluebersicht.md von GitHub
}
```

### Features
- **Intelligente Erkennung**: Die API erkennt automatisch, ob eine Frage modul-bezogen ist
- **On-Demand Loading**: Modulübersicht wird nur geladen, wenn nötig (spart Tokens)
- **Caching**: 1-Stunden-Cache reduziert GitHub-Requests
- **Datenschutz**: Modulübersicht enthält keine Lehrkraftnamen oder -kürzel
- **GitHub-basiert**: Modulübersicht kann einfach aktualisiert werden (Git Push → automatisch verfügbar)

### Modul-Datei
- **Datei**: `lmg-moduluebersicht.md`
- **Location**: GitHub Repository Root
- **Inhalt**: 13 Fächer, alle Jahrgangsstufen, Pflicht-/Wahl-/Vertiefungsmodule
- **Format**: Markdown (optimal für Gemini)
- **Größe**: ~33 KB, ~5.164 Wörter

## Projektstruktur

```
school-chatbot-web/
├── api/
│   └── chat.js              # Vercel Serverless Function (Google Gemini API)
├── index.html               # Hauptseite mit Chat-Interface
├── styles.css               # Styling
├── script.js                # Chat-Funktionalität und Event-Handler
├── LMG.png                  # Schullogo
├── lmg-moduluebersicht.md   # Modulübersicht aller Fächer (wird von API geladen)
├── package.json             # Dependencies
├── vercel.json              # Vercel Konfiguration
├── README.md                # Projektdokumentation
└── claude.md                # Diese Datei (Projektinformationen für Claude)
```

## Dateiübersicht

### `index.html`
- Maximale Eingabelänge: `maxlength="250"`
- Clear-Button ID: `clearButton`
- Logo-Pfad: `LMG.png`

### `styles.css`
- LMG-Farbe (Gelb): `#FFB900`
- Clear-Button: Runder Button, 40x40px, Position absolut
- Logo-Höhe: 60px

### `script.js`
- Chat-History wird im Array `chatHistory` gespeichert
- Clear-Button löscht alle Nachrichten außer der Begrüßung
- Sendet letzte 10 Nachrichten als Kontext an API

### `api/chat.js`
- Verwendet `@google/generative-ai` Package
- Fallback-Logik: Primär → Fallback → Fehler
- CORS-Header sind konfiguriert
- Fehlerbehandlung mit detailliertem Logging
- Dynamisches Laden der Modulübersicht von GitHub bei Bedarf
- Intelligente Keyword-Erkennung für modul-bezogene Fragen
- 1-Stunden-Cache für Modulübersicht (reduziert API-Calls)

## Deployment

### GitHub
```bash
git add .
git commit -m "Beschreibung der Änderung"
git push
```

### Vercel
- Automatisches Deployment bei jedem Push zu `main`
- Environment Variable `GOOGLE_API_KEY` muss in Vercel Dashboard gesetzt sein
- URL wird nach Deployment bereitgestellt

## Zukünftige Verbesserungen

### Geplant (nicht implementiert)
1. **Curriculum-Integration**: Schulinterne Curricula aus LogineoNRW-LMS einbinden
   - URL: https://164471.logineonrw-lms.de/course/view.php?id=35
   - Methode: Manuelles Kopieren erforderlich (geschützte Seite)

2. **Weitere Features** (aus README):
   - Bilder hochladen (Gemini kann Bilder analysieren)
   - Spracheingabe
   - Dark Mode
   - Mehrere Fächer/Themen

## Wichtige Commits

1. **Initial Setup**: Gemini-Modelle statt Gemma
2. **LMG AI Branding**: Umbenennung von "Schul Co-Teacher" zu "LMG AI"
3. **Fallback-Logik**: Automatischer Wechsel zwischen Modellen
4. **Features**: Zeichenlimit, Clear-Button, Schulthemen-Filter, kurze Antworten
5. **Modulübersicht**: GitHub-Integration für dynamisches Laden der Modulübersicht

## Troubleshooting

### API-Fehler
- Prüfe ob `GOOGLE_API_KEY` in Vercel Environment Variables gesetzt ist
- Schaue in Vercel Logs nach Fehlermeldungen
- Modellnamen überprüfen (gemini-3-flash-preview, gemini-2.5-flash)

### 404 Model Not Found
- Gemini-Modelle verwenden, nicht Gemma
- Fallback-Modell ist konfiguriert

### Deployment-Probleme
- Alle Dateien müssen auf GitHub gepusht sein
- Vercel muss mit GitHub-Repository verbunden sein
- Environment Variables müssen gesetzt sein

## Kontakt & Support

Bei Fragen oder Problemen:
- GitHub Issues: https://github.com/simon23-12/lmg-ai/issues
- Repository: https://github.com/simon23-12/lmg-ai

## Lizenz

Dieses Projekt ist für schulische Zwecke gedacht. Beachte die Nutzungsbedingungen der Google Gemini API.

---

**Letztes Update**: 2026-01-25
**Version**: 1.0
**Status**: Production Ready ✅
