// wine-recommender.js
class WineRecommender {
    constructor(wineData, embeddings = null) {
        this.wines = wineData;
        this.embeddings = embeddings;
        this.useEmbeddings = embeddings !== null && embeddings.length > 0;
        
        console.log(`📊 Инициализация WineRecommender: ${wineData.length} вин, эмбеддинги: ${this.useEmbeddings ? 'да' : 'нет'}`);
        
        // Инициализируем модель для вычисления эмбеддингов запросов
        this.sentenceTransformer = null;
        this.initFilters();
    }

    initFilters() {
        // Получаем уникальные страны
        const countriesSet = new Set();
        this.wines.forEach(wine => {
            if (wine.country && wine.country.trim() && 
                wine.country !== 'Unknown' && 
                wine.country !== 'N/A' && 
                wine.country !== 'null') {
                countriesSet.add(wine.country.trim());
            }
        });
        this.countries = Array.from(countriesSet).sort((a, b) => a.localeCompare(b));
        
        // Получаем уникальные сорта
        const varietiesSet = new Set();
        this.wines.forEach(wine => {
            if (wine.variety && wine.variety.trim() && 
                wine.variety !== 'Unknown' && 
                wine.variety !== 'N/A' && 
                wine.variety !== 'null') {
                varietiesSet.add(wine.variety.trim());
            }
        });
        this.varieties = Array.from(varietiesSet).sort((a, b) => a.localeCompare(b));
        
        // Получаем диапазон цен
        const prices = this.wines.map(wine => parseFloat(wine.price) || 0).filter(p => p > 0);
        this.priceRange = {
            min: prices.length > 0 ? Math.floor(Math.min(...prices)) : 10,
            max: prices.length > 0 ? Math.ceil(Math.max(...prices)) : 500
        };
        
        // Создаем индексы для быстрого поиска
        this.createSearchIndices();
        
        console.log(`🌍 Стран: ${this.countries.length}`);
        console.log(`🍇 Сортов: ${this.varieties.length}`);
        console.log(`💰 Цены: $${this.priceRange.min} - $${this.priceRange.max}`);
    }

    createSearchIndices() {
        // Создаем индекс для текстового поиска
        this.searchIndex = {};
        this.wines.forEach((wine, index) => {
            const searchText = `${wine.title || ''} ${wine.variety || ''} ${wine.country || ''} ${wine.description || ''}`.toLowerCase();
            const words = searchText.split(/\s+/).filter(word => word.length > 2);
            
            words.forEach(word => {
                if (!this.searchIndex[word]) {
                    this.searchIndex[word] = [];
                }
                this.searchIndex[word].push(index);
            });
        });
    }

    async initializeModel() {
        if (!this.useEmbeddings) return;
        
        try {
            // Загружаем SentenceTransformer для вычисления эмбеддингов запросов
            if (typeof window !== 'undefined' && window.sentenceTransformers) {
                this.sentenceTransformer = window.sentenceTransformers;
            } else {
                console.warn('SentenceTransformer не загружен, используем текстовый поиск');
                this.useEmbeddings = false;
            }
        } catch (error) {
            console.error('Ошибка инициализации модели:', error);
            this.useEmbeddings = false;
        }
    }

    async calculateQueryEmbedding(query) {
        if (!this.sentenceTransformer) {
            throw new Error('SentenceTransformer не инициализирован');
        }
        
        try {
            const embedding = await this.sentenceTransformer.encode(query);
            return embedding;
        } catch (error) {
            console.error('Ошибка вычисления эмбеддинга запроса:', error);
            throw error;
        }
    }

    cosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) {
            return 0;
        }
        
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        
        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);
        
        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }
        
        return dotProduct / (norm1 * norm2);
    }

    async searchByQuery(query, filters = {}, limit = 20) {
        console.log(`🔍 Поиск: "${query}", фильтры:`, filters);
        
        // Применяем фильтры к винам
        let filteredWines = this.applyFilters(filters);
        
        if (this.useEmbeddings && this.embeddings && query.trim()) {
            try {
                // Вычисляем эмбеддинг запроса
                const queryEmbedding = await this.calculateQueryEmbedding(query);
                
                // Вычисляем схожесть для каждого вина
                const resultsWithScores = filteredWines.map((wine, index) => {
                    const wineEmbedding = this.embeddings[wine.id] || this.embeddings[index];
                    let similarity = 0;
                    
                    if (wineEmbedding) {
                        similarity = this.cosineSimilarity(queryEmbedding, wineEmbedding);
                    } else {
                        // Если нет эмбеддинга для вина, используем текстовый поиск
                        similarity = this.calculateTextSimilarity(wine, query);
                    }
                    
                    return {
                        ...wine,
                        similarity_score: similarity
                    };
                });
                
                // Сортируем по убыванию схожести
                resultsWithScores.sort((a, b) => b.similarity_score - a.similarity_score);
                
                // Оставляем только вина с положительной схожестью
                const results = resultsWithScores
                    .filter(item => item.similarity_score > 0.1)
                    .slice(0, limit);
                
                console.log(`📊 Найдено ${results.length} результатов (семантический поиск)`);
                return results;
                
            } catch (error) {
                console.error('Ошибка семантического поиска:', error);
                return this.textSearch(query, filters, limit);
            }
        } else {
            return this.textSearch(query, filters, limit);
        }
    }

    applyFilters(filters) {
        return this.wines.filter(wine => {
            if (filters.variety && wine.variety !== filters.variety) return false;
            if (filters.country && wine.country !== filters.country) return false;
            if (filters.max_price && wine.price > filters.max_price) return false;
            return true;
        });
    }

    textSearch(query, filters, limit) {
        if (!query || query.trim() === '') {
            // Если запрос пустой, возвращаем вина, отфильтрованные по фильтрам
            const filteredWines = this.applyFilters(filters);
            return filteredWines
                .map(wine => ({
                    ...wine,
                    similarity_score: 0.5
                }))
                .slice(0, limit);
        }
        
        const searchTerms = query.toLowerCase()
            .split(/\s+/)
            .filter(term => term.length > 2);
        
        if (searchTerms.length === 0) {
            return this.applyFilters(filters)
                .map(wine => ({
                    ...wine,
                    similarity_score: 0.5
                }))
                .slice(0, limit);
        }
        
        // Используем индекс для быстрого поиска
        const wineScores = new Map();
        
        searchTerms.forEach(term => {
            const wineIndices = this.searchIndex[term] || [];
            wineIndices.forEach(wineIndex => {
                const wine = this.wines[wineIndex];
                
                // Проверяем фильтры
                if (filters.variety && wine.variety !== filters.variety) return;
                if (filters.country && wine.country !== filters.country) return;
                if (filters.max_price && wine.price > filters.max_price) return;
                
                const currentScore = wineScores.get(wineIndex) || 0;
                
                // Вычисляем вес термина
                let weight = 0.1;
                const wineText = `${wine.title || ''} ${wine.variety || ''} ${wine.country || ''}`.toLowerCase();
                
                if (wine.title && wine.title.toLowerCase().includes(term)) {
                    weight = 0.3;
                } else if (wine.variety && wine.variety.toLowerCase().includes(term)) {
                    weight = 0.2;
                } else if (wine.country && wine.country.toLowerCase().includes(term)) {
                    weight = 0.15;
                }
                
                wineScores.set(wineIndex, currentScore + weight);
            });
        });
        
        // Конвертируем Map в массив результатов
        const results = Array.from(wineScores.entries())
            .map(([index, score]) => ({
                ...this.wines[index],
                similarity_score: Math.min(score / searchTerms.length, 1.0)
            }))
            .sort((a, b) => b.similarity_score - a.similarity_score)
            .slice(0, limit);
        
        console.log(`📊 Найдено ${results.length} результатов (текстовый поиск)`);
        return results;
    }

    calculateTextSimilarity(wine, query) {
        if (!query || query.trim() === '') return 0.5;
        
        const searchTerms = query.toLowerCase()
            .split(/\s+/)
            .filter(term => term.length > 2);
        
        if (searchTerms.length === 0) return 0.5;
        
        let score = 0;
        const wineText = `${wine.title || ''} ${wine.variety || ''} ${wine.country || ''} ${wine.description || ''}`.toLowerCase();
        
        let matches = 0;
        searchTerms.forEach(term => {
            if (wineText.includes(term)) {
                matches++;
                // Бонус за точное совпадение
                if (wine.title && wine.title.toLowerCase().includes(term)) {
                    score += 0.3;
                } else if (wine.variety && wine.variety.toLowerCase().includes(term)) {
                    score += 0.2;
                } else if (wine.country && wine.country.toLowerCase().includes(term)) {
                    score += 0.15;
                } else {
                    score += 0.1;
                }
            }
        });
        
        if (matches === 0) return 0;
        
        // Нормализуем результат
        return Math.min(score / searchTerms.length, 1.0);
    }

    getTasteRecommendations(selectedWineIds, limit = 10) {
        const selectedWines = this.wines.filter(wine => selectedWineIds.includes(wine.id));
        
        if (selectedWines.length === 0) {
            return { recommendations: [], preference_analysis: {} };
        }
        
        const preferenceAnalysis = this.analyzePreferences(selectedWines);
        
        // Получаем эмбеддинги выбранных вин для вычисления схожести
        const selectedEmbeddings = selectedWines
            .map(wine => this.embeddings[wine.id] || null)
            .filter(embedding => embedding !== null);
        
        const recommendations = this.wines
            .filter(wine => !selectedWineIds.includes(wine.id))
            .map(wine => {
                let similarityScore = 0;
                
                // Вычисляем схожесть на основе эмбеддингов
                if (this.useEmbeddings && selectedEmbeddings.length > 0) {
                    const wineEmbedding = this.embeddings[wine.id];
                    if (wineEmbedding) {
                        // Вычисляем среднюю схожесть со всеми выбранными винами
                        let totalSimilarity = 0;
                        selectedEmbeddings.forEach(selectedEmbedding => {
                            totalSimilarity += this.cosineSimilarity(wineEmbedding, selectedEmbedding);
                        });
                        similarityScore = totalSimilarity / selectedEmbeddings.length;
                    }
                }
                
                // Если нет эмбеддингов, используем анализ предпочтений
                if (similarityScore === 0) {
                    similarityScore = this.calculateTasteSimilarity(wine, selectedWines, preferenceAnalysis);
                }
                
                return {
                    ...wine,
                    similarity_score: similarityScore
                };
            })
            .sort((a, b) => b.similarity_score - a.similarity_score)
            .slice(0, limit);
            
        return {
            recommendations,
            preference_analysis: preferenceAnalysis
        };
    }

    analyzePreferences(selectedWines) {
        const analysis = {
            favorite_varieties: [],
            preferred_countries: [],
            average_price: 0,
            average_rating: 0,
            price_range: { min: Infinity, max: -Infinity }
        };
        
        const varietyCount = {};
        const countryCount = {};
        let totalPrice = 0;
        let totalRating = 0;
        let validPrices = 0;
        let validRatings = 0;
        
        selectedWines.forEach(wine => {
            // Подсчет сортов
            if (wine.variety) {
                varietyCount[wine.variety] = (varietyCount[wine.variety] || 0) + 1;
            }
            
            // Подсчет стран
            if (wine.country) {
                countryCount[wine.country] = (countryCount[wine.country] || 0) + 1;
            }
            
            // Цены
            const price = parseFloat(wine.price);
            if (!isNaN(price) && price > 0) {
                totalPrice += price;
                validPrices++;
                
                if (price < analysis.price_range.min) analysis.price_range.min = price;
                if (price > analysis.price_range.max) analysis.price_range.max = price;
            }
            
            // Рейтинги
            const rating = wine.points || wine.rating;
            if (rating && rating > 0) {
                totalRating += rating;
                validRatings++;
            }
        });
        
        // Сортируем сорта по популярности
        analysis.favorite_varieties = Object.entries(varietyCount)
            .map(([variety, count]) => ({ variety, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        // Сортируем страны по популярности
        analysis.preferred_countries = Object.entries(countryCount)
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        // Средняя цена
        analysis.average_price = validPrices > 0 ? totalPrice / validPrices : 0;
        
        // Средний рейтинг
        analysis.average_rating = validRatings > 0 ? totalRating / validRatings : 0;
        
        // Если не было валидных цен, устанавливаем диапазон по умолчанию
        if (analysis.price_range.min === Infinity) {
            analysis.price_range.min = 0;
            analysis.price_range.max = 0;
        }
        
        return analysis;
    }

    calculateTasteSimilarity(wine, selectedWines, analysis) {
        let score = 0.3; // Базовый скор
        
        // Совпадение по сорту (40%)
        if (wine.variety && analysis.favorite_varieties.length > 0) {
            analysis.favorite_varieties.forEach((fav, index) => {
                if (wine.variety === fav.variety) {
                    score += 0.4 * (1 - index * 0.2);
                }
            });
        }
        
        // Совпадение по стране (30%)
        if (wine.country && analysis.preferred_countries.length > 0) {
            analysis.preferred_countries.forEach((pref, index) => {
                if (wine.country === pref.country) {
                    score += 0.3 * (1 - index * 0.2);
                }
            });
        }
        
        // Ценовая категория (20%)
        if (analysis.average_price > 0 && wine.price) {
            const priceDiff = Math.abs(wine.price - analysis.average_price) / analysis.average_price;
            score += (1 - Math.min(priceDiff, 1)) * 0.2;
        }
        
        // Рейтинг (10%)
        const wineRating = wine.points || wine.rating || 0;
        if (analysis.average_rating > 0 && wineRating > 0) {
            const ratingDiff = Math.abs(wineRating - analysis.average_rating) / 100;
            score += (1 - ratingDiff) * 0.1;
        }
        
        return Math.min(score, 1.0);
    }

    getAllWines() {
        return this.wines.map(wine => ({
            id: wine.id,
            name: wine.title || wine.name || `Вино ${wine.id}`,
            variety: wine.variety || 'Не указан',
            country: wine.country || 'Не указана',
            price: parseFloat(wine.price) || 0,
            rating: wine.points || wine.rating || 0,
            description: wine.description || '',
            region: wine.region_1 || wine.region || '',
            winery: wine.winery || wine.producer || '',
            title: wine.title || wine.name || `Вино ${wine.id}`
        }));
    }

    getWineById(id) {
        return this.wines.find(wine => wine.id == id);
    }
}
