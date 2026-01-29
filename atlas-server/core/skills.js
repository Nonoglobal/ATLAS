/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS SKILLS - Fähigkeiten & Backends
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Verfügbare Skills:
 * - News: Nachrichten scrapen
 * - DateTime: Zeit und Datum
 * - Weather: Wetterdaten
 * - Crypto: Kryptowährungen
 * - System: Systemstatus
 */

class AtlasSkills {
    constructor() {
        this.newsCache = null;
        this.newsCacheTime = 0;
        this.newsCacheTTL = 5 * 60 * 1000; // 5 Minuten
        
        console.log('[ATLAS SKILLS] Initialisiert');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NEWS SKILL
    // ═══════════════════════════════════════════════════════════════════════

    async getNews(query = null) {
        console.log(`[SKILL:NEWS] Query: ${query || 'alle'}`);

        try {
            // Cache prüfen
            if (this.newsCache && Date.now() - this.newsCacheTime < this.newsCacheTTL && !query) {
                return this.newsCache;
            }

            const sources = [
                { name: 'Tagesschau', url: 'https://www.tagesschau.de/xml/rss2/' },
                { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
                { name: 'DW', url: 'https://rss.dw.com/rdf/rss-de-all' }
            ];

            const allNews = [];

            for (const source of sources) {
                try {
                    const articles = await this.fetchRSS(source.url, source.name);
                    allNews.push(...articles);
                } catch (e) {
                    console.log(`[SKILL:NEWS] ${source.name} fehlgeschlagen`);
                }
            }

            // Sortieren nach Datum
            allNews.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Filtern wenn Query vorhanden
            let filtered = allNews;
            if (query) {
                const lowerQuery = query.toLowerCase();
                filtered = allNews.filter(n => 
                    n.title.toLowerCase().includes(lowerQuery) ||
                    n.description?.toLowerCase().includes(lowerQuery)
                );
            }

            const result = {
                type: 'news',
                query: query,
                count: filtered.length,
                items: filtered.slice(0, 10)
            };

            // Cache aktualisieren
            if (!query) {
                this.newsCache = result;
                this.newsCacheTime = Date.now();
            }

            return result;

        } catch (error) {
            console.error('[SKILL:NEWS] Fehler:', error.message);
            return {
                type: 'news',
                error: 'Nachrichten konnten nicht geladen werden',
                items: []
            };
        }
    }

    async fetchRSS(url, sourceName) {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        
        const response = await fetch(proxyUrl, { timeout: 10000 });
        const xml = await response.text();
        
        // Einfaches XML Parsing
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const titleRegex = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/;
        const linkRegex = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/;
        const dateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;
        const descRegex = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/;

        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
            const itemXml = match[1];
            
            const titleMatch = itemXml.match(titleRegex);
            const linkMatch = itemXml.match(linkRegex);
            const dateMatch = itemXml.match(dateRegex);
            const descMatch = itemXml.match(descRegex);

            if (titleMatch && linkMatch) {
                items.push({
                    title: this.cleanText(titleMatch[1]),
                    url: linkMatch[1].trim(),
                    date: dateMatch ? new Date(dateMatch[1]) : new Date(),
                    description: descMatch ? this.cleanText(descMatch[1]).substring(0, 200) : '',
                    source: sourceName
                });
            }
        }

        return items.slice(0, 10);
    }

    cleanText(text) {
        return text
            .replace(/<[^>]*>/g, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DATETIME SKILL
    // ═══════════════════════════════════════════════════════════════════════

    async getDateTime(location = null) {
        console.log(`[SKILL:DATETIME] Location: ${location || 'lokal'}`);

        const now = new Date();
        
        const timezones = {
            'berlin': 'Europe/Berlin',
            'wien': 'Europe/Vienna',
            'zürich': 'Europe/Zurich',
            'london': 'Europe/London',
            'new york': 'America/New_York',
            'los angeles': 'America/Los_Angeles',
            'tokyo': 'Asia/Tokyo',
            'sydney': 'Australia/Sydney',
            'moscow': 'Europe/Moscow',
            'moskau': 'Europe/Moscow',
            'dubai': 'Asia/Dubai',
            'paris': 'Europe/Paris',
            'rom': 'Europe/Rome'
        };

        const tz = location ? timezones[location.toLowerCase()] || 'Europe/Berlin' : 'Europe/Berlin';

        const options = {
            timeZone: tz,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };

        const formatter = new Intl.DateTimeFormat('de-DE', options);
        const parts = formatter.formatToParts(now);
        
        const getPart = (type) => parts.find(p => p.type === type)?.value || '';

        return {
            type: 'datetime',
            location: location || 'Lokal',
            timezone: tz,
            date: `${getPart('weekday')}, ${getPart('day')}. ${getPart('month')} ${getPart('year')}`,
            time: `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`,
            timestamp: now.toISOString()
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WEATHER SKILL
    // ═══════════════════════════════════════════════════════════════════════

    async getWeather(location = 'Berlin') {
        console.log(`[SKILL:WEATHER] Location: ${location}`);

        // Hinweis: Für echte Wetterdaten brauchst du einen API Key
        // Hier ein Placeholder
        return {
            type: 'weather',
            location: location,
            note: 'Für Wetterdaten wird ein OpenWeatherMap API Key benötigt',
            placeholder: {
                temperature: '--',
                description: 'Nicht verfügbar',
                humidity: '--',
                wind: '--'
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CRYPTO SKILL
    // ═══════════════════════════════════════════════════════════════════════

    async getCrypto() {
        console.log('[SKILL:CRYPTO] Lade Kurse...');

        try {
            const response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,eur&include_24hr_change=true'
            );
            const data = await response.json();

            return {
                type: 'crypto',
                data: {
                    bitcoin: {
                        usd: data.bitcoin.usd,
                        eur: data.bitcoin.eur,
                        change24h: data.bitcoin.usd_24h_change?.toFixed(2)
                    },
                    ethereum: {
                        usd: data.ethereum.usd,
                        eur: data.ethereum.eur,
                        change24h: data.ethereum.usd_24h_change?.toFixed(2)
                    }
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[SKILL:CRYPTO] Fehler:', error.message);
            return {
                type: 'crypto',
                error: 'Crypto-Daten nicht verfügbar'
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SYSTEM SKILL
    // ═══════════════════════════════════════════════════════════════════════

    async getSystemStatus() {
        console.log('[SKILL:SYSTEM] Status abrufen...');

        const uptime = process.uptime();
        const memory = process.memoryUsage();

        return {
            type: 'system',
            status: 'online',
            uptime: this.formatUptime(uptime),
            memory: {
                used: Math.round(memory.heapUsed / 1024 / 1024) + ' MB',
                total: Math.round(memory.heapTotal / 1024 / 1024) + ' MB'
            },
            node: process.version,
            platform: process.platform,
            skills: ['news', 'datetime', 'weather', 'crypto', 'system']
        };
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours}h ${minutes}m ${secs}s`;
    }
}

export const atlasSkills = new AtlasSkills();
