// Chat History für Kontext
let chatHistory = [];

// Ausgewählte Datei
let selectedFile = null;
let selectedFileData = null;

// DOM Elemente
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const loading = document.getElementById('loading');
const clearButton = document.getElementById('clearButton');
const charCounter = document.getElementById('charCounter');
const uploadButton = document.getElementById('uploadButton');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const previewImage = document.getElementById('previewImage');
const previewFileName = document.getElementById('previewFileName');
const removeFileButton = document.getElementById('removeFile');

// Initiale Zeit setzen
document.getElementById('initial-time').textContent = formatTime(new Date());

// Event Listeners
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Zeichenzähler updaten
userInput.addEventListener('input', () => {
    const currentLength = userInput.value.length;
    charCounter.textContent = `${currentLength}/250`;
});

// Clear Button
clearButton.addEventListener('click', () => {
    if (confirm('Möchtest du den gesamten Chatverlauf löschen?')) {
        clearChat();
    }
});

// Upload Button
uploadButton.addEventListener('click', () => {
    fileInput.click();
});

// File Input Change
fileInput.addEventListener('change', handleFileSelect);

// Remove File Button
removeFileButton.addEventListener('click', clearSelectedFile);

// Hauptfunktion zum Senden von Nachrichten
async function sendMessage() {
    const message = userInput.value.trim();

    // Mindestens eine Nachricht oder Datei erforderlich
    if (!message && !selectedFile) return;

    // User Message anzeigen (mit Datei-Info falls vorhanden)
    addMessage(message || 'Bild/Dokument zur Analyse', 'user', selectedFile, selectedFileData);

    // Datei-Daten für API vorbereiten
    const fileToSend = selectedFile ? {
        name: selectedFile.name,
        type: selectedFile.type,
        data: selectedFileData
    } : null;

    // Input leeren und deaktivieren
    userInput.value = '';
    charCounter.textContent = '0/250';
    clearSelectedFile();
    userInput.disabled = true;
    sendButton.disabled = true;
    uploadButton.disabled = true;
    loading.style.display = 'flex';

    try {
        // API Call
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message || 'Bitte analysiere dieses Bild/Dokument.',
                history: chatHistory.slice(-10), // Letzte 10 Nachrichten als Kontext
                file: fileToSend
            })
        });

        if (!response.ok) {
            throw new Error('API Anfrage fehlgeschlagen');
        }

        const data = await response.json();

        // Assistant Message anzeigen
        addMessage(data.response, 'assistant');

    } catch (error) {
        console.error('Fehler:', error);
        addMessage(
            'Entschuldigung, es gab einen Fehler bei der Verarbeitung deiner Anfrage. Bitte versuche es erneut.',
            'assistant'
        );
    } finally {
        // Input wieder aktivieren
        loading.style.display = 'none';
        userInput.disabled = false;
        sendButton.disabled = false;
        uploadButton.disabled = false;
        userInput.focus();
    }
}

// Nachricht zum Chat hinzufügen
function addMessage(content, role, file = null, fileData = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Wenn eine Datei vorhanden ist, diese anzeigen
    if (file && fileData && role === 'user') {
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = fileData;
            img.className = 'message-image';
            img.alt = file.name;
            contentDiv.appendChild(img);
        } else {
            // Für andere Dateitypen nur den Namen anzeigen
            const fileInfo = document.createElement('div');
            fileInfo.className = 'message-file-info';
            fileInfo.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                </svg>
                <span>${file.name}</span>
            `;
            contentDiv.appendChild(fileInfo);
        }
    }

    // Text-Inhalt hinzufügen
    if (content) {
        const textP = document.createElement('p');
        textP.textContent = content;
        contentDiv.appendChild(textP);
    }

    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = formatTime(new Date());

    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timestamp);
    messagesContainer.appendChild(messageDiv);

    // Zur History hinzufügen (ohne Datei-Daten für den Kontext)
    chatHistory.push({
        role: role,
        content: content,
        timestamp: new Date()
    });

    // Nach unten scrollen
    scrollToBottom();
}

// Zum Ende scrollen
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Zeit formatieren
function formatTime(date) {
    return date.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Chatverlauf löschen
function clearChat() {
    // Alle Nachrichten außer der ersten (Begrüßung) entfernen
    const messages = messagesContainer.querySelectorAll('.message');
    messages.forEach((msg, index) => {
        if (index > 0) { // Erste Nachricht behalten
            msg.remove();
        }
    });

    // Chat-History leeren
    chatHistory = [];

    // Input fokussieren
    userInput.focus();
}

// Bild komprimieren (max 1200px, 70% Qualität)
function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.7) {
    console.log('Starte Bildkomprimierung für:', file.name, file.type, Math.round(file.size / 1024) + 'KB');

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            console.log('FileReader fertig, erstelle Image...');
            const img = new Image();
            img.onload = function() {
                try {
                    console.log('Bild geladen:', img.width, 'x', img.height);

                    // Berechne neue Dimensionen
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                        console.log('Neue Größe:', width, 'x', height);
                    }

                    // Canvas erstellen und Bild zeichnen
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Als komprimiertes JPEG exportieren
                    const compressedData = canvas.toDataURL('image/jpeg', quality);

                    const originalKB = Math.round(file.size / 1024);
                    const compressedKB = Math.round(compressedData.length * 0.75 / 1024);
                    console.log(`✅ Bild komprimiert: ${originalKB}KB → ${compressedKB}KB (${Math.round(100 - (compressedKB/originalKB)*100)}% kleiner)`);
                    resolve(compressedData);
                } catch (err) {
                    console.error('Canvas-Fehler:', err);
                    reject(err);
                }
            };
            img.onerror = function(err) {
                console.error('Bild laden fehlgeschlagen:', err);
                reject(err);
            };
            img.src = e.target.result;
        };
        reader.onerror = function(err) {
            console.error('FileReader Fehler:', err);
            reject(err);
        };
        reader.readAsDataURL(file);
    });
}

// Datei auswählen
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Dateigröße prüfen (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('Die Datei ist zu groß. Maximale Größe: 10MB');
        fileInput.value = '';
        return;
    }

    // Datei speichern
    selectedFile = file;

    // Bilder komprimieren, andere Dateien direkt einlesen
    if (file.type.startsWith('image/')) {
        try {
            // Bild komprimieren für schnellere Uploads
            selectedFileData = await compressImage(file);
            previewImage.src = selectedFileData;
            previewImage.style.display = 'block';
            previewFileName.textContent = file.name;
            filePreview.style.display = 'flex';
        } catch (error) {
            console.error('❌ Komprimierung fehlgeschlagen, verwende Original:', error);
            // Fallback: Original verwenden
            const reader = new FileReader();
            reader.onload = function(e) {
                selectedFileData = e.target.result;
                previewImage.src = selectedFileData;
                previewImage.style.display = 'block';
                previewFileName.textContent = file.name;
                filePreview.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        }
    } else {
        // Nicht-Bilder direkt einlesen
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedFileData = e.target.result;
            previewImage.style.display = 'none';
            previewFileName.textContent = file.name;
            filePreview.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
}

// Ausgewählte Datei entfernen
function clearSelectedFile() {
    selectedFile = null;
    selectedFileData = null;
    fileInput.value = '';
    filePreview.style.display = 'none';
    previewImage.src = '';
    previewFileName.textContent = '';
}

// Initial Focus
userInput.focus();
