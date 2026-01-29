/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS MEMORY - Kontext & Gesprächsverlauf
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Verantwortlich für:
 * - Gesprächsverlauf pro User
 * - Kontext-Fenster Management
 * - Langzeit-Erinnerungen (Firebase)
 */

class AtlasMemory {
    constructor() {
        // In-Memory Speicher für aktive Gespräche
        this.conversations = new Map();
        
        // Maximale Nachrichten im Kontext
        this.maxMessages = 20;
        
        // Kontext-Timeout (30 Minuten)
        this.contextTimeout = 30 * 60 * 1000;
        
        console.log('[ATLAS MEMORY] Initialisiert');
    }

    /**
     * Holt den Gesprächsverlauf für einen User
     */
    getHistory(userId) {
        const conversation = this.conversations.get(userId);
        
        if (!conversation) {
            return [];
        }

        // Prüfen ob Kontext abgelaufen
        if (Date.now() - conversation.lastActivity > this.contextTimeout) {
            this.clearHistory(userId);
            return [];
        }

        return conversation.messages;
    }

    /**
     * Fügt eine Nachricht zum Verlauf hinzu
     */
    addMessage(userId, role, content) {
        if (!this.conversations.has(userId)) {
            this.conversations.set(userId, {
                messages: [],
                lastActivity: Date.now(),
                metadata: {}
            });
        }

        const conversation = this.conversations.get(userId);
        
        conversation.messages.push({ role, content });
        conversation.lastActivity = Date.now();

        // Kontext begrenzen
        if (conversation.messages.length > this.maxMessages) {
            // Behalte System-Kontext, entferne älteste Nachrichten
            conversation.messages = conversation.messages.slice(-this.maxMessages);
        }
    }

    /**
     * Löscht den Verlauf für einen User
     */
    clearHistory(userId) {
        this.conversations.delete(userId);
        console.log(`[ATLAS MEMORY] Kontext gelöscht für User: ${userId}`);
    }

    /**
     * Speichert Metadaten für einen User (z.B. Präferenzen)
     */
    setMetadata(userId, key, value) {
        if (!this.conversations.has(userId)) {
            this.conversations.set(userId, {
                messages: [],
                lastActivity: Date.now(),
                metadata: {}
            });
        }
        
        this.conversations.get(userId).metadata[key] = value;
    }

    /**
     * Holt Metadaten für einen User
     */
    getMetadata(userId, key) {
        const conversation = this.conversations.get(userId);
        if (!conversation) return null;
        return conversation.metadata[key];
    }

    /**
     * Gibt Statistiken zurück
     */
    getStats() {
        let totalMessages = 0;
        this.conversations.forEach(conv => {
            totalMessages += conv.messages.length;
        });

        return {
            activeConversations: this.conversations.size,
            totalMessages,
            maxMessages: this.maxMessages,
            contextTimeout: this.contextTimeout / 1000 / 60 + ' Minuten'
        };
    }

    /**
     * Zusammenfassung eines Gesprächs erstellen
     */
    getSummary(userId) {
        const history = this.getHistory(userId);
        if (history.length === 0) return null;

        return {
            messageCount: history.length,
            lastMessage: history[history.length - 1],
            topics: this.extractTopics(history)
        };
    }

    /**
     * Extrahiert Themen aus dem Verlauf
     */
    extractTopics(messages) {
        const topics = new Set();
        const keywords = {
            'nachrichten': 'News',
            'news': 'News',
            'wetter': 'Wetter',
            'temperatur': 'Wetter',
            'zeit': 'Zeit',
            'uhrzeit': 'Zeit',
            'bitcoin': 'Crypto',
            'crypto': 'Crypto',
            'aktie': 'Finanzen',
            'börse': 'Finanzen'
        };

        messages.forEach(msg => {
            const lowerContent = msg.content.toLowerCase();
            Object.entries(keywords).forEach(([keyword, topic]) => {
                if (lowerContent.includes(keyword)) {
                    topics.add(topic);
                }
            });
        });

        return Array.from(topics);
    }

    /**
     * Cleanup alter Konversationen
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        this.conversations.forEach((conv, userId) => {
            if (now - conv.lastActivity > this.contextTimeout) {
                this.conversations.delete(userId);
                cleaned++;
            }
        });

        if (cleaned > 0) {
            console.log(`[ATLAS MEMORY] ${cleaned} inaktive Konversationen bereinigt`);
        }
    }
}

// Cleanup alle 5 Minuten
const atlasMemory = new AtlasMemory();
setInterval(() => atlasMemory.cleanup(), 5 * 60 * 1000);

export { atlasMemory };
