// api.js
class WineAPI {
    constructor() {
        this.wineData = null;
        this.embeddings = null;
        this.recommender = null;
        this.llmService = window.llmService;
        
        // URL для файлов на Google Drive
        this.csvUrl = 'https://drive.google.com/file/d/18mwRZRlY3f6M6nN6VmiHKzDAAZxfEF7A';
        this.embeddingsUrl = 'https://drive.google.com/file/d/1w7to6R0qf2h0-yBXwJl62-pRWN5LP60I';
        
        this.cacheKey = 'wineDataCache_v2';
        this.embeddingsCacheKey = 'wineEmbeddingsCache_v2';
        this.cacheDuration = 24 * 60 * 60 * 1000;
        
        this.initialized = false;
        this.initPromise = this.loadData();
    }

    async loadData() {
        if (this.initialized) return true;
        
        // Пробуем загрузить из кэша
        const cachedData = localStorage.getItem(this.cacheKey);
        const cachedEmbeddings = localStorage.getItem(this.embeddingsCacheKey);
        
        if (cachedData && cachedEmbeddings) {
            try {
                const { data, timestamp } = JSON.parse(cachedData);
                const embeddingsData = JSON.parse(cachedEmbeddings);
                
                if (Date.now() - timestamp < this.cacheDuration) {
                    this.wineData = data;
                    this.embeddings = embeddingsData.embeddings;
                    this.recommender = new WineRecommender(this.wineData, this.embeddings);
                    this.initialized = true;
                    console.log('✅ Данные и эмбеддинги загружены из кэша');
                    return true;
                }
            } catch (e) {
                console.warn('Ошибка чтения кэша:', e);
            }
        }

        try {
            console.log('🔄 Загрузка данных с Google Drive...');
            
            // Загружаем CSV и эмбеддинги параллельно
            const [csvResponse, embeddingsResponse] = await Promise.all([
                fetch(this.csvUrl),
                fetch(this.embeddingsUrl)
            ]);
            
            if (!csvResponse.ok) throw new Error(`CSV: HTTP ${csvResponse.status}`);
            if (!embeddingsResponse.ok) throw new Error(`Embeddings: HTTP ${embeddingsResponse.status}`);
            
            const [csvText, embeddingsBuffer] = await Promise.all([
                csvResponse.text(),
                embeddingsResponse.arrayBuffer()
            ]);
            
            // Парсим CSV
            this.wineData = this.parseCSV(csvText);
            
            if (!this.wineData || this.wineData.length === 0) {
                throw new Error('CSV файл пустой');
            }
            
            // Обрабатываем pickle файл
            this.embeddings = await this.parsePickleFile(embeddingsBuffer);
            
            if (!this.embeddings || this.embeddings.length === 0) {
                console.warn('⚠️ Эмбеддинги не загружены, используем текстовый поиск');
            }
            
            // Создаем рекомендательную систему
            this.recommender = new WineRecommender(this.wineData, this.embeddings);
            this.initialized = true;
            
            // Сохраняем в кэш (упрощенные эмбеддинги для экономии места)
            const simplifiedEmbeddings = this.embeddings.map(emb => 
                emb.length > 100 ? emb.slice(0, 100) : emb
            );
            
            localStorage.setItem(this.cacheKey, JSON.stringify({
                data: this.wineData,
                timestamp: Date.now()
            }));
            
            localStorage.setItem(this.embeddingsCacheKey, JSON.stringify({
                embeddings: simplifiedEmbeddings,
                timestamp: Date.now()
            }));
            
            console.log(`✅ Загружено ${this.wineData.length} вин и ${this.embeddings?.length || 0} эмбеддингов`);
            return true;
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            
            // Загружаем тестовые данные
            this.loadTestData();
            return false;
        }
    }

    async parsePickleFile(buffer) {
        try {
            // Для простоты предположим, что pickle файл содержит JSON
            // В реальности нужно использовать библиотеку для парсинга pickle
            const text = new TextDecoder().decode(buffer);
            
            // Пробуем разные форматы
            try {
                // Если это JSON
                const data = JSON.parse(text);
                return data.embeddings || data;
            } catch (e) {
                // Если это бинарный pickle, используем простой парсер
                return this.parseBinaryPickle(buffer);
            }
        } catch (error) {
            console.error('Ошибка парсинга pickle файла:', error);
            return null;
        }
    }

    parseBinaryPickle(buffer) {
        // Упрощенный парсер для формата из вашего Python кода
        try {
            const dataView = new DataView(buffer);
            const decoder = new TextDecoder('utf-8');
            
            // Читаем заголовок pickle
            const header = decoder.decode(new Uint8Array(buffer, 0, Math.min(100, buffer.byteLength)));
            
            if (header.includes('embeddings') && header.includes('descriptions')) {
                // Это вероятно формат из вашего кода
                console.log('Распознан формат эмбеддингов из Python');
                
                // Для демо версии возвращаем пустой массив
                // В реальном приложении нужен полноценный парсер pickle
                return this.generateDummyEmbeddings(this.wineData?.length || 100);
            }
            
            return null;
        } catch (error) {
            console.error('Ошибка парсинга бинарного pickle:', error);
            return null;
        }
    }

    generateDummyEmbeddings(count) {
        // Генерируем фиктивные эмбеддинги для демо
        const embeddings = [];
        for (let i = 0; i < count; i++) {
            const embedding = new Array(384).fill(0).map(() => Math.random() * 2 - 1);
            embeddings.push(embedding);
        }
        return embeddings;
    }

    parseCSV(csvText) {
        try {
            const lines = csvText.split('\n').filter(line => line.trim());
            if (lines.length < 2) return [];
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const wines = [];
            
            for (let i = 1; i < Math.min(lines.length, 1000); i++) {
                const values = this.parseCSVLine(lines[i]);
                const wine = {};
                
                headers.forEach((header, index) => {
                    if (index < values.length) {
                        const value = values[index];
                        
                        if (['price', 'points'].includes(header.toLowerCase())) {
                            wine[header] = parseFloat(value) || 0;
                        } else if (['id', 'index'].includes(header.toLowerCase())) {
                            wine[header] = parseInt(value) || i;
                        } else {
                            wine[header] = value || '';
                        }
                    }
                });
                
                if (!wine.id) wine.id = i;
                if (wine.title && wine.price) {
                    wines.push(wine);
                }
            }
            
            return wines;
        } catch (error) {
            console.error('Ошибка парсинга CSV:', error);
            return [];
        }
    }

    parseCSVLine(line) {
        // Улучшенный парсер CSV с учетом кавычек
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"' && !inQuotes) {
                inQuotes = true;
            } else if (char === '"' && inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else if (char === '"' && inQuotes) {
                inQuotes = false;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current.trim());
        return values;
    }

    loadTestData() {
        console.log('⚠️ Загружаем тестовые данные');
        
        this.wineData = [
            {
                id: 1,
                title: "Cabernet Sauvignon Reserve",
                variety: "Cabernet Sauvignon",
                country: "France",
                price: 89.99,
                points: 94,
                description: "Rich red wine with notes of black currant, cherry and oak",
                flavor_profile: "Full-bodied with firm tannins",
                body: "Full",
                tannins: "High",
                region_1: "Bordeaux",
                winery: "Château Margaux"
            },
            // ... остальные тестовые данные
        ];
        
        this.embeddings = this.generateDummyEmbeddings(this.wineData.length);
        this.recommender = new WineRecommender(this.wineData, this.embeddings);
        this.initialized = true;
        console.log(`✅ Загружено ${this.wineData.length} тестовых вин`);
    }

    async getFilteredRecommendations(query, filters) {
        await this.initPromise;
        
        const recommendations = await this.recommender.searchByQuery(query, filters, 20);
        
        const llm_comment = await this.generateLLMComment('filtered', {
            query,
            recommendations,
            filters
        });
        
        const topWines = recommendations.slice(0, 5);
        for (const wine of topWines) {
            try {
                wine.llm_comment = await this.llmService.generateComment('wine_details', { wine });
            } catch (error) {
                console.error('Error generating wine comment:', error);
            }
        }
        
        return {
            recommendations,
            llm_comment
        };
    }

    async getTasteRecommendations(selectedWineIds) {
        await this.initPromise;
        
        const result = this.recommender.getTasteRecommendations(selectedWineIds, 12);
        const selectedWines = this.wineData.filter(w => selectedWineIds.includes(w.id));
        
        const llm_comment = await this.generateLLMComment('taste', {
            recommendations: result.recommendations,
            preference_analysis: result.preference_analysis,
            selected_wines: selectedWines
        });
        
        return {
            ...result,
            llm_comment
        };
    }

    async getSimpleRecommendations(query) {
        await this.initPromise;
        
        const recommendations = await this.recommender.searchByQuery(query, {}, 15);
        
        const llm_comment = await this.generateLLMComment('simple', {
            query,
            recommendations
        });
        
        return {
            recommendations,
            llm_comment
        };
    }

    async getWineList() {
        await this.initPromise;
        return this.recommender.getAllWines();
    }

    async generateLLMComment(type, context) {
        try {
            if (this.llmService && this.llmService.isInitialized) {
                return await this.llmService.generateComment(type, context);
            }
        } catch (error) {
            console.error('LLM generation failed:', error);
        }
        
        return this.llmService.generateFallbackComment(type, context);
    }

    async getWineAIComment(wine) {
        try {
            if (this.llmService && this.llmService.isInitialized) {
                const comment = await this.llmService.generateComment('wine_details', { wine });
                return { comment };
            }
        } catch (error) {
            console.error('Error generating wine comment:', error);
        }
        
        return {
            comment: this.llmService.generateFallbackComment('wine_details', { wine })
        };
    }

    async getWinePairing(wineId) {
        try {
            const wine = this.wineData.find(w => w.id == wineId);
            if (!wine) throw new Error('Wine not found');
            
            if (this.llmService && this.llmService.isInitialized) {
                const pairing = await this.llmService.generateComment('pairing', { wine });
                return { pairing };
            }
        } catch (error) {
            console.error('Error generating pairing:', error);
        }
        
        return {
            pairing: this.llmService.generateFallbackComment('pairing', {})
        };
    }

    async getWineOccasion(wine) {
        try {
            if (this.llmService && this.llmService.isInitialized) {
                const occasion = await this.llmService.generateComment('occasion', { wine });
                return { occasion };
            }
        } catch (error) {
            console.error('Error generating occasion:', error);
        }
        
        return {
            occasion: this.llmService.generateFallbackComment('occasion', {})
        };
    }
}

// Создаем глобальный экземпляр
window.wineAPI = new WineAPI();

// API endpoints для интерфейса
window.API = {
    recommend: {
        filtered: async (data) => {
            return await window.wineAPI.getFilteredRecommendations(data.query, data.filters);
        },
        
        taste: async (data) => {
            return await window.wineAPI.getTasteRecommendations(data.selected_wines);
        },
        
        simple: async (data) => {
            return await window.wineAPI.getSimpleRecommendations(data.query);
        }
    },
    
    wines: {
        list: async () => {
            return await window.wineAPI.getWineList();
        }
    },
    
    wine: {
        'ai-comment': async (data) => {
            return await window.wineAPI.getWineAIComment(data.wine);
        },
        
        pairing: async (wineId) => {
            return await window.wineAPI.getWinePairing(wineId);
        },
        
        occasion: async (data) => {
            return await window.wineAPI.getWineOccasion(data.wine);
        }
    }
};
