// api.js
class WineAPI {
    constructor() {
        this.wineData = null;
        this.embeddings = null;
        this.recommender = null;
        this.llmService = window.llmService;
        
        // URL для файлов - замените на свои!
        this.csvUrl = 'https://drive.google.com/file/d/18mwRZRlY3f6M6nN6VmiHKzDAAZxfEF7A'; // Замените на URL вашего CSV файла
        this.embeddingsUrl = 'https://drive.google.com/file/d/1KMy_lZIziIsGI3SE2EInydfZJ6rPWlIE'; // Замените на URL вашего JSON файла с эмбеддингами
        
        this.cacheKey = 'wineData_v4';
        this.cacheDuration = 24 * 60 * 60 * 1000; // 24 часа
        
        this.initialized = false;
        this.initPromise = null;
        
        // Публичные методы для получения данных фильтров
        this.countries = null;
        this.varieties = null;
        this.priceRange = null;
        
        // Загружаем SentenceTransformer для вычисления эмбеддингов запросов
        this.loadSentenceTransformer();
    }

    async loadSentenceTransformer() {
        try {
            // Загружаем библиотеку для вычисления эмбеддингов
            if (typeof window !== 'undefined') {
                // Используем CDN для загрузки SentenceTransformer
                if (!window.sentenceTransformers) {
                    console.log('Загрузка SentenceTransformer...');
                    // Здесь можно добавить загрузку библиотеки, если используется в браузере
                    // В продакшене нужно использовать совместимую библиотеку для браузера
                    // или серверное API для вычисления эмбеддингов
                }
            }
        } catch (error) {
            console.warn('Не удалось загрузить SentenceTransformer:', error);
        }
    }

    async init() {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = (async () => {
            console.log("🔄 Инициализация WineAPI...");
            
            // Проверяем кэш
            const cached = localStorage.getItem(this.cacheKey);
            if (cached) {
                try {
                    const { wineData, embeddings, timestamp, countries, varieties, priceRange } = JSON.parse(cached);
                    
                    if (Date.now() - timestamp < this.cacheDuration) {
                        this.wineData = wineData;
                        this.embeddings = embeddings;
                        this.countries = countries;
                        this.varieties = varieties;
                        this.priceRange = priceRange;
                        
                        this.recommender = new WineRecommender(this.wineData, this.embeddings);
                        await this.recommender.initializeModel();
                        this.initialized = true;
                        
                        console.log('✅ Данные загружены из кэша');
                        console.log(`📊 ${this.wineData.length} вин`);
                        console.log(`🌍 ${this.countries.length} стран`);
                        console.log(`🍇 ${this.varieties.length} сортов`);
                        return true;
                    }
                } catch (e) {
                    console.warn('Ошибка чтения кэша:', e);
                }
            }

            try {
                console.log('📥 Загрузка данных...');
                
                // Загружаем CSV
                const wines = await this.loadCSVData();
                if (!wines || wines.length === 0) {
                    throw new Error('CSV файл пуст или не загружен');
                }
                
                this.wineData = wines;
                
                // Загружаем эмбеддинги
                try {
                    this.embeddings = await this.loadEmbeddingsData();
                    if (this.embeddings && Object.keys(this.embeddings).length > 0) {
                        console.log(`✅ Загружено ${Object.keys(this.embeddings).length} эмбеддингов`);
                    } else {
                        console.warn('⚠️ Эмбеддинги не загружены или файл пуст');
                        this.embeddings = null;
                    }
                } catch (embeddingError) {
                    console.warn('⚠️ Эмбеддинги не загружены:', embeddingError.message);
                    this.embeddings = null;
                }
                
                // Создаем рекомендательную систему
                this.recommender = new WineRecommender(this.wineData, this.embeddings);
                await this.recommender.initializeModel();
                
                // Инициализируем фильтры
                this.countries = this.recommender.countries;
                this.varieties = this.recommender.varieties;
                this.priceRange = this.recommender.priceRange;
                
                this.initialized = true;
                
                // Сохраняем в кэш
                localStorage.setItem(this.cacheKey, JSON.stringify({
                    wineData: this.wineData,
                    embeddings: this.embeddings,
                    countries: this.countries,
                    varieties: this.varieties,
                    priceRange: this.priceRange,
                    timestamp: Date.now()
                }));
                
                console.log(`✅ Загружено ${this.wineData.length} вин из CSV`);
                console.log(`🌍 Стран: ${this.countries.length}`);
                console.log(`🍇 Сортов: ${this.varieties.length}`);
                console.log(`💰 Диапазон цен: $${this.priceRange.min} - $${this.priceRange.max}`);
                
                return true;
                
            } catch (error) {
                console.error('❌ Ошибка загрузки данных:', error);
                throw new Error(`Не удалось загрузить данные: ${error.message}`);
            }
        })();
        
        return this.initPromise;
    }

    async loadCSVData() {
        try {
            console.log('📥 Загрузка CSV...');
            
            if (!this.csvUrl || this.csvUrl.includes('YOUR_CSV_FILE_URL')) {
                throw new Error('URL CSV файла не указан. Пожалуйста, укажите корректный URL.');
            }
            
            const response = await fetch(this.csvUrl);
            
            if (!response.ok) {
                throw new Error(`Ошибка загрузки CSV: ${response.status} ${response.statusText}`);
            }
            
            const csvText = await response.text();
            
            if (!csvText || csvText.trim().length === 0) {
                throw new Error('CSV файл пуст');
            }
            
            return this.parseCSV(csvText);
            
        } catch (error) {
            console.error('Ошибка загрузки CSV:', error);
            throw error;
        }
    }

    async loadEmbeddingsData() {
        try {
            console.log('📥 Загрузка эмбеддингов...');
            
            if (!this.embeddingsUrl || this.embeddingsUrl.includes('YOUR_EMBEDDINGS_FILE_URL')) {
                console.log('⚠️ URL эмбеддингов не указан, используем текстовый поиск');
                return null;
            }
            
            const response = await fetch(this.embeddingsUrl);
            
            if (!response.ok) {
                throw new Error(`Ошибка загрузки эмбеддингов: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Ожидаем объект вида { wine_id: [embeddings], ... }
            if (typeof data === 'object' && !Array.isArray(data)) {
                return data;
            }
            
            console.warn('⚠️ Неизвестный формат эмбеддингов, используем текстовый поиск');
            return null;
            
        } catch (error) {
            console.error('Ошибка загрузки эмбеддингов:', error);
            return null;
        }
    }

    parseCSV(csvText) {
        try {
            const lines = csvText.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                throw new Error('CSV файл пустой или содержит только заголовок');
            }
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const wines = [];
            
            console.log(`📊 Заголовки CSV: ${headers.join(', ')}`);
            console.log(`📊 Всего строк: ${lines.length - 1}`);
            
            // Определяем индексы важных полей
            const idIndex = headers.findIndex(h => h.toLowerCase().includes('id'));
            const titleIndex = headers.findIndex(h => 
                h.toLowerCase().includes('title') || 
                h.toLowerCase().includes('name') || 
                h.toLowerCase().includes('wine')
            );
            const varietyIndex = headers.findIndex(h => 
                h.toLowerCase().includes('variety') || 
                h.toLowerCase().includes('type') || 
                h.toLowerCase().includes('grape')
            );
            const countryIndex = headers.findIndex(h => 
                h.toLowerCase().includes('country') || 
                h.toLowerCase().includes('origin')
            );
            const priceIndex = headers.findIndex(h => 
                h.toLowerCase().includes('price') || 
                h.toLowerCase().includes('cost')
            );
            const pointsIndex = headers.findIndex(h => 
                h.toLowerCase().includes('points') || 
                h.toLowerCase().includes('rating') || 
                h.toLowerCase().includes('score')
            );
            const descriptionIndex = headers.findIndex(h => 
                h.toLowerCase().includes('description') || 
                h.toLowerCase().includes('note') || 
                h.toLowerCase().includes('comment')
            );
            const regionIndex = headers.findIndex(h => 
                h.toLowerCase().includes('region') || 
                h.toLowerCase().includes('province')
            );
            const wineryIndex = headers.findIndex(h => 
                h.toLowerCase().includes('winery') || 
                h.toLowerCase().includes('producer') || 
                h.toLowerCase().includes('maker')
            );
            
            let processedCount = 0;
            let errorCount = 0;
            
            for (let i = 1; i < lines.length; i++) {
                try {
                    if (i > 5000) { // Ограничиваем для производительности
                        console.log(`⚠️ Ограничение: обработано 5000 из ${lines.length - 1} строк`);
                        break;
                    }
                    
                    const values = this.parseCSVLine(lines[i]);
                    const wine = {};
                    
                    headers.forEach((header, index) => {
                        if (index < values.length) {
                            let value = values[index];
                            
                            // Убираем кавычки если есть
                            if (typeof value === 'string') {
                                value = value.replace(/^"(.*)"$/, '$1').trim();
                            }
                            
                            // Парсим числовые поля
                            if (['price', 'points', 'rating', 'score'].some(term => 
                                header.toLowerCase().includes(term))) {
                                wine[header] = parseFloat(value) || 0;
                            } else if (['id', 'index', 'number'].some(term => 
                                header.toLowerCase().includes(term))) {
                                wine[header] = parseInt(value) || i;
                            } else {
                                wine[header] = value || '';
                            }
                        }
                    });
                    
                    // Убедимся в наличии ID
                    if (!wine.id && !wine.ID) {
                        if (idIndex !== -1 && values[idIndex]) {
                            wine.id = parseInt(values[idIndex]) || i;
                        } else {
                            wine.id = i;
                        }
                    } else if (!wine.id && wine.ID) {
                        wine.id = parseInt(wine.ID) || i;
                    }
                    
                    // Извлекаем важные поля по индексам
                    if (titleIndex !== -1 && values[titleIndex]) {
                        wine.title = values[titleIndex].replace(/^"(.*)"$/, '$1').trim();
                    }
                    
                    if (varietyIndex !== -1 && values[varietyIndex]) {
                        wine.variety = values[varietyIndex].replace(/^"(.*)"$/, '$1').trim();
                    }
                    
                    if (countryIndex !== -1 && values[countryIndex]) {
                        wine.country = values[countryIndex].replace(/^"(.*)"$/, '$1').trim();
                    }
                    
                    if (priceIndex !== -1 && values[priceIndex]) {
                        wine.price = parseFloat(values[priceIndex]) || 0;
                    }
                    
                    if (pointsIndex !== -1 && values[pointsIndex]) {
                        wine.points = parseFloat(values[pointsIndex]) || 0;
                    }
                    
                    if (descriptionIndex !== -1 && values[descriptionIndex]) {
                        wine.description = values[descriptionIndex].replace(/^"(.*)"$/, '$1').trim();
                    }
                    
                    if (regionIndex !== -1 && values[regionIndex]) {
                        wine.region_1 = values[regionIndex].replace(/^"(.*)"$/, '$1').trim();
                    }
                    
                    if (wineryIndex !== -1 && values[wineryIndex]) {
                        wine.winery = values[wineryIndex].replace(/^"(.*)"$/, '$1').trim();
                    }
                    
                    // Убедимся в наличии названия
                    if (!wine.title && wine.name) {
                        wine.title = wine.name;
                    }
                    if (!wine.title && wine.Title) {
                        wine.title = wine.Title;
                    }
                    if (!wine.title && wine.description) {
                        wine.title = `Вино ${wine.id}`;
                    }
                    
                    // Убедимся в наличии цены
                    if (!wine.price || wine.price <= 0) {
                        wine.price = 20 + Math.random() * 100;
                    }
                    
                    // Убедимся в наличии рейтинга
                    if (!wine.points || wine.points <= 0) {
                        wine.points = 80 + Math.random() * 20;
                    }
                    
                    // Очищаем значения
                    if (wine.country) wine.country = wine.country.replace(/[^a-zA-Zа-яА-Я\s-]/g, '').trim();
                    if (wine.variety) wine.variety = wine.variety.replace(/[^a-zA-Zа-яА-Я\s-]/g, '').trim();
                    
                    // Добавляем только если есть основные поля
                    if (wine.title && wine.title.trim() && 
                        wine.country && wine.country.trim() &&
                        wine.variety && wine.variety.trim()) {
                        wines.push(wine);
                        processedCount++;
                    } else {
                        errorCount++;
                    }
                    
                } catch (lineError) {
                    errorCount++;
                    console.warn(`Ошибка в строке ${i}:`, lineError);
                    continue;
                }
            }
            
            console.log(`✅ Парсинг CSV: ${processedCount} успешно, ${errorCount} ошибок`);
            
            if (wines.length === 0) {
                throw new Error('Не удалось распарсить ни одного вина из CSV');
            }
            
            return wines;
            
        } catch (error) {
            console.error('Ошибка парсинга CSV:', error);
            throw error;
        }
    }

    parseCSVLine(line) {
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
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current);
        return values;
    }

    // Методы для получения фильтров
    async getCountries() {
        if (!this.initialized) {
            await this.init();
        }
        return this.countries || [];
    }

    async getVarieties() {
        if (!this.initialized) {
            await this.init();
        }
        return this.varieties || [];
    }

    async getPriceRange() {
        if (!this.initialized) {
            await this.init();
        }
        return this.priceRange || { min: 10, max: 500 };
    }

    // Основные методы API
    async getFilteredRecommendations(query, filters) {
        await this.init();
        
        const recommendations = await this.recommender.searchByQuery(query, filters, 20);
        
        const llm_comment = await this.generateLLMComment('filtered', {
            query,
            recommendations,
            filters
        });
        
        // Добавляем LLM комментарии к топ винам
        await this.addWineComments(recommendations.slice(0, 3));
        
        return {
            recommendations,
            llm_comment
        };
    }

    async getTasteRecommendations(selectedWineIds) {
        await this.init();
        
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
        await this.init();
        
        const recommendations = await this.recommender.searchByQuery(query, {}, 15);
        
        const llm_comment = await this.generateLLMComment('simple', {
            query,
            recommendations
        });
        
        await this.addWineComments(recommendations.slice(0, 3));
        
        return {
            recommendations,
            llm_comment
        };
    }

    async getWineList() {
        await this.init();
        return this.recommender.getAllWines();
    }

    async addWineComments(wines) {
        for (const wine of wines) {
            if (!wine.llm_comment) {
                try {
                    const comment = await this.llmService.generateComment('wine_details', { wine });
                    wine.llm_comment = comment;
                } catch (error) {
                    console.error('Error generating wine comment:', error);
                }
            }
        }
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

    getWineById(id) {
        return this.wineData.find(wine => wine.id == id);
    }
}

// Создаем глобальный экземпляр
window.wineAPI = new WineAPI();

// API endpoints для интерфейса
window.API = {
    filters: {
        countries: async () => {
            return await window.wineAPI.getCountries();
        },
        varieties: async () => {
            return await window.wineAPI.getVarieties();
        },
        priceRange: async () => {
            return await window.wineAPI.getPriceRange();
        }
    },
    
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
