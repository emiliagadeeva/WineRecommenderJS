      
 // api.js
class WineAPI {
    constructor() {
        this.wineData = null;
        this.embeddings = null;
        this.recommender = null;
        this.llmService = window.llmService;
        
        // URL для файлов на Google Drive - ЗАМЕНИТЕ НА СВОИ!
        this.csvUrl = 'https://drive.google.com/uc?export=download&id=18mwRZRlY3f6M6nN6VmiHKzDAAZxfEF7A';
        this.embeddingsUrl = 'https://drive.google.com/uc?export=download&id=1KMy_lZIziIsGI3SE2EInydfZJ6rPWlIE';
        
        this.cacheKey = 'wineData_v3';
        this.cacheDuration = 24 * 60 * 60 * 1000; // 24 часа
        
        this.initialized = false;
        this.initPromise = null;
        
        // Публичные методы для получения данных фильтров
        this.countries = null;
        this.varieties = null;
        this.priceRange = null;
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
                        console.log(`📊 ${this.wineData.length} вин, ${this.countries.length} стран, ${this.varieties.length} сортов`);
                        return true;
                    }
                } catch (e) {
                    console.warn('Ошибка чтения кэша:', e);
                }
            }

            try {
                console.log('📥 Загрузка данных с Google Drive...');
                
                // Загружаем CSV
                const wines = await this.loadCSVData();
                this.wineData = wines;
                
                // Загружаем эмбеддинги (если есть)
                try {
                    this.embeddings = await this.loadEmbeddingsData();
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
                
                console.log(`✅ Загружено ${this.wineData.length} вин`);
                console.log(`🌍 Стран: ${this.countries.length}`);
                console.log(`🍇 Сортов: ${this.varieties.length}`);
                console.log(`💰 Диапазон цен: $${this.priceRange.min} - $${this.priceRange.max}`);
                
                return true;
                
            } catch (error) {
                console.error('❌ Ошибка загрузки данных:', error);
                this.loadTestData();
                return false;
            }
        })();
        
        return this.initPromise;
    }

    async loadCSVData() {
        try {
            console.log('📥 Загрузка CSV...');
            const response = await fetch(this.csvUrl);
            
            if (!response.ok) {
                throw new Error(`CSV: ${response.status} ${response.statusText}`);
            }
            
            const csvText = await response.text();
            return this.parseCSV(csvText);
            
        } catch (error) {
            console.error('Ошибка загрузки CSV:', error);
            throw error;
        }
    }

    async loadEmbeddingsData() {
        try {
            console.log('📥 Загрузка эмбеддингов...');
            
            // Если URL не указан, пропускаем
            if (!this.embeddingsUrl || this.embeddingsUrl.includes('YOUR_EMBEDDINGS')) {
                console.log('⚠️ URL эмбеддингов не указан, пропускаем');
                return null;
            }
            
            const response = await fetch(this.embeddingsUrl);
            
            if (!response.ok) {
                throw new Error(`Embeddings: ${response.status}`);
            }
            
            const jsonData = await response.json();
            
            // Поддерживаем разные форматы JSON
            if (Array.isArray(jsonData)) {
                return jsonData; // Простой массив эмбеддингов
            } else if (jsonData.embeddings) {
                return jsonData.embeddings; // Объект с полем embeddings
            } else if (jsonData.data) {
                return jsonData.data; // Объект с полем data
            }
            
            console.warn('⚠️ Неизвестный формат эмбеддингов');
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
                console.warn('CSV файл пустой или содержит только заголовок');
                return [];
            }
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const wines = [];
            
            console.log(`📊 Заголовки CSV: ${headers.join(', ')}`);
            
            for (let i = 1; i < Math.min(lines.length, 1000); i++) { // Ограничиваем 1000 строк для производительности
                try {
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
                            if (['price', 'points', 'rating', 'score'].includes(header.toLowerCase())) {
                                wine[header] = parseFloat(value) || 0;
                            } else if (['id', 'index', 'number'].includes(header.toLowerCase())) {
                                wine[header] = parseInt(value) || i;
                            } else {
                                wine[header] = value || '';
                            }
                        }
                    });
                    
                    // Убедимся в наличии ID
                    if (!wine.id && !wine.ID) wine.id = i;
                    if (!wine.id && wine.ID) wine.id = wine.ID;
                    
                    // Убедимся в наличии названия
                    if (!wine.title && wine.name) wine.title = wine.name;
                    if (!wine.title && wine.Title) wine.title = wine.Title;
                    if (!wine.title && wine.description) {
                        wine.title = wine.description.substring(0, 50) + '...';
                    }
                    
                    // Убедимся в наличии цены
                    if (!wine.price || wine.price <= 0) wine.price = 20 + Math.random() * 100;
                    
                    // Убедимся в наличии рейтинга
                    if (!wine.points || wine.points <= 0) wine.points = 80 + Math.random() * 20;
                    
                    // Добавляем только если есть хотя бы название
                    if (wine.title && wine.title.trim()) {
                        wines.push(wine);
                    }
                    
                } catch (lineError) {
                    console.warn(`Ошибка в строке ${i}:`, lineError);
                    continue;
                }
            }
            
            console.log(`✅ Парсинг CSV: ${wines.length} вин из ${lines.length - 1} строк`);
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

    loadTestData() {
        console.log('⚠️ Загружаем тестовые данные');
        
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
    }

    generateTestData() {
        const testWines = [
            {
                id: 1,
                title: "Cabernet Sauvignon Reserve 2018",
                name: "Cabernet Sauvignon Reserve 2018",
                variety: "Cabernet Sauvignon",
                country: "France",
                region_1: "Bordeaux",
                winery: "Château Margaux",
                price: 125.99,
                points: 96,
                description: "A rich, full-bodied red wine with notes of black currant, dark cherry, and hints of oak. Excellent aging potential.",
                flavor_profile: "Bold and structured",
                body: "Full",
                tannins: "High",
                acidity: "Medium",
                aroma: "Black fruits, tobacco, vanilla",
                pairing_suggestions: "Steak, lamb, aged cheeses"
            },
            {
                id: 2,
                title: "Chardonnay Barrel Select 2020",
                name: "Chardonnay Barrel Select 2020",
                variety: "Chardonnay",
                country: "USA",
                region_1: "California",
                winery: "Napa Valley Winery",
                price: 45.50,
                points: 92,
                description: "Creamy white wine with citrus notes and a smooth vanilla finish from oak aging.",
                flavor_profile: "Buttery and rich",
                body: "Medium",
                acidity: "Medium-High",
                aroma: "Citrus, pear, vanilla",
                pairing_suggestions: "Seafood, chicken, creamy pasta"
            },
            {
                id: 3,
                title: "Pinot Noir Elegance 2019",
                name: "Pinot Noir Elegance 2019",
                variety: "Pinot Noir",
                country: "Italy",
                region_1: "Tuscany",
                winery: "Antinori",
                price: 68.00,
                points: 93,
                description: "Elegant and silky red wine with red berry flavors and subtle spice notes.",
                flavor_profile: "Delicate and aromatic",
                body: "Light",
                tannins: "Low",
                aroma: "Red berries, rose, spice",
                pairing_suggestions: "Duck, mushroom dishes, salmon"
            },
            {
                id: 4,
                title: "Sauvignon Blanc Fresh 2021",
                name: "Sauvignon Blanc Fresh 2021",
                variety: "Sauvignon Blanc",
                country: "New Zealand",
                region_1: "Marlborough",
                winery: "Cloudy Bay",
                price: 32.99,
                points: 90,
                description: "Crisp and refreshing white wine with vibrant grapefruit and herbaceous notes.",
                flavor_profile: "Zesty and crisp",
                body: "Light",
                acidity: "High",
                aroma: "Grapefruit, lime, cut grass",
                pairing_suggestions: "Goat cheese, salads, seafood"
            },
            {
                id: 5,
                title: "Merlot Classic 2017",
                name: "Merlot Classic 2017",
                variety: "Merlot",
                country: "Chile",
                region_1: "Maipo Valley",
                winery: "Concha y Toro",
                price: 28.50,
                points: 89,
                description: "Smooth and approachable red wine with plum and chocolate notes.",
                flavor_profile: "Soft and fruity",
                body: "Medium",
                tannins: "Medium",
                aroma: "Plum, black cherry, chocolate",
                pairing_suggestions: "Pizza, pasta, grilled meats"
            }
        ];
        
        // Добавим еще 25 случайных вин для разнообразия
        const varieties = ["Cabernet Sauvignon", "Merlot", "Pinot Noir", "Syrah", "Chardonnay", "Sauvignon Blanc", "Riesling", "Malbec", "Tempranillo", "Sangiovese", "Zinfandel", "Pinot Grigio", "Grenache", "Cabernet Franc", "Carmenere"];
        const countries = ["France", "Italy", "Spain", "USA", "Chile", "Argentina", "Australia", "Germany", "Portugal", "South Africa", "New Zealand", "Austria", "Hungary", "Greece"];
        const regions = ["Bordeaux", "Tuscany", "Rioja", "Napa Valley", "Maipo Valley", "Mendoza", "Barossa Valley", "Mosel", "Douro", "Stellenbosch", "Marlborough", "Wachau", "Tokaj", "Peloponnese"];
        
        for (let i = 6; i <= 30; i++) {
            const variety = varieties[Math.floor(Math.random() * varieties.length)];
            const country = countries[Math.floor(Math.random() * countries.length)];
            const region = regions[Math.floor(Math.random() * regions.length)];
            const year = 2020 - Math.floor(Math.random() * 10);
            
            testWines.push({
                id: i,
                title: `${variety} ${country} ${year}`,
                name: `${variety} ${country} ${year}`,
                variety: variety,
                country: country,
                region_1: region,
                winery: `${country} Winery`,
                price: Math.floor(Math.random() * 100) + 20,
                points: Math.floor(Math.random() * 15) + 85,
                description: `A fine example of ${variety} from ${country}. Excellent with food or on its own.`,
                flavor_profile: ["Fruity", "Elegant", "Bold", "Smooth"][Math.floor(Math.random() * 4)],
                body: ["Light", "Medium", "Full"][Math.floor(Math.random() * 3)],
                tannins: ["Low", "Medium", "High"][Math.floor(Math.random() * 3)],
                aroma: "Fruit and spice notes",
                pairing_suggestions: "Various dishes"
            });
        }
        
        return testWines;
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
