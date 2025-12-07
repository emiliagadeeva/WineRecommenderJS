// api.js
class WineAPI {
    constructor() {
        this.baseUrl = window.location.origin;
        this.embeddings = null;
        this.wines = null;
        this.embeddingModel = null;
        this.initialized = false;
    }

    async initialize() {
        console.log("🚀 Инициализация Wine API...");
        
        try {
            // Загружаем CSV с винами
            await this.loadWines();
            
            // Загружаем предварительно вычисленные эмбеддинги
            await this.loadEmbeddings();
            
            // Инициализируем модель для эмбеддингов запросов пользователя
            await this.initializeEmbeddingModel();
            
            this.initialized = true;
            console.log("✅ Wine API инициализирован");
        } catch (error) {
            console.error("❌ Ошибка инициализации Wine API:", error);
            throw error;
        }
    }

    async loadWines() {
        try {
            console.log("📦 Загрузка данных о винах...");
            const response = await fetch('data/df.csv');
            const csvText = await response.text();
            
            // Парсинг CSV
            this.wines = this.parseCSV(csvText);
            console.log(`✅ Загружено ${this.wines.length} вин`);
        } catch (error) {
            console.error("❌ Ошибка загрузки CSV:", error);
            throw error;
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        const wines = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = this.parseCSVLine(lines[i]);
            const wine = {};
            
            headers.forEach((header, index) => {
                if (index < values.length) {
                    wine[header] = values[index]?.trim().replace(/"/g, '') || null;
                }
            });
            
            // Преобразуем числовые поля
            if (wine.price) wine.price = parseFloat(wine.price) || 0;
            if (wine.points) wine.points = parseInt(wine.points) || 0;
            wine.id = i;
            
            wines.push(wine);
        }
        
        return wines;
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current);
        return values;
    }

    async loadEmbeddings() {
        try {
            console.log("🧠 Загрузка предварительно вычисленных эмбеддингов...");
            const response = await fetch('data/wine_embeddings.json');
            const data = await response.json();
            
            this.embeddings = data.embeddings;
            console.log(`✅ Загружено ${this.embeddings.length} эмбеддингов`);
        } catch (error) {
            console.error("❌ Ошибка загрузки эмбеддингов:", error);
            throw error;
        }
    }

    async initializeEmbeddingModel() {
        try {
            console.log("🤖 Инициализация модели для эмбеддингов...");
            
            // Используем TensorFlow.js для вычисления эмбеддингов
            // Для простоты будем использовать универсальный sentence encoder
            if (typeof use !== 'undefined') {
                // @universal-sentence-encoder
                await this.loadUniversalSentenceEncoder();
            } else {
                // Альтернатива: используем simpler approach
                console.log("⚠️ Universal Sentence Encoder не найден, используем простую текстовую обработку");
                this.embeddingModel = {
                    encode: (texts) => {
                        // Простая замена - в реальности нужна proper embedding модель
                        // Для демо версии используем TF.js или другой подход
                        return this.getSimpleEmbeddings(texts);
                    }
                };
            }
        } catch (error) {
            console.error("❌ Ошибка инициализации модели:", error);
            // Падаем назад на простую обработку
            this.embeddingModel = {
                encode: (texts) => this.getSimpleEmbeddings(texts)
            };
        }
    }

    async loadUniversalSentenceEncoder() {
        // Этот код загрузит USE модель из CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs';
        document.head.appendChild(script);
        
        return new Promise((resolve) => {
            script.onload = async () => {
                const script2 = document.createElement('script');
                script2.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder';
                document.head.appendChild(script2);
                
                script2.onload = async () => {
                    try {
                        const use = await use.load();
                        this.embeddingModel = use;
                        console.log("✅ Universal Sentence Encoder загружен");
                        resolve();
                    } catch (error) {
                        console.error("Ошибка загрузки USE:", error);
                        resolve();
                    }
                };
            };
        });
    }

    getSimpleEmbeddings(texts) {
        // Простая базовая реализация для демо
        // В реальном приложении здесь должна быть настоящая модель
        const embeddings = [];
        
        for (const text of Array.isArray(texts) ? texts : [texts]) {
            const words = text.toLowerCase().split(/\s+/);
            const embedding = new Array(512).fill(0);
            
            // Простой хэширующий эмбеддинг
            words.forEach(word => {
                const hash = this.stringHash(word);
                const index = Math.abs(hash) % 512;
                embedding[index] += 0.1;
            });
            
            // Нормализация
            const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            if (norm > 0) {
                for (let i = 0; i < embedding.length; i++) {
                    embedding[i] /= norm;
                }
            }
            
            embeddings.push(embedding);
        }
        
        return Array.isArray(texts) ? embeddings : embeddings[0];
    }

    stringHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    // Методы для фильтров
    async getCountries() {
        if (!this.wines) return [];
        const countries = [...new Set(this.wines.map(w => w.country).filter(c => c && c !== 'null' && c !== 'Unknown'))];
        return countries.sort();
    }

    async getVarieties() {
        if (!this.wines) return [];
        const varieties = [...new Set(this.wines.map(w => w.variety).filter(v => v && v !== 'null' && v !== 'Unknown'))];
        return varieties.sort();
    }

    async getPriceRange() {
        if (!this.wines) return { min: 10, max: 500 };
        const prices = this.wines.map(w => w.price || 0).filter(p => p > 0);
        return {
            min: Math.floor(Math.min(...prices)),
            max: Math.ceil(Math.max(...prices))
        };
    }

    async getWineList() {
        return this.wines || [];
    }

    // Основные методы рекомендаций
    async getFilteredRecommendations(query, filters) {
        if (!this.initialized) await this.initialize();
        
        let results = [];
        
        // Семантический поиск
        if (query) {
            results = await this.semanticSearch(query, 100);
        } else {
            results = this.wines.map((wine, index) => ({
                ...wine,
                similarity_score: 0.5
            }));
        }
        
        // Применяем фильтры
        if (filters) {
            results = results.filter(wine => {
                if (filters.variety && wine.variety) {
                    if (!wine.variety.toLowerCase().includes(filters.variety.toLowerCase())) {
                        return false;
                    }
                }
                
                if (filters.country && wine.country) {
                    if (!wine.country.toLowerCase().includes(filters.country.toLowerCase())) {
                        return false;
                    }
                }
                
                if (filters.max_price && wine.price) {
                    if (wine.price > filters.max_price) {
                        return false;
                    }
                }
                
                return true;
            });
        }
        
        // Ограничиваем количество результатов
        results = results.slice(0, 50);
        
        // Генерируем LLM комментарий
        const llm_comment = await window.llmService.generateFilterComment(query, filters, results.length);
        
        return {
            recommendations: results,
            llm_comment: llm_comment
        };
    }

    async getTasteRecommendations(selectedWineIds) {
        if (!this.initialized) await this.initialize();
        
        const selectedWines = this.wines.filter(w => selectedWineIds.includes(w.id));
        
        if (selectedWines.length === 0) {
            return {
                recommendations: [],
                llm_comment: "Вы не выбрали ни одного вина.",
                preference_analysis: {}
            };
        }
        
        // Анализ предпочтений
        const preference_analysis = this.analyzePreferences(selectedWines);
        
        // Создаем запрос на основе предпочтений
        const query = this.createQueryFromPreferences(preference_analysis);
        
        // Ищем похожие вина
        let results = await this.semanticSearch(query, 50);
        
        // Исключаем уже выбранные вина
        results = results.filter(wine => !selectedWineIds.includes(wine.id));
        
        // Сортируем по схожести
        results.sort((a, b) => b.similarity_score - a.similarity_score);
        
        // Ограничиваем количество
        results = results.slice(0, 20);
        
        // Генерируем LLM комментарий
        const llm_comment = await window.llmService.generateTasteComment(selectedWines, results);
        
        return {
            recommendations: results,
            llm_comment: llm_comment,
            preference_analysis: preference_analysis
        };
    }

    async getSimpleRecommendations(query) {
        if (!this.initialized) await this.initialize();
        
        // Семантический поиск
        const results = await this.semanticSearch(query, 20);
        
        // Генерируем LLM комментарий
        const llm_comment = await window.llmService.generateSimpleComment(query, results);
        
        return {
            recommendations: results,
            llm_comment: llm_comment
        };
    }

    async semanticSearch(query, limit = 20) {
        // Вычисляем эмбеддинг запроса
        const queryEmbedding = await this.getQueryEmbedding(query);
        
        // Вычисляем схожесть с каждым вином
        const results = [];
        
        for (let i = 0; i < Math.min(this.wines.length, 2000); i++) { // Ограничиваем для производительности
            const wine = this.wines[i];
            const wineEmbedding = this.embeddings[i];
            
            if (wineEmbedding && wine) {
                const similarity = this.cosineSimilarity(queryEmbedding, wineEmbedding);
                
                results.push({
                    ...wine,
                    similarity_score: similarity
                });
            }
        }
        
        // Сортируем по схожести
        results.sort((a, b) => b.similarity_score - a.similarity_score);
        
        return results.slice(0, limit);
    }

    async getQueryEmbedding(query) {
        if (this.embeddingModel && typeof this.embeddingModel.encode === 'function') {
            try {
                const embedding = await this.embeddingModel.encode(query);
                return Array.isArray(embedding) ? embedding : embedding.arraySync ? embedding.arraySync() : embedding;
            } catch (error) {
                console.error("Ошибка получения эмбеддинга:", error);
            }
        }
        
        // Fallback: используем простой метод
        return this.getSimpleEmbeddings(query);
    }

    cosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
        
        let dot = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dot += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        
        if (norm1 === 0 || norm2 === 0) return 0;
        
        return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    analyzePreferences(selectedWines) {
        const analysis = {
            favorite_varieties: [],
            preferred_countries: [],
            average_price: 0,
            average_rating: 0,
            price_range: { min: Infinity, max: -Infinity }
        };
        
        // Анализируем сорта
        const varietyCount = {};
        selectedWines.forEach(wine => {
            if (wine.variety) {
                varietyCount[wine.variety] = (varietyCount[wine.variety] || 0) + 1;
            }
        });
        
        analysis.favorite_varieties = Object.entries(varietyCount)
            .map(([variety, count]) => ({ variety, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        // Анализируем страны
        const countryCount = {};
        selectedWines.forEach(wine => {
            if (wine.country) {
                countryCount[wine.country] = (countryCount[wine.country] || 0) + 1;
            }
        });
        
        analysis.preferred_countries = Object.entries(countryCount)
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        // Вычисляем средние значения
        const validPrices = selectedWines.filter(w => w.price && w.price > 0).map(w => w.price);
        if (validPrices.length > 0) {
            analysis.average_price = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
            analysis.price_range.min = Math.min(...validPrices);
            analysis.price_range.max = Math.max(...validPrices);
        } else {
            analysis.price_range.min = 0;
            analysis.price_range.max = 0;
        }
        
        const validRatings = selectedWines.filter(w => w.points && w.points > 0).map(w => w.points);
        if (validRatings.length > 0) {
            analysis.average_rating = validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length;
        }
        
        return analysis;
    }

    createQueryFromPreferences(analysis) {
        let query = "";
        
        if (analysis.favorite_varieties.length > 0) {
            query += analysis.favorite_varieties.slice(0, 2).map(v => v.variety).join(", ") + " wine ";
        }
        
        if (analysis.preferred_countries.length > 0) {
            query += "from " + analysis.preferred_countries.slice(0, 2).map(c => c.country).join(" and ") + " ";
        }
        
        if (analysis.average_price > 0) {
            if (analysis.average_price < 30) query += "affordable ";
            else if (analysis.average_price > 70) query += "premium ";
        }
        
        query += "similar to user's taste preferences";
        
        return query.trim();
    }

    // Методы для детальной информации о вине
    async getWineAIComment(wine) {
        const comment = await window.llmService.generateWineDescription(wine);
        return { comment };
    }

    async getWinePairing(wineId) {
        const wine = this.wines.find(w => w.id === wineId);
        if (!wine) return { pairing: "Информация отсутствует" };
        
        const pairing = await window.llmService.generatePairingRecommendation(wine);
        return { pairing };
    }

    async getWineOccasion(wine) {
        const occasion = await window.llmService.generateOccasionRecommendation(wine);
        return { occasion };
    }
}

// Создаем глобальный экземпляр
window.wineAPI = new WineAPI();

// Экспортируем API для использования в основном скрипте
window.API = {
    filters: {
        countries: async () => await window.wineAPI.getCountries(),
        varieties: async () => await window.wineAPI.getVarieties(),
        priceRange: async () => await window.wineAPI.getPriceRange()
    },
    recommend: {
        filtered: async (data) => await window.wineAPI.getFilteredRecommendations(data.query, data.filters),
        taste: async (data) => await window.wineAPI.getTasteRecommendations(data.selected_wines),
        simple: async (data) => await window.wineAPI.getSimpleRecommendations(data.query)
    },
    wines: {
        list: async () => await window.wineAPI.getWineList()
    },
    wine: {
        'ai-comment': async (data) => await window.wineAPI.getWineAIComment(data.wine),
        pairing: async (wineId) => await window.wineAPI.getWinePairing(wineId),
        occasion: async (data) => await window.wineAPI.getWineOccasion(data.wine)
    }
};
