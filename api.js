// api.js
class WineAPI {
    constructor() {
        this.wineData = null;
        this.embeddings = null;
        this.recommender = null;
        this.llmService = window.llmService;
        
        // Правильные URL для Google Drive (замените на свои)
        // Формат: https://drive.google.com/uc?export=download&id=ВАШ_ID_ФАЙЛА
        this.csvUrl = 'https://drive.google.com/uc?export=download&id=18mwRZRlY3f6M6nN6VmiHKzDAAZxfEF7A';
        this.embeddingsUrl = 'https://drive.google.com/uc?export=download&id=1KMy_lZIziIsGI3SE2EInydfZJ6rPWlIE';
        
        this.cacheKey = 'wineData_v5';
        this.cacheDuration = 24 * 60 * 60 * 1000; // 24 часа
        
        this.initialized = false;
        this.initPromise = null;
        
        // Публичные методы для получения данных фильтров
        this.countries = null;
        this.varieties = null;
        this.priceRange = null;
        
        // Флаг для тестового режима
        this.testMode = false;
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
                
                // Показываем уведомление пользователю
                this.showErrorMessage('Не удалось загрузить данные. Проверьте подключение к интернету или нажмите "Обновить данные" позже.');
                
                // Загружаем тестовые данные как fallback
                this.loadTestData();
                return false;
            }
        })();
        
        return this.initPromise;
    }

    async loadCSVData() {
        try {
            console.log('📥 Загрузка CSV...');
            
            if (!this.csvUrl) {
                throw new Error('URL CSV файла не указан');
            }
            
            // Используем прокси для обхода CORS (если нужно)
            const proxyUrl = this.getProxyUrl(this.csvUrl);
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/csv,text/plain'
                },
                mode: 'cors'
            });
            
            if (!response.ok) {
                // Пробуем без прокси
                console.log('Пробуем прямой запрос...');
                const directResponse = await fetch(this.csvUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/csv,text/plain'
                    }
                });
                
                if (!directResponse.ok) {
                    throw new Error(`Ошибка загрузки CSV: ${directResponse.status} ${directResponse.statusText}`);
                }
                
                const csvText = await directResponse.text();
                return this.parseCSV(csvText);
            }
            
            const csvText = await response.text();
            return this.parseCSV(csvText);
            
        } catch (error) {
            console.error('Ошибка загрузки CSV:', error);
            throw error;
        }
    }

    getProxyUrl(url) {
        // Используем CORS прокси для обхода ограничений
        const proxy = 'https://cors-anywhere.herokuapp.com/';
        return proxy + url;
    }

    async loadEmbeddingsData() {
        try {
            console.log('📥 Загрузка эмбеддингов...');
            
            if (!this.embeddingsUrl) {
                console.log('⚠️ URL эмбеддингов не указан, используем текстовый поиск');
                return null;
            }
            
            const proxyUrl = this.getProxyUrl(this.embeddingsUrl);
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                mode: 'cors'
            });
            
            if (!response.ok) {
                // Пробуем без прокси
                const directResponse = await fetch(this.embeddingsUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (!directResponse.ok) {
                    throw new Error(`Ошибка загрузки эмбеддингов: ${directResponse.status}`);
                }
                
                return await directResponse.json();
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Ошибка загрузки эмбеддингов:', error);
            return null;
        }
    }

    parseCSV(csvText) {
        try {
            // Очищаем текст от BOM и лишних символов
            csvText = csvText.replace(/^\uFEFF/, '').trim();
            
            const lines = csvText.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                throw new Error('CSV файл пустой или содержит только заголовок');
            }
            
            // Парсим заголовки
            const headers = this.parseCSVLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
            
            console.log(`📊 Заголовки CSV:`, headers);
            console.log(`📊 Всего строк: ${lines.length - 1}`);
            
            const wines = [];
            let processedCount = 0;
            let errorCount = 0;
            
            // Обрабатываем первые 1000 строк для производительности
            const maxRows = Math.min(lines.length - 1, 1000);
            
            for (let i = 1; i <= maxRows; i++) {
                try {
                    const values = this.parseCSVLine(lines[i]);
                    const wine = {};
                    
                    // Заполняем поля
                    headers.forEach((header, index) => {
                        if (index < values.length) {
                            let value = values[index];
                            
                            // Очищаем значение
                            if (typeof value === 'string') {
                                value = value.replace(/^"(.*)"$/, '$1').trim();
                            }
                            
                            // Парсим числовые поля
                            if (this.isNumericField(header)) {
                                wine[header] = parseFloat(value) || 0;
                            } else if (this.isIntegerField(header)) {
                                wine[header] = parseInt(value) || i;
                            } else {
                                wine[header] = value || '';
                            }
                        }
                    });
                    
                    // Создаем уникальный ID если нет
                    if (!wine.id && !wine.ID) {
                        wine.id = i;
                    } else if (!wine.id && wine.ID) {
                        wine.id = parseInt(wine.ID) || i;
                    }
                    
                    // Стандартизируем поля
                    this.standardizeWineFields(wine);
                    
                    // Проверяем обязательные поля
                    if (this.isValidWine(wine)) {
                        wines.push(wine);
                        processedCount++;
                    } else {
                        errorCount++;
                    }
                    
                } catch (lineError) {
                    errorCount++;
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

    isNumericField(header) {
        const numericFields = ['price', 'points', 'rating', 'score', 'cost'];
        return numericFields.some(field => header.toLowerCase().includes(field));
    }

    isIntegerField(header) {
        const integerFields = ['id', 'index', 'number'];
        return integerFields.some(field => header.toLowerCase().includes(field));
    }

    standardizeWineFields(wine) {
        // Стандартизируем названия полей
        if (!wine.title && wine.name) wine.title = wine.name;
        if (!wine.title && wine.Title) wine.title = wine.Title;
        if (!wine.title) wine.title = `Вино ${wine.id}`;
        
        if (!wine.variety && wine.type) wine.variety = wine.type;
        if (!wine.variety && wine.grape) wine.variety = wine.grape;
        
        if (!wine.country && wine.origin) wine.country = wine.origin;
        
        if (!wine.price || wine.price <= 0) wine.price = 20 + Math.random() * 80;
        if (!wine.points || wine.points <= 0) wine.points = 80 + Math.random() * 20;
        
        if (!wine.description) wine.description = '';
        if (!wine.region_1 && wine.region) wine.region_1 = wine.region;
        if (!wine.winery && wine.producer) wine.winery = wine.producer;
        
        // Очищаем строковые поля
        if (wine.country) wine.country = this.cleanString(wine.country);
        if (wine.variety) wine.variety = this.cleanString(wine.variety);
        if (wine.title) wine.title = this.cleanString(wine.title);
    }

    cleanString(str) {
        return str.toString()
            .replace(/[^a-zA-Zа-яА-Я0-9\s\-\.\,\'\"]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    isValidWine(wine) {
        return wine.title && 
               wine.title.trim() && 
               wine.variety && 
               wine.variety.trim() && 
               wine.country && 
               wine.country.trim();
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

    loadTestData() {
        console.log('⚠️ Загружаем тестовые данные...');
        this.testMode = true;
        
        // Генерируем тестовые данные на основе типичной структуры винного датасета
        this.wineData = this.generateTestData();
        this.embeddings = null;
        this.recommender = new WineRecommender(this.wineData, null);
        
        // Инициализируем фильтры
        this.countries = this.recommender.countries;
        this.varieties = this.recommender.varieties;
        this.priceRange = this.recommender.priceRange;
        
        this.initialized = true;
        
        console.log(`✅ Загружено ${this.wineData.length} тестовых вин`);
        console.log(`🌍 Стран: ${this.countries.length}`);
        console.log(`🍇 Сортов: ${this.varieties.length}`);
        
        // Сохраняем тестовые данные в кэш
        localStorage.setItem(this.cacheKey, JSON.stringify({
            wineData: this.wineData,
            embeddings: null,
            countries: this.countries,
            varieties: this.varieties,
            priceRange: this.priceRange,
            timestamp: Date.now()
        }));
        
        // Показываем уведомление
        this.showErrorMessage('Используются тестовые данные. Для загрузки реальных данных нажмите "Обновить данные".', 'warning');
    }

    generateTestData() {
        const varieties = [
            "Cabernet Sauvignon", "Merlot", "Pinot Noir", "Syrah", "Chardonnay",
            "Sauvignon Blanc", "Riesling", "Malbec", "Tempranillo", "Sangiovese",
            "Zinfandel", "Pinot Grigio", "Grenache", "Cabernet Franc", "Carmenere"
        ];
        
        const countries = [
            "France", "Italy", "Spain", "USA", "Chile", "Argentina", "Australia",
            "Germany", "Portugal", "South Africa", "New Zealand", "Austria", 
            "Hungary", "Greece", "Russia"
        ];
        
        const regions = [
            "Bordeaux", "Tuscany", "Rioja", "Napa Valley", "Maipo Valley",
            "Mendoza", "Barossa Valley", "Mosel", "Douro", "Stellenbosch",
            "Marlborough", "Wachau", "Tokaj", "Peloponnese", "Krasnodar"
        ];
        
        const wineries = [
            "Château Margaux", "Antinori", "Marqués de Riscal", "Robert Mondavi",
            "Concha y Toro", "Catena Zapata", "Penfolds", "Dr. Loosen",
            "Quinta do Noval", "Kanonkop", "Cloudy Bay", "Domäne Wachau",
            "Royal Tokaji", "Domaine Skouras", "Abrau-Durso"
        ];
        
        const descriptions = [
            "Rich and full-bodied with notes of dark fruit and oak.",
            "Elegant and balanced with subtle acidity and smooth tannins.",
            "Fresh and aromatic with crisp fruit flavors and minerality.",
            "Complex and layered with a long, satisfying finish.",
            "Approachable and fruity with soft texture and pleasant aroma."
        ];
        
        const testWines = [];
        
        for (let i = 1; i <= 100; i++) {
            const variety = varieties[Math.floor(Math.random() * varieties.length)];
            const country = countries[Math.floor(Math.random() * countries.length)];
            const region = regions[Math.floor(Math.random() * regions.length)];
            const winery = wineries[Math.floor(Math.random() * wineries.length)];
            const description = descriptions[Math.floor(Math.random() * descriptions.length)];
            const year = 2015 + Math.floor(Math.random() * 10);
            
            testWines.push({
                id: i,
                title: `${variety} ${region} ${year}`,
                name: `${variety} ${region} ${year}`,
                variety: variety,
                country: country,
                region_1: region,
                winery: winery,
                price: Math.floor(Math.random() * 150) + 20,
                points: Math.floor(Math.random() * 20) + 80,
                description: `A ${variety.toLowerCase()} from ${region}, ${country}. ${description}`,
                flavor_profile: ["Fruity", "Elegant", "Bold", "Smooth", "Crisp"][Math.floor(Math.random() * 5)],
                body: ["Light", "Medium", "Full"][Math.floor(Math.random() * 3)],
                tannins: ["Low", "Medium", "High"][Math.floor(Math.random() * 3)],
                acidity: ["Low", "Medium", "High"][Math.floor(Math.random() * 3)],
                aroma: "Fruit and spice notes",
                pairing_suggestions: "Various dishes"
            });
        }
        
        return testWines;
    }

    showErrorMessage(message, type = 'error') {
        // Создаем уведомление для пользователя
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'error' ? 'danger' : 'warning'} position-fixed`;
        alertDiv.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-radius: 8px;
            animation: slideIn 0.3s ease;
        `;
        
        alertDiv.innerHTML = `
            <div class="d-flex align-items-start">
                <div class="flex-shrink-0 me-2">
                    <i class="bi ${type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'}"></i>
                </div>
                <div class="flex-grow-1">
                    <strong>${type === 'error' ? 'Ошибка' : 'Внимание'}:</strong> ${message}
                </div>
                <div class="flex-shrink-0 ms-2">
                    <button type="button" class="btn-close btn-sm" onclick="this.parentElement.parentElement.parentElement.remove()"></button>
                </div>
            </div>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Автоматически удаляем через 10 секунд
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 10000);
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

    // Метод для очистки кэша
    clearCache() {
        localStorage.removeItem(this.cacheKey);
        this.initialized = false;
        this.initPromise = null;
        console.log('✅ Кэш очищен');
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
