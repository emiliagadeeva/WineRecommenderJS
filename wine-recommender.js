// wine-recommender.js
class WineRecommender {
    constructor(wineData) {
        this.wines = wineData;
        this.initFilters();
    }

    initFilters() {
        // Получаем уникальные страны
        this.countries = [...new Set(this.wines.map(wine => wine.country).filter(Boolean))].sort();
        
        // Получаем уникальные сорта
        this.varieties = [...new Set(this.wines.map(wine => wine.variety).filter(Boolean))].sort();
        
        // Получаем диапазон цен
        const prices = this.wines.map(wine => wine.price).filter(p => p > 0);
        this.priceRange = {
            min: Math.min(...prices),
            max: Math.max(...prices)
        };
    }

    searchByQuery(query, filters = {}, limit = 20) {
        const searchTerms = query.toLowerCase().split(' ');
        
        return this.wines
            .filter(wine => {
                // Применяем фильтры
                if (filters.variety && wine.variety !== filters.variety) return false;
                if (filters.country && wine.country !== filters.country) return false;
                if (filters.max_price && wine.price > filters.max_price) return false;
                
                // Поиск по ключевым словам
                if (!query) return true;
                
                const searchString = `${wine.title || ''} ${wine.variety || ''} ${wine.description || ''} ${wine.country || ''} ${wine.flavor_profile || ''}`.toLowerCase();
                
                return searchTerms.some(term => searchString.includes(term));
            })
            .slice(0, limit)
            .map(wine => ({
                ...wine,
                similarity_score: this.calculateSimilarityScore(wine, query, filters)
            }))
            .sort((a, b) => b.similarity_score - a.similarity_score);
    }

    calculateSimilarityScore(wine, query, filters) {
        let score = 0.5;
        
        if (filters.variety && wine.variety === filters.variety) score += 0.2;
        if (filters.country && wine.country === filters.country) score += 0.2;
        if (filters.max_price && wine.price <= filters.max_price) score += 0.1;
        
        if (query) {
            const searchTerms = query.toLowerCase().split(' ');
            const wineText = `${wine.title || ''} ${wine.description || ''} ${wine.flavor_profile || ''}`.toLowerCase();
            
            let keywordMatches = 0;
            searchTerms.forEach(term => {
                if (wineText.includes(term)) keywordMatches++;
            });
            
            score += (keywordMatches / searchTerms.length) * 0.3;
        }
        
        return Math.min(score, 1.0);
    }

    getTasteRecommendations(selectedWineIds, limit = 10) {
        const selectedWines = this.wines.filter(wine => selectedWineIds.includes(wine.id));
        
        if (selectedWines.length === 0) return { recommendations: [], preference_analysis: {} };
        
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
        let score = 0.5;
        
        if (wine.variety) {
            const favoriteVariety = analysis.favorite_varieties[0];
            if (favoriteVariety && wine.variety === favoriteVariety.variety) {
                score += 0.2;
            }
        }
        
        if (wine.country) {
            const preferredCountry = analysis.preferred_countries[0];
            if (preferredCountry && wine.country === preferredCountry.country) {
                score += 0.15;
            }
        }
        
        if (analysis.average_price > 0) {
            const priceDiff = Math.abs(wine.price - analysis.average_price) / analysis.average_price;
            score += (1 - priceDiff) * 0.15;
        }
        
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
            description: wine.description || ''
        }));
    }
}
