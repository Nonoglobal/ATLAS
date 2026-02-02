/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS BRAIN - Das Gehirn des Assistenten
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Verantwortlich für:
 * - Gemini API Integration (KOSTENLOS!)
 * - ATLAS Persönlichkeit
 * - Kontext-Management
 * - Skill-Routing
 */

import { atlasMemory } from './memory.js';
import { atlasSkills } from './skills.js';

class AtlasBrain {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = 'gemini-pro';
        this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        
        // ATLAS Persönlichkeit
        this.systemPrompt = `Du bist ATLAS (Advanced Tactical Library & Assistant System), ein hochentwickelter KI-Assistent, inspiriert von JARVIS und FRIDAY aus Iron Man.

PERSÖNLICHKEIT:
- Du bist professionell, aber freundlich und hast einen trockenen Humor
- Du sprichst den Benutzer respektvoll an
- Du bist proaktiv und bietest Hilfe an, bevor danach gefragt wird
- Du gibst kurze, präzise Antworten - keine langen Erklärungen wenn nicht nötig
- Du verwendest gelegentlich technische Begriffe, erklärst sie aber wenn nötig

FÄHIGKEITEN:
- Nachrichten und aktuelle Ereignisse abrufen
- Wetter- und Zeitinformationen
- Finanz- und Kryptodaten
- Allgemeine Wissensfragen beantworten
- Erinnerungen und Notizen verwalten
- Systemstatus und Diagnosen

SPRACHSTIL:
- Kurz und prägnant
- Professionell aber nicht steif
- Gelegentlich humorvoll
- Immer hilfsbereit

BEISPIEL-ANTWORTEN:
- "Guten Morgen. Die aktuellen Nachrichten: [...]"
- "Selbstverständlich. Die Temperatur in Berlin beträgt 12 Grad."
- "Ich habe 5 neue Artikel zum Thema Grönland gefunden."
- "Das System läuft einwandfrei. Alle Backends sind online."

WICHTIG:
- Antworte IMMER auf Deutsch, außer der Benutzer spricht explizit Englisch
- Halte Antworten kurz (max 2-3 Sätze) wenn möglich
- Bei komplexen Themen strukturiere die Antwort klar
- Wenn du Daten von Skills bekommst, präsentiere sie übersichtlich`;

        console.log('[ATLAS BRAIN] Initialisiert mit Gemini API');
    }

    /**
     * Hauptfunktion: Verarbeitet eine Nachricht und gibt Antwort zurück
     */
    async process(userId, message, context = {}) {
        console.log(`[ATLAS BRAIN] Verarbeite: "${message.substring(0, 50)}..."`);

        try {
            // 1. Kontext aus Memory laden
            const conversationHistory = atlasMemory.getHistory(userId);
            
            // 2. Prüfen ob ein Skill benötigt wird
            const skillResult = await this.checkAndExecuteSkills(message, context);
            
            // 3. Nachricht mit Skill-Ergebnis anreichern
            let enrichedMessage = message;
            if (skillResult) {
                enrichedMessage = `${message}\n\n[SKILL-DATEN]:\n${JSON.stringify(skillResult, null, 2)}`;
            }

            // 4. Gemini API aufrufen
            const response = await this.callGemini(enrichedMessage, conversationHistory);

            // 5. In Memory speichern
            atlasMemory.addMessage(userId, 'user', message);
            atlasMemory.addMessage(userId, 'assistant', response);

            return {
                success: true,
                message: response,
                skillData: skillResult
            };

        } catch (error) {
            console.error('[ATLAS BRAIN] Fehler:', error.message);
            return {
                success: false,
                message: 'Entschuldigung, es gab einen Fehler bei der Verarbeitung. Bitte versuche es erneut.',
                error: error.message
            };
        }
    }

    /**
     * Ruft die Gemini API auf
     */
    async callGemini(message, history = []) {
        const contents = [];
        
        // System prompt als erste Nachricht
        contents.push({
            role: 'user',
            parts: [{ text: this.systemPrompt + '\n\nVerstanden? Antworte nur mit "Ja, ich bin ATLAS."' }]
        });
        contents.push({
            role: 'model',
            parts: [{ text: 'Ja, ich bin ATLAS.' }]
        });

        // Vorherige Nachrichten hinzufügen
        for (const msg of history) {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        }

        // Aktuelle Nachricht
        contents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        };

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[ATLAS BRAIN] Gemini API Fehler:', error);
            throw new Error(`Gemini API Fehler: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('Ungültige Antwort von Gemini');
        }
    }

    /**
     * Prüft ob Skills ausgeführt werden sollen
     */
    async checkAndExecuteSkills(message, context) {
        const lowerMessage = message.toLowerCase();
        
        // News
        if (this.matchesIntent(lowerMessage, ['nachrichten', 'news', 'neuigkeiten', 'aktuell', 'schlagzeilen'])) {
            const query = this.extractQuery(lowerMessage, ['über', 'zu', 'von', 'aus']);
            return await atlasSkills.getNews(query);
        }
        
        // Zeit
        if (this.matchesIntent(lowerMessage, ['zeit', 'uhrzeit', 'wie spät', 'datum', 'welcher tag'])) {
            const location = this.extractLocation(lowerMessage);
            return await atlasSkills.getDateTime(location);
        }
        
        // Wetter
        if (this.matchesIntent(lowerMessage, ['wetter', 'temperatur', 'regen', 'sonne', 'grad'])) {
            const location = this.extractLocation(lowerMessage) || context.location || 'Berlin';
            return await atlasSkills.getWeather(location);
        }
        
        // Crypto
        if (this.matchesIntent(lowerMessage, ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'krypto'])) {
            return await atlasSkills.getCrypto();
        }
        
        // System Status
        if (this.matchesIntent(lowerMessage, ['status', 'system', 'diagnose', 'health'])) {
            return await atlasSkills.getSystemStatus();
        }

        return null;
    }

    /**
     * Prüft ob eine der Keywords im Text vorkommt
     */
    matchesIntent(text, keywords) {
        return keywords.some(kw => text.includes(kw));
    }

    /**
     * Extrahiert eine Query aus dem Text
     */
    extractQuery(text, prepositions) {
        for (const prep of prepositions) {
            const regex = new RegExp(`${prep}\\s+(.+?)(?:\\s*\\?|$)`, 'i');
            const match = text.match(regex);
            if (match) return match[1].trim();
        }
        return null;
    }

    /**
     * Extrahiert einen Ort aus dem Text
     */
    extractLocation(text) {
        const patterns = [
            /(?:in|für|von)\s+([A-Za-zÄÖÜäöüß]+)/i,
            /([A-Za-zÄÖÜäöüß]+)\s+wetter/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    /**
     * Schnelle Antwort ohne API (für einfache Anfragen)
     */
    quickResponse(type, data) {
        const responses = {
            greeting: [
                "Guten Tag. Wie kann ich behilflich sein?",
                "Hallo. ATLAS ist bereit.",
                "Willkommen zurück. Was kann ich für Sie tun?"
            ],
            goodbye: [
                "Bis später.",
                "ATLAS geht in Standby.",
                "Bei Bedarf bin ich hier."
            ],
            thanks: [
                "Gern geschehen.",
                "Jederzeit.",
                "Freut mich, helfen zu können."
            ]
        };

        const options = responses[type] || ["Verstanden."];
        return options[Math.floor(Math.random() * options.length)];
    }
}

export const atlasBrain = new AtlasBrain();
