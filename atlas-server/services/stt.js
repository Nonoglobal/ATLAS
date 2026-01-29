/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS STT - Speech-to-Text Service
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Optionen:
 * 1. OpenAI Whisper API (beste Qualität, kostet)
 * 2. Deepgram (Echtzeit, kostenloser Tier)
 * 3. Google Speech (benötigt Setup)
 * 
 * Für den Start: Audio wird vom Client als Base64 gesendet
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class AtlasSTT {
    constructor() {
        this.tempDir = '/tmp/atlas-stt';
        this.provider = 'whisper'; // 'whisper', 'deepgram', 'google'
        
        this.init();
    }

    init() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        console.log('[ATLAS STT] Initialisiert');
    }

    /**
     * Konvertiert Audio zu Text
     * @param {Buffer|string} audio - Audio-Daten (Buffer oder Base64)
     * @param {string} format - Audio-Format (webm, mp3, wav)
     * @returns {string} - Transkribierter Text
     */
    async transcribe(audio, format = 'webm') {
        // Buffer aus Base64 wenn nötig
        const audioBuffer = typeof audio === 'string' 
            ? Buffer.from(audio, 'base64') 
            : audio;

        switch (this.provider) {
            case 'whisper':
                return await this.transcribeWithWhisper(audioBuffer, format);
            case 'deepgram':
                return await this.transcribeWithDeepgram(audioBuffer, format);
            default:
                throw new Error(`Unbekannter STT Provider: ${this.provider}`);
        }
    }

    /**
     * OpenAI Whisper API
     */
    async transcribeWithWhisper(audioBuffer, format) {
        const openaiKey = process.env.OPENAI_API_KEY;
        
        if (!openaiKey) {
            console.warn('[ATLAS STT] Kein OpenAI API Key - verwende Fallback');
            return this.fallbackTranscribe();
        }

        try {
            // Audio als Datei speichern (Whisper braucht eine Datei)
            const filename = `${uuidv4()}.${format}`;
            const filePath = path.join(this.tempDir, filename);
            fs.writeFileSync(filePath, audioBuffer);

            // FormData erstellen
            const formData = new FormData();
            formData.append('file', new Blob([audioBuffer]), filename);
            formData.append('model', 'whisper-1');
            formData.append('language', 'de');

            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiKey}`
                },
                body: formData
            });

            // Aufräumen
            fs.unlinkSync(filePath);

            if (!response.ok) {
                throw new Error(`Whisper API Fehler: ${response.status}`);
            }

            const result = await response.json();
            console.log('[ATLAS STT] Whisper Transkription:', result.text);
            
            return result.text;

        } catch (error) {
            console.error('[ATLAS STT] Whisper Fehler:', error.message);
            throw error;
        }
    }

    /**
     * Deepgram API (hat kostenlosen Tier)
     */
    async transcribeWithDeepgram(audioBuffer, format) {
        const deepgramKey = process.env.DEEPGRAM_API_KEY;
        
        if (!deepgramKey) {
            console.warn('[ATLAS STT] Kein Deepgram API Key');
            return this.fallbackTranscribe();
        }

        try {
            const response = await fetch('https://api.deepgram.com/v1/listen?language=de&model=nova-2', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${deepgramKey}`,
                    'Content-Type': `audio/${format}`
                },
                body: audioBuffer
            });

            if (!response.ok) {
                throw new Error(`Deepgram API Fehler: ${response.status}`);
            }

            const result = await response.json();
            const transcript = result.results.channels[0].alternatives[0].transcript;
            
            console.log('[ATLAS STT] Deepgram Transkription:', transcript);
            return transcript;

        } catch (error) {
            console.error('[ATLAS STT] Deepgram Fehler:', error.message);
            throw error;
        }
    }

    /**
     * Fallback wenn kein API Key
     */
    fallbackTranscribe() {
        console.log('[ATLAS STT] Fallback - Client-side STT verwenden');
        return {
            error: 'no_api_key',
            message: 'Kein STT API Key konfiguriert. Verwende Browser Speech Recognition.',
            useClientSide: true
        };
    }

    /**
     * Setzt den Provider
     */
    setProvider(provider) {
        this.provider = provider;
        console.log('[ATLAS STT] Provider geändert zu:', provider);
    }

    /**
     * Prüft ob ein Provider verfügbar ist
     */
    checkAvailability() {
        return {
            whisper: !!process.env.OPENAI_API_KEY,
            deepgram: !!process.env.DEEPGRAM_API_KEY,
            clientSide: true // Immer verfügbar als Fallback
        };
    }
}

export const atlasSTT = new AtlasSTT();
