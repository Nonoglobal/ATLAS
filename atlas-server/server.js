/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 *     █████╗ ████████╗██╗      █████╗ ███████╗
 *    ██╔══██╗╚══██╔══╝██║     ██╔══██╗██╔════╝
 *    ███████║   ██║   ██║     ███████║███████╗
 *    ██╔══██║   ██║   ██║     ██╔══██║╚════██║
 *    ██║  ██║   ██║   ███████╗██║  ██║███████║
 *    ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚══════╝
 *    
 *    ADVANCED TACTICAL LIBRARY & ASSISTANT SYSTEM
 *    
 *    Core Server v1.0.0
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * ═══════════════════════════════════════════════════════════════════════════
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { atlasBrain } from './core/brain.js';
import { atlasMemory } from './core/memory.js';
import { atlasSkills } from './core/skills.js';
import { atlasWebSocket } from './websocket/handler.js';
import { atlasTTS } from './services/tts.js';

// ═══════════════════════════════════════════════════════════════════════════
// SERVER SETUP
// ═══════════════════════════════════════════════════════════════════════════

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Für Audio-Uploads
app.use(express.static('public'));

// ═══════════════════════════════════════════════════════════════════════════
// REST API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Health Check
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        name: 'ATLAS',
        version: '1.0.0',
        uptime: process.uptime()
    });
});

/**
 * System Status
 */
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        websocket: atlasWebSocket.getStats(),
        conversations: atlasMemory.getStats()
    });
});

/**
 * Text Message - Hauptendpoint für Nachrichten
 */
app.post('/api/message', async (req, res) => {
    const { userId, text, context } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text ist erforderlich' });
    }

    try {
        const response = await atlasBrain.process(
            userId || 'anonymous',
            text,
            context || {}
        );

        res.json(response);

    } catch (error) {
        console.error('[API] Fehler:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Text Message mit TTS Audio Response
 */
app.post('/api/message/audio', async (req, res) => {
    const { userId, text, context } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text ist erforderlich' });
    }

    try {
        // 1. Nachricht verarbeiten
        const response = await atlasBrain.process(
            userId || 'anonymous',
            text,
            context || {}
        );

        // 2. TTS generieren
        let audioBase64 = null;
        if (response.success) {
            try {
                audioBase64 = await atlasTTS.synthesizeToBase64(response.message);
            } catch (ttsError) {
                console.error('[API] TTS Fehler:', ttsError.message);
            }
        }

        res.json({
            ...response,
            audio: audioBase64,
            audioFormat: 'mp3'
        });

    } catch (error) {
        console.error('[API] Fehler:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Direct Skill Access
 */
app.get('/api/skills/news', async (req, res) => {
    const { query } = req.query;
    const result = await atlasSkills.getNews(query);
    res.json(result);
});

app.get('/api/skills/datetime', async (req, res) => {
    const { location } = req.query;
    const result = await atlasSkills.getDateTime(location);
    res.json(result);
});

app.get('/api/skills/crypto', async (req, res) => {
    const result = await atlasSkills.getCrypto();
    res.json(result);
});

app.get('/api/skills/weather', async (req, res) => {
    const { location } = req.query;
    const result = await atlasSkills.getWeather(location || 'Berlin');
    res.json(result);
});

app.get('/api/skills/system', async (req, res) => {
    const result = await atlasSkills.getSystemStatus();
    res.json(result);
});

/**
 * TTS Endpoint
 */
app.post('/api/tts', async (req, res) => {
    const { text, voice } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text ist erforderlich' });
    }

    try {
        if (voice) {
            atlasTTS.setVoice(voice);
        }

        const audioBase64 = await atlasTTS.synthesizeToBase64(text);
        
        res.json({
            success: true,
            audio: audioBase64,
            format: 'mp3'
        });

    } catch (error) {
        console.error('[API] TTS Fehler:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Available Voices
 */
app.get('/api/tts/voices', (req, res) => {
    res.json(atlasTTS.getAvailableVoices());
});

/**
 * Clear Conversation History
 */
app.delete('/api/conversation/:userId', (req, res) => {
    const { userId } = req.params;
    atlasMemory.clearHistory(userId);
    res.json({ success: true, message: 'Konversation gelöscht' });
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

atlasWebSocket.initialize(server);
atlasWebSocket.startHeartbeat();

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

server.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('     █████╗ ████████╗██╗      █████╗ ███████╗');
    console.log('    ██╔══██╗╚══██╔══╝██║     ██╔══██╗██╔════╝');
    console.log('    ███████║   ██║   ██║     ███████║███████╗');
    console.log('    ██╔══██║   ██║   ██║     ██╔══██║╚════██║');
    console.log('    ██║  ██║   ██║   ███████╗██║  ██║███████║');
    console.log('    ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚══════╝');
    console.log('');
    console.log('    ADVANCED TACTICAL LIBRARY & ASSISTANT SYSTEM');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`    🚀 Server läuft auf Port ${PORT}`);
    console.log(`    📡 WebSocket aktiv`);
    console.log(`    🧠 Claude API verbunden`);
    console.log('');
    console.log('    Endpoints:');
    console.log(`    • REST API:    http://localhost:${PORT}/api`);
    console.log(`    • WebSocket:   ws://localhost:${PORT}`);
    console.log(`    • Health:      http://localhost:${PORT}/health`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('[ATLAS] Shutdown...');
    server.close(() => {
        console.log('[ATLAS] Server gestoppt');
        process.exit(0);
    });
});
