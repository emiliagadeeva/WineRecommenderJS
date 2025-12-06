// api.js
class WineAPI {
    constructor() {
        this.wineData = null;
        this.recommender = null;
        this.llmService = window.llmService;
        this.csvUrl = 'https://drive.google.com/uc?export=download&id=YOUR_CSV_FILE_ID'; // Замените на ваш ID
        this.cacheKey = 'wineDataCache_v1';
        this.cacheDuration = 24 * 60 * 60 * 1000; // 24 часа
        this.initialized = false;
        this.initPromise = this.loadData();
    }

    async loadData() {
        if (this.initialized) return true;
        
        // Проверяем кэш
        const cached = localStorage.getItem(this.cacheKey);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < this.cacheDuration) {
                    this.wineData = data;
                    this.recommender = new WineRecommender(this.wineData);
                    this.initialized = true;
                    console.log('✅ Данные загружены из кэша');
                    return true;
                }
            } catch (e) {
                console.warn('Ошибка чтения кэша:', e);
            }
        }

        try {
            console.log('🔄 Загрузка данных с Google Drive...');
            
            // Загружаем CSV
            const response = await fetch(this.csvUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            const csvText = await response.text();
            this.wineData = this.parseCSV(csvText);
            
            if (!this.wineData || this.wineData.length === 0) {
                throw new Error('CSV файл пустой или неверный формат');
            }
            
            // Создаем рекомендательную систему
            this.recommender = new WineRecommender(this.wineData);
            this.initialized = true;
            
            // Сохраняем в кэш
            localStorage.setItem(this.cacheKey, JSON.stringify({
                data: this.wineData,
                timestamp: Date.now()
            }));
            
            console.log(`✅ Загружено ${this.wineData.length} вин`);
            return true;
            
        } catch (error) {
            console.error('Ошибка загрузки CSV:', error);
            
            // Загружаем тестовые данные
            this.loadTestData();
            return false;
        }
    }

    parseCSV(csvText) {
        try {
            const lines = csvText.split('\n').filter(line => line.trim());
            if (lines.length < 2) return [];
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const wines = [];
            
            for (let i = 1; i < Math.min(lines.length, 1000); i++) { // Ограничиваем 1000 записей
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const wine = {};
                
                headers.forEach((header, index) => {
                    if (index < values.length) {
                        const value = values[index];
                        
                        // Парсим числовые значения
                        if (['price', 'points'].includes(header.toLowerCase())) {
                            wine[header] = parseFloat(value) || 0;
                        } else if (['id', 'index'].includes(header.toLowerCase())) {
                            wine[header] = parseInt(value) || i;
                        } else {
                            wine[header] = value || '';
                        }
                    }
                });
                
                // Убедимся, что есть ID
                if (!wine.id) wine.id = i;
                
                // Добавляем только если есть название и цена
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
            {
                id: 2,
                title: "Chardonnay Barrel Select",
                variety: "Chardonnay",
                country: "USA",
                price: 45.50,
                points: 91,
                description: "Creamy white wine with citrus and vanilla notes",
                flavor_profile: "Buttery with good acidity",
                body: "Medium",
                acidity: "Medium-High",
                region_1: "California",
                winery: "Napa Valley Winery"
            },
            {
                id: 3,
                title: "Pinot Noir Elegance",
                variety: "Pinot Noir",
                country: "Italy",
                price: 65.00,
                points: 92,
                description: "Elegant red wine with red berry and spice notes",
                flavor_profile: "Light-bodied and silky",
                body: "Light",
                tannins: "Low",
                region_1: "Tuscany",
                winery: "Antinori"
            },
            {
                id: 4,
                title: "Sauvignon Blanc Fresh",
                variety: "Sauvignon Blanc",
                country: "New Zealand",
                price: 32.99,
                points: 90,
                description: "Crisp white wine with grapefruit and herb notes",
                flavor_profile: "Zesty and refreshing",
                body: "Light",
                acidity: "High",
                region_1: "Marlborough",
                winery: "Cloudy Bay"
            },
            {
                id: 5,
                title: "Merlot Classic",
                variety: "Merlot",
                country: "Chile",
                price: 28.50,
                points: 88,
                description: "Smooth red wine with plum and chocolate notes",
                flavor_profile: "Soft and approachable",
                body: "Medium",
                tannins: "Medium",
                region_1: "Maipo Valley",
                winery: "Concha y Toro"
            },
            {
                id: 6,
                title: "Syrah Spice",
                variety: "Syrah",
                country: "Australia",
                price: 55.00,
                points: 93,
                description: "Bold red wine with black pepper and dark fruit notes",
                flavor_profile: "Spicy and intense",
                body: "Full",
                tannins: "High",
                region_1: "Barossa Valley",
                winery: "Penfolds"
            },
            {
                id: 7,
                title: "Riesling Sweet",
                variety: "Riesling",
                country: "Germany",
                price: 39.99,
                points: 89,
                description: "Sweet white wine with peach and honey notes",
                flavor_profile: "Fruity and aromatic",
                body: "Light",
                sweetness: "Sweet",
                region_1: "Mosel",
                winery: "Dr. Loosen"
            },
            {
                id: 8,
                title: "Malbec Reserve",
                variety: "Malbec",
                country: "Argentina",
                price: 42.00,
                points: 91,
                description: "Robust red wine with dark cherry and violet notes",
                flavor_profile: "Rich and velvety",
                body: "Full",
                tannins: "Medium-High",
                region_1: "Mendoza",
                winery: "Catena Zapata"
            },
            {
                id: 9,
                title: "Prosecco Sparkling",
                variety: "Sparkling",
                country: "Italy",
                price: 25.99,
                points: 87,
                description: "Light sparkling wine with apple and pear notes",
                flavor_profile: "Crisp and bubbly",
                body: "Light",
                region_1: "Veneto",
                winery: "Mionetto"
            },
            {
                id: 10,
                title: "Zinfandel Bold",
                variety: "Zinfandel",
                country: "USA",
                price: 38.50,
                points: 90,
                description: "Jammy red wine with raspberry and spice notes",
                flavor_profile: "Fruit-forward and spicy",
                body: "Full",
                tannins: "Medium",
                region_1: "California",
                winery: "Ravenswood"
            }
        ];
        
        this.recommender = new WineRecommender(this.wineData);
        this.initialized = true;
        console.log('✅ Загружено 10 тестовых вин');
    }

    async getFilteredRecommendations(query, filters) {
        await this.initPromise;
        
        const recommendations = this.recommender.searchByQuery(query, filters, 20);
        
        // Генерируем LLM комментарий
        const llm_comment = await this.generateLLMComment('filtered', {
            query,
            recommendations,
            filters
        });
        
        // Добавляем LLM комментарии к топ-5 винам
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
        
        // Генерируем LLM комментарий
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
        
        const recommendations = this.recommender.searchByQuery(query, {}, 15);
        
        // Генерируем LLM комментарий
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
        
        // Fallback
        return this.llmService.generateFallbackComment(type, context);
    }

    // AI комментарии для деталей вина
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
