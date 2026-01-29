# 🤖 ATLAS Core Server

**Advanced Tactical Library & Assistant System**

Ein JARVIS-ähnlicher KI-Assistent, der von überall erreichbar ist.

## 🚀 Quick Start

### 1. Voraussetzungen

- **Node.js 18+** installiert
- **Anthropic API Key** (Claude)
- Optional: OpenAI API Key (für Whisper STT)

### 2. Installation

```bash
cd atlas-server
npm install
```

### 3. Konfiguration

Bearbeite die `.env` Datei:

```env
# Erforderlich
ANTHROPIC_API_KEY=dein-claude-api-key

# Optional (für bessere Speech-to-Text)
OPENAI_API_KEY=dein-openai-key
```

### 4. Server starten

```bash
npm start
```

Der Server läuft dann auf `http://localhost:3000`

---

## 📡 API Endpoints

### REST API

| Endpoint | Method | Beschreibung |
|----------|--------|--------------|
| `/health` | GET | Health Check |
| `/api/status` | GET | System Status |
| `/api/message` | POST | Nachricht senden |
| `/api/message/audio` | POST | Nachricht mit Audio-Antwort |
| `/api/tts` | POST | Text zu Sprache |
| `/api/skills/news` | GET | Nachrichten abrufen |
| `/api/skills/crypto` | GET | Crypto-Preise |
| `/api/skills/datetime` | GET | Zeit/Datum |

### Beispiel: Nachricht senden

```bash
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"text": "Was sind die aktuellen Nachrichten?", "userId": "user123"}'
```

### WebSocket

Verbinden mit `ws://localhost:3000`

**Nachricht senden:**
```json
{
  "type": "message",
  "text": "Wie ist das Wetter?",
  "wantAudio": true
}
```

**Antwort:**
```json
{
  "type": "response",
  "text": "Das Wetter in Berlin...",
  "data": { ... },
  "success": true
}
```

---

## 🏗 Architektur

```
atlas-server/
├── server.js           # Hauptserver (Express + WebSocket)
├── core/
│   ├── brain.js        # Claude Integration + Persönlichkeit
│   ├── memory.js       # Gesprächsverlauf
│   └── skills.js       # News, Wetter, Crypto, etc.
├── services/
│   ├── tts.js          # Text-to-Speech (Edge TTS)
│   └── stt.js          # Speech-to-Text
└── websocket/
    └── handler.js      # WebSocket Verbindungen
```

---

## 🎯 Skills

| Skill | Trigger-Wörter | Beispiel |
|-------|----------------|----------|
| News | nachrichten, news, aktuell | "Was sind die Nachrichten?" |
| Zeit | zeit, uhrzeit, datum | "Wie spät ist es in Tokyo?" |
| Crypto | bitcoin, ethereum, crypto | "Bitcoin Preis?" |
| System | status, system | "System Status" |
| Wetter | wetter, temperatur | "Wetter in Berlin" |

---

## 📱 Clients verbinden

### Web Browser
```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    userId: 'user123',
    device: 'web'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('ATLAS:', data);
};

// Nachricht senden
ws.send(JSON.stringify({
  type: 'message',
  text: 'Hallo ATLAS!',
  wantAudio: true
}));
```

### Mobile App / Desktop
Gleiche WebSocket-Verbindung, andere `device` ID.

---

## 🔐 Sicherheit

⚠️ **WICHTIG**: 
- Regeneriere deinen API Key nach dem Setup
- Speichere `.env` niemals in Git
- Füge `.env` zu `.gitignore` hinzu

---

## 🚀 Deployment

### Railway.app
1. Repository erstellen
2. Bei Railway.app deployen
3. Environment Variables setzen

### Docker
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📝 Nächste Schritte

1. [ ] Firebase Integration für User-Daten
2. [ ] Mobile App (React Native)
3. [ ] Desktop App (Electron)
4. [ ] Wake Word Detection ("Hey ATLAS")
5. [ ] Mehr Skills hinzufügen

---

Made with ❤️ for ATLAS
