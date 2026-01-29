/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS BRAIN - Das Gehirn des Assistenten
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Verantwortlich für:
 * - Claude API Integration
 * - ATLAS Persönlichkeit
 * - Kontext-Management
 * - Skill-Routing
 */

import Anthropic from '@anthropic-ai/sdk';
import { atlasMemory } from './memory.js';
import { atlasSkills } from './skills.js';

class AtlasBrain {
    constructor() {
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        this.model = 'claude-sonnet-4-20250514';
        this.maxTokens = 1024;
        
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

        console.log('[ATLAS BRAIN] Initialisiert');
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

            // 4. Claude API aufrufen
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: this.maxTokens,
                system: this.systemPrompt,
                messages: [
                    ...conversationHistory,
                    { role: 'user', content: enrichedMessage }
                ]
            });

            const assistantMessage = response.content[0].text;

            // 5. In Memory speichern
            atlasMemory.addMessage(userId, 'user', message);
            atlasMemory.addMessage(userId, 'assistant', assistantMessage);

            return {
                success: true,
                message: assistantMessage,
                skillData: skillResult,
                usage: {
                    inputTokens: response.usage.input_tokens,
                    outputTokens: response.usage.output_tokens
                }
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
     * Schnelle Antwort ohne Claude (für einfache Anfragen)
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
