// Chat History für Kontext
let chatHistory = [];

// DOM Elemente
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const loading = document.getElementById('loading');

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

// Hauptfunktion zum Senden von Nachrichten
async function sendMessage() {
    const message = userInput.value.trim();

    if (!message) return;

    // User Message anzeigen
    addMessage(message, 'user');

    // Input leeren und deaktivieren
    userInput.value = '';
    userInput.disabled = true;
    sendButton.disabled = true;
    loading.style.display = 'flex';

    try {
        // API Call
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                history: chatHistory.slice(-10) // Letzte 10 Nachrichten als Kontext
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
        userInput.focus();
    }
}

// Nachricht zum Chat hinzufügen
function addMessage(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = formatTime(new Date());

    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timestamp);
    messagesContainer.appendChild(messageDiv);

    // Zur History hinzufügen
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

// Initial Focus
userInput.focus();
