# 🎓 LMG AI Chatbot

Eine einfache Website mit KI-gestütztem Lernassistenten für individualisierte Lernunterstützung im Unterricht.

## ✨ Features

- 📚 **Nachhilfe & Erklärungen** - Verständliche Erklärungen von Konzepten
- ✅ **Aufgaben überprüfen** - Konstruktives Feedback zu Lösungen
- 🚀 **Förderung starker Schüler** - Anspruchsvollere Aufgaben
- 💬 **Einfaches Chat-Interface** - Keine Installation nötig
- 🔒 **Datenschutz-konform** - Keine Speicherung von Namen oder Räumen

## 🚀 Deployment auf Vercel + GitHub

### Schritt 1: Google API Key erstellen

1. Gehe zu [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Klicke auf "Create API Key"
3. Kopiere den Key (du brauchst ihn später)

### Schritt 2: Repository auf GitHub erstellen

1. Gehe zu [GitHub](https://github.com) und logge dich ein
2. Klicke auf das **+** oben rechts → "New repository"
3. Name: `school-chatbot` (oder wie du willst)
4. Wähle **Public** oder **Private**
5. Klicke auf "Create repository"

### Schritt 3: Code hochladen

Öffne die Kommandozeile in diesem Ordner und führe aus:

```bash
git init
git add .
git commit -m "Initial commit: School Chatbot"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/school-chatbot.git
git push -u origin main
```

**Wichtig**: Ersetze `DEIN-USERNAME` mit deinem GitHub Username!

### Schritt 4: Mit Vercel verbinden

1. Gehe zu [vercel.com](https://vercel.com)
2. Klicke auf "Sign Up" und melde dich mit deinem **GitHub Account** an
3. Klicke auf "Add New..." → "Project"
4. Wähle dein `school-chatbot` Repository aus
5. Klicke auf "Import"

### Schritt 5: Environment Variable setzen

**Bevor du auf "Deploy" klickst:**

1. Scrolle runter zu "Environment Variables"
2. Füge hinzu:
   - **Name**: `GOOGLE_API_KEY`
   - **Value**: Dein API Key von Schritt 1
3. Klicke auf "Add"

### Schritt 6: Deploy!

1. Klicke auf "Deploy"
2. Warte 1-2 Minuten
3. Deine Website ist fertig! 🎉

Du bekommst eine URL wie: `https://school-chatbot-abc123.vercel.app`

## 📁 Projekt-Struktur

```
school-chatbot-web/
├── index.html          # Hauptseite
├── styles.css          # Styling
├── script.js           # Chat-Funktionalität
├── api/
│   └── chat.js         # Vercel Serverless Function (Google Gemini API)
├── package.json        # Dependencies
├── vercel.json         # Vercel Konfiguration
└── README.md           # Diese Datei
```

## 🔄 Updates deployen

Nach Änderungen einfach:

```bash
git add .
git commit -m "Beschreibung deiner Änderung"
git push
```

Vercel deployt automatisch nach jedem Push!

## ⚙️ Anpassungen

### KI-Modell wechseln

Das Projekt verwendet standardmäßig **Gemini 3 Flash** mit automatischem Fallback:
- **Primär**: `gemini-3-flash` (neuestes, schnellstes Modell)
- **Fallback**: `gemini-2.5-flash` (wird verwendet, wenn das primäre Modell nicht verfügbar ist)

Du kannst die Modelle in [api/chat.js](api/chat.js) anpassen:

```javascript
const PRIMARY_MODEL = 'gemini-3-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash';
```

Andere verfügbare Modelle: `gemini-1.5-flash`, `gemini-1.5-pro`

### Curriculum hinzufügen

Bearbeite [api/chat.js](api/chat.js) und füge bei `SYSTEM_PROMPT` hinzu:

```javascript
const SYSTEM_PROMPT = `Du bist ein hilfreicher Schul Co-Teacher...

CURRICULUM:
- Fach: Mathematik, Klasse 9
- Themen: Quadratische Funktionen, Parabeln, ...
- Schwerpunkte: ...

SCHUL-WIKI:
- [Deine Wiki-Infos hier]
`;
```

### Design ändern

- Farben: Bearbeite [styles.css](styles.css) (z.B. Zeile 7 für Hintergrund-Gradient)
- Text: Bearbeite [index.html](index.html)

### Weitere Features

Du kannst später hinzufügen:
- Bilder hochladen (Gemini kann Bilder analysieren)
- Spracheingabe
- Dark Mode
- Mehrere Fächer/Themen

## 🛠️ Lokales Testen (Optional)

Falls du lokal testen willst:

```bash
npm install -g vercel
vercel dev
```

Dann öffne: http://localhost:3000

## ❗ Troubleshooting

### "API Key ist nicht konfiguriert"
- Gehe zu Vercel → Dein Projekt → Settings → Environment Variables
- Prüfe ob `GOOGLE_API_KEY` gesetzt ist
- Redeploy: Klicke auf "Deployments" → neueste Deployment → "..." → "Redeploy"

### Website lädt nicht
- Prüfe ob alle Dateien auf GitHub hochgeladen wurden
- Prüfe Vercel Dashboard → Dein Projekt → "Deployments" → Logs ansehen

### Chat funktioniert nicht
- Öffne Browser Console (F12)
- Schaue nach Fehlermeldungen
- Prüfe ob API Key korrekt ist

## 🔒 Datenschutz

- Chat-Verlauf wird nur im Browser gespeichert (nicht auf Server)
- Google Gemini API speichert Anfragen gemäß deren Datenschutzrichtlinien
- Keine Namen, Räume oder persönliche Daten werden im Code verwendet
- **Wichtig**: Prüfe die Datenschutzrichtlinien deiner Schule/Region vor dem Einsatz

## 📝 Lizenz

Dieses Projekt ist für schulische Zwecke gedacht. Beachte die Nutzungsbedingungen der Google Gemini API.

---

**LMG AI - Dein KI-Lernassistent** 🎓

Bei Fragen oder Problemen erstelle ein Issue auf GitHub!
