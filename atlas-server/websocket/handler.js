/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS WEBSOCKET - Echtzeit Client-Verbindungen
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Verwaltet alle verbundenen Geräte/Clients
 * Ermöglicht bidirektionale Kommunikation
 */

import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { atlasBrain } from '../core/brain.js';
import { atlasTTS } from '../services/tts.js';
import { atlasSTT } from '../services/stt.js';

class AtlasWebSocket {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // clientId -> { ws, userId, device, connected }
        
        console.log('[ATLAS WS] Handler initialisiert');
    }

    /**
     * Startet den WebSocket Server
     */
    initialize(server) {
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        console.log('[ATLAS WS] WebSocket Server gestartet');
    }

    /**
     * Behandelt neue Verbindungen
     */
    handleConnection(ws, req) {
        const clientId = uuidv4();
        const clientIp = req.socket.remoteAddress;
        
        console.log(`[ATLAS WS] Neue Verbindung: ${clientId} von ${clientIp}`);

        // Client registrieren
        this.clients.set(clientId, {
            ws,
            userId: null,
            device: 'unknown',
            connected: new Date(),
            ip: clientIp
        });

        // Willkommensnachricht
        this.send(clientId, {
            type: 'connected',
            clientId,
            message: 'Verbindung zu ATLAS hergestellt'
        });

        // Event Handler
        ws.on('message', (data) => this.handleMessage(clientId, data));
        ws.on('close', () => this.handleDisconnect(clientId));
        ws.on('error', (error) => this.handleError(clientId, error));

        // Ping/Pong für Keep-Alive
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
    }

    /**
     * Verarbeitet eingehende Nachrichten
     */
    async handleMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            const message = JSON.parse(data.toString());
            console.log(`[ATLAS WS] Nachricht von ${clientId}:`, message.type);

            switch (message.type) {
                // ═══════════════════════════════════════════════════════════
                // AUTHENTICATION
                // ═══════════════════════════════════════════════════════════
                case 'auth':
                    client.userId = message.userId || clientId;
                    client.device = message.device || 'unknown';
                    this.send(clientId, {
                        type: 'auth_success',
                        userId: client.userId,
                        device: client.device
                    });
                    break;

                // ═══════════════════════════════════════════════════════════
                // TEXT MESSAGE
                // ═══════════════════════════════════════════════════════════
                case 'message':
                    const response = await atlasBrain.process(
                        client.userId || clientId,
                        message.text,
                        { device: client.device }
                    );

                    this.send(clientId, {
                        type: 'response',
                        text: response.message,
                        data: response.skillData,
                        success: response.success
                    });

                    // Optional: TTS generieren
                    if (message.wantAudio && response.success) {
                        try {
                            const audioBase64 = await atlasTTS.synthesizeToBase64(response.message);
                            this.send(clientId, {
                                type: 'audio',
                                audio: audioBase64,
                                format: 'mp3'
                            });
                        } catch (e) {
                            console.error('[ATLAS WS] TTS Fehler:', e.message);
                        }
                    }
                    break;

                // ═══════════════════════════════════════════════════════════
                // AUDIO MESSAGE (Speech-to-Text -> Process -> TTS)
                // ═══════════════════════════════════════════════════════════
                case 'audio':
                    // Benachrichtigung: Verarbeite Audio
                    this.send(clientId, { type: 'processing', stage: 'stt' });

                    try {
                        // 1. Audio zu Text
                        const sttResult = await atlasSTT.transcribe(
                            message.audio,
                            message.format || 'webm'
                        );

                        // Wenn Client-Side STT verwendet werden soll
                        if (sttResult.useClientSide) {
                            this.send(clientId, {
                                type: 'use_client_stt',
                                message: sttResult.message
                            });
                            break;
                        }

                        const transcribedText = sttResult;
                        this.send(clientId, {
                            type: 'transcription',
                            text: transcribedText
                        });

                        // 2. Verarbeiten
                        this.send(clientId, { type: 'processing', stage: 'thinking' });
                        
                        const audioResponse = await atlasBrain.process(
                            client.userId || clientId,
                            transcribedText,
                            { device: client.device }
                        );

                        this.send(clientId, {
                            type: 'response',
                            text: audioResponse.message,
                            data: audioResponse.skillData,
                            success: audioResponse.success
                        });

                        // 3. TTS
                        this.send(clientId, { type: 'processing', stage: 'tts' });
                        
                        const responseAudio = await atlasTTS.synthesizeToBase64(audioResponse.message);
                        this.send(clientId, {
                            type: 'audio',
                            audio: responseAudio,
                            format: 'mp3'
                        });

                    } catch (error) {
                        console.error('[ATLAS WS] Audio Verarbeitung Fehler:', error.message);
                        this.send(clientId, {
                            type: 'error',
                            message: 'Fehler bei der Audioverarbeitung'
                        });
                    }
                    break;

                // ═══════════════════════════════════════════════════════════
                // STATUS & PING
                // ═══════════════════════════════════════════════════════════
                case 'ping':
                    this.send(clientId, { type: 'pong', timestamp: Date.now() });
                    break;

                case 'status':
                    this.send(clientId, {
                        type: 'status',
                        clients: this.clients.size,
                        uptime: process.uptime()
                    });
                    break;

                default:
                    console.log(`[ATLAS WS] Unbekannter Nachrichtentyp: ${message.type}`);
            }

        } catch (error) {
            console.error(`[ATLAS WS] Fehler bei Nachricht von ${clientId}:`, error.message);
            this.send(clientId, {
                type: 'error',
                message: 'Fehler bei der Verarbeitung'
            });
        }
    }

    /**
     * Behandelt Verbindungsabbruch
     */
    handleDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            console.log(`[ATLAS WS] Verbindung getrennt: ${clientId} (${client.device})`);
            this.clients.delete(clientId);
        }
    }

    /**
     * Behandelt Fehler
     */
    handleError(clientId, error) {
        console.error(`[ATLAS WS] Fehler bei ${clientId}:`, error.message);
    }

    /**
     * Sendet Nachricht an Client
     */
    send(clientId, data) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === 1) { // OPEN
            client.ws.send(JSON.stringify(data));
        }
    }

    /**
     * Sendet Nachricht an alle Clients
     */
    broadcast(data, excludeClientId = null) {
        this.clients.forEach((client, clientId) => {
            if (clientId !== excludeClientId && client.ws.readyState === 1) {
                client.ws.send(JSON.stringify(data));
            }
        });
    }

    /**
     * Sendet Nachricht an alle Clients eines Users
     */
    sendToUser(userId, data) {
        this.clients.forEach((client, clientId) => {
            if (client.userId === userId && client.ws.readyState === 1) {
                client.ws.send(JSON.stringify(data));
            }
        });
    }

    /**
     * Gibt Statistiken zurück
     */
    getStats() {
        const devices = {};
        this.clients.forEach(client => {
            devices[client.device] = (devices[client.device] || 0) + 1;
        });

        return {
            totalClients: this.clients.size,
            devices
        };
    }

    /**
     * Keep-Alive Ping
     */
    startHeartbeat() {
        setInterval(() => {
            this.wss.clients.forEach(ws => {
                if (ws.isAlive === false) {
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000); // Alle 30 Sekunden
    }
}

export const atlasWebSocket = new AtlasWebSocket();
