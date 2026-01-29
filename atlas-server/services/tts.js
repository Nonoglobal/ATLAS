/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS TTS - Text-to-Speech Service
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Verwendet Edge TTS (Microsoft) - Kostenlos und hochwertig
 * 
 * Deutsche Stimmen:
 * - de-DE-ConradNeural (Männlich, professionell) ⭐
 * - de-DE-KatjaNeural (Weiblich)
 * - de-DE-KillianNeural (Männlich)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

class AtlasTTS {
    constructor() {
        // Standard-Stimme für ATLAS
        this.voice = 'de-DE-ConradNeural';
        this.rate = '+0%';  // Geschwindigkeit
        this.pitch = '+0Hz'; // Tonhöhe
        
        // Temporärer Ordner für Audio-Dateien
        this.tempDir = '/tmp/atlas-tts';
        
        this.init();
    }

    async init() {
        // Temp-Ordner erstellen
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        console.log('[ATLAS TTS] Initialisiert mit Stimme:', this.voice);
    }

    /**
     * Konvertiert Text zu Audio
     * @param {string} text - Der zu sprechende Text
     * @returns {string} - Pfad zur Audio-Datei
     */
    async synthesize(text) {
        const filename = `${uuidv4()}.mp3`;
        const outputPath = path.join(this.tempDir, filename);

        try {
            // Edge TTS Kommando
            const command = `edge-tts --voice "${this.voice}" --rate="${this.rate}" --pitch="${this.pitch}" --text "${this.escapeText(text)}" --write-media "${outputPath}"`;
            
            await execAsync(command);
            
            console.log(`[ATLAS TTS] Audio generiert: ${filename}`);
            return outputPath;

        } catch (error) {
            console.error('[ATLAS TTS] Fehler:', error.message);
            throw error;
        }
    }

    /**
     * Konvertiert Text zu Audio-Buffer (für WebSocket)
     */
    async synthesizeToBuffer(text) {
        const filePath = await this.synthesize(text);
        const buffer = fs.readFileSync(filePath);
        
        // Datei löschen nach dem Lesen
        fs.unlinkSync(filePath);
        
        return buffer;
    }

    /**
     * Konvertiert Text zu Base64 Audio
     */
    async synthesizeToBase64(text) {
        const buffer = await this.synthesizeToBuffer(text);
        return buffer.toString('base64');
    }

    /**
     * Escaped Text für Shell-Kommando
     */
    escapeText(text) {
        return text
            .replace(/"/g, '\\"')
            .replace(/\$/g, '\\$')
            .replace(/`/g, '\\`')
            .replace(/\n/g, ' ');
    }

    /**
     * Ändert die Stimme
     */
    setVoice(voice) {
        this.voice = voice;
        console.log('[ATLAS TTS] Stimme geändert zu:', voice);
    }

    /**
     * Verfügbare deutsche Stimmen
     */
    getAvailableVoices() {
        return [
            { id: 'de-DE-ConradNeural', name: 'Conrad', gender: 'Male', description: 'Professionell, ATLAS Standard' },
            { id: 'de-DE-KatjaNeural', name: 'Katja', gender: 'Female', description: 'Freundlich' },
            { id: 'de-DE-KillianNeural', name: 'Killian', gender: 'Male', description: 'Energisch' },
            { id: 'de-AT-JonasNeural', name: 'Jonas', gender: 'Male', description: 'Österreichisch' },
            { id: 'de-CH-LeniNeural', name: 'Leni', gender: 'Female', description: 'Schweizerdeutsch' }
        ];
    }

    /**
     * Bereinigt alte Audio-Dateien
     */
    cleanup() {
        const files = fs.readdirSync(this.tempDir);
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1 Stunde

        files.forEach(file => {
            const filePath = path.join(this.tempDir, file);
            const stats = fs.statSync(filePath);
            
            if (now - stats.mtimeMs > maxAge) {
                fs.unlinkSync(filePath);
                console.log('[ATLAS TTS] Alte Datei gelöscht:', file);
            }
        });
    }
}

export const atlasTTS = new AtlasTTS();

// Cleanup alle 30 Minuten
setInterval(() => atlasTTS.cleanup(), 30 * 60 * 1000);
