// wine-recommender.js
class WineRecommender {
    constructor(wineData, embeddings = null) {
        this.wines = wineData;
        this.embeddings = embeddings;
        this.useEmbeddings = embeddings !== null;
        this.initFilters();
        
        if (this.useEmbeddings) {
            console.log(`✅ Загружено ${embeddings.length} эмбеддингов`);
        } else {
            console.log("⚠️ Работаем в текстовом режиме (эмбеддинги не загружены)");
        }
    }

    initFilters() {
        this.countries = [...new Set(this.wines.map(wine => wine.country).filter(Boolean))].sort();
        this.varieties = [...new Set(this.wines.map(wine => wine.variety).filter(Boolean))].sort();
        
        const prices = this.wines.map(wine => wine.price).filter(p => p > 0);
        this.priceRange = {
            min: prices.length > 0 ? Math.min(...prices) : 0,
            max: prices.length > 0 ? Math.max(...prices) : 100
        };
    }

    async searchByQuery(query, filters = {}, limit = 20) {
        if (this.useEmbeddings && this.embeddings) {
            return this.semanticSearch(query, filters, limit);
        } else {
            return this.textSearch(query, filters, limit);
        }
    }

    semanticSearch(query, filters, limit) {
        try {
            // Упрощенный семантический поиск (без модели в браузере)
            // Используем предзагруженные эмбеддинги с упрощенным сравнением
            
            const searchTerms = query.toLowerCase().split(' ');
            const results = [];
            
            for (let i = 0; i < Math.min(this.wines.length, 500); i++) {
                const wine = this.wines[i];
                
                // Применяем фильтры
                if (filters.variety && wine.variety !== filters.variety) continue;
                if (filters.country && wine.country !== filters.country) continue;
                if (filters.max_price && wine.price > filters.max_price) continue;
                
                // Считаем текстовое сходство (так как эмбеддинги запроса нет)
                const similarity = this.calculateTextSimilarity(wine, searchTerms);
                
                if (similarity > 0.1) { // Минимальный порог
                    results.push({
                        ...wine,
                        similarity_score: similarity
                    });
                }
                
                if (results.length >= limit * 2) break;
            }
            
            // Сортируем по схожести
            results.sort((a, b) => b.similarity_score - a.similarity_score);
            
            return results.slice(0, limit);
            
        } catch (error) {
            console.error("Ошибка семантического поиска:", error);
            return this.textSearch(query, filters, limit);
        }
    }

    calculateTextSimilarity(wine, searchTerms) {
        let score = 0;
        
        // Создаем текстовое описание вина для поиска
        const wineText = `
            ${wine.title || ''}
            ${wine.variety || ''}
            ${wine.country || ''}
            ${wine.description || ''}
            ${wine.flavor_profile || ''}
            ${wine.aroma || ''}
        `.toLowerCase();
        
        // Проверяем каждый термин
        let matches = 0;
        searchTerms.forEach(term => {
            if (term.length > 2 && wineText.includes(term)) {
                matches++;
                // Бонус за точное совпадение в названии
                if (wine.title && wine.title.toLowerCase().includes(term)) {
                    score += 0.3;
                } else if (wine.variety && wine.variety.toLowerCase().includes(term)) {
                    score += 0.2;
                } else {
                    score += 0.1;
                }
            }
        });
        
        // Нормализуем скор
        if (searchTerms.length > 0) {
            score = Math.min(score, 1.0);
        }
        
        return score;
    }

    textSearch(query, filters, limit) {
        const searchTerms = query.toLowerCase().split(' ');
        
        const results = this.wines
            .filter(wine => {
                if (filters.variety && wine.variety !== filters.variety) return false;
                if (filters.country && wine.country !== filters.country) return false;
                if (filters.max_price && wine.price > filters.max_price) return false;
                
                if (!query) return true;
                
                const wineText = `
                    ${wine.title || ''}
                    ${wine.variety || ''}
                    ${wine.country || ''}
                    ${wine.description || ''}
                `.toLowerCase();
                
                return searchTerms.some(term => 
                    term.length > 2 && wineText.includes(term)
                );
            })
            .slice(0, limit * 2)
            .map(wine => ({
                ...wine,
                similarity_score: this.calculateAdvancedSimilarity(wine, query, filters)
            }))
            .sort((a, b) => b.similarity_score - a.similarity_score)
            .slice(0, limit);
        
        return results;
    }

    calculateAdvancedSimilarity(wine, query, filters) {
        let score = 0.3; // Базовый скор
        
        // Совпадение с фильтрами
        if (filters.variety && wine.variety === filters.variety) score += 0.2;
        if (filters.country && wine.country === filters.country) score += 0.15;
        if (filters.max_price && wine.price <= filters.max_price) score += 0.1;
        
        // Совпадение с запросом
        if (query) {
            const searchTerms = query.toLowerCase().split(' ');
            const wineText = `
                ${wine.title || ''}
                ${wine.variety || ''}
                ${wine.description || ''}
                ${wine.flavor_profile || ''}
            `.toLowerCase();
            
            let keywordMatches = 0;
            searchTerms.forEach(term => {
                if (term.length > 2 && wineText.includes(term)) {
                    keywordMatches++;
                    // Бонус за важные термины
                    if (['красное', 'красное', 'red', 'белое', 'white', 'розовое', 'rose'].includes(term)) {
                        score += 0.15;
                    } else if (term.length > 4) {
                        score += 0.1;
                    }
                }
            });
            
            if (searchTerms.length > 0) {
                score += (keywordMatches / searchTerms.length) * 0.25;
            }
        }
        
        // Бонус за высокий рейтинг
        if (wine.points && wine.points > 90) score += 0.05;
        
        return Math.min(score, 1.0);
    }

    getTasteRecommendations(selectedWineIds, limit = 10) {
        const selectedWines = this.wines.filter(wine => selectedWineIds.includes(wine.id));
        
        if (selectedWines.length === 0) {
            return { recommendations: [], preference_analysis: {} };
        }
        
        const preferenceAnalysis = this.analyzePreferences(selectedWines);
        
        const recommendations = this.wines
            .filter(wine => !selectedWineIds.includes(wine.id))
            .map(wine => ({
                ...wine,
                similarity_score: this.calculateTasteSimilarity(wine, selectedWines, preferenceAnalysis)
            }))
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
        selectedWines.forEach(wine => {
            if (wine.variety) {
                varietyCount[wine.variety] = (varietyCount[wine.variety] || 0) + 1;
            }
        });
        
        analysis.favorite_varieties = Object.entries(varietyCount)
            .map(([variety, count]) => ({ variety, count }))
            .sort((a, b) => b.count - a.count);
        
        const countryCount = {};
        selectedWines.forEach(wine => {
            if (wine.country) {
                countryCount[wine.country] = (countryCount[wine.country] || 0) + 1;
            }
        });
        
        analysis.preferred_countries = Object.entries(countryCount)
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => b.count - a.count);
        
        const prices = selectedWines.map(w => w.price).filter(p => p > 0);
        analysis.average_price = prices.length > 0 ? 
            prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        
        const ratings = selectedWines.map(w => w.points || 0).filter(r => r > 0);
        analysis.average_rating = ratings.length > 0 ? 
            ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        
        if (prices.length > 0) {
            analysis.price_range.min = Math.min(...prices);
            analysis.price_range.max = Math.max(...prices);
        }
        
        return analysis;
    }

    calculateTasteSimilarity(wine, selectedWines, analysis) {
        let score = 0.4;
        
        // Совпадение по сорту
        if (wine.variety && analysis.favorite_varieties.length > 0) {
            const favoriteVariety = analysis.favorite_varieties[0];
            if (wine.variety === favoriteVariety.variety) {
                score += 0.25;
            } else {
                // Проверяем все любимые сорта
                analysis.favorite_varieties.forEach((fav, index) => {
                    if (wine.variety === fav.variety) {
                        score += 0.2 * (1 - index * 0.1); // Уменьшаем вес для менее популярных
                    }
                });
            }
        }
        
        // Совпадение по стране
        if (wine.country && analysis.preferred_countries.length > 0) {
            analysis.preferred_countries.forEach((pref, index) => {
                if (wine.country === pref.country) {
                    score += 0.15 * (1 - index * 0.2);
                }
            });
        }
        
        // Ценовая категория
        if (analysis.average_price > 0) {
            const priceDiff = Math.abs(wine.price - analysis.average_price) / analysis.average_price;
            score += (1 - priceDiff) * 0.2;
        }
        
        // Рейтинг
        if (analysis.average_rating > 0 && wine.points) {
            const ratingDiff = Math.abs(wine.points - analysis.average_rating) / 100;
            score += (1 - ratingDiff) * 0.1;
        }
        
        return Math.min(score, 1.0);
    }

    getAllWines() {
        return this.wines.map(wine => ({
            id: wine.id,
            name: wine.title || 'Без названия',
            variety: wine.variety || 'Не указан',
            country: wine.country || 'Не указана',
            price: wine.price || 0,
            rating: wine.points || 0,
            description: wine.description || '',
            region: wine.region_1 || '',
            winery: wine.winery || ''
        }));
    }

    getWineById(id) {
        return this.wines.find(wine => wine.id == id);
    }
}
