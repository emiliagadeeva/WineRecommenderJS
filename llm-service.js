// llm-service.js
class LLMService {
    constructor() {
        this.initialized = false;
    }

    initialize() {
        console.log("🤖 Инициализация LLM сервиса...");
        
        // Так как GitHub Pages не поддерживает серверные LLM,
        // будем использовать локальную симуляцию
        this.initialized = true;
        console.log("✅ LLM сервис инициализирован (симуляция)");
    }

    async generateFilterComment(query, filters, resultCount) {
        await this.delay(500);
        
        const varietyText = filters?.variety ? `сорта ${filters.variety}` : "";
        const countryText = filters?.country ? `из ${filters.country}` : "";
        const priceText = filters?.max_price ? `до $${filters.max_price}` : "";
        
        const filterText = [varietyText, countryText, priceText].filter(t => t).join(", ");
        
        return `На основе вашего запроса "${query}" ${filterText ? `с фильтрами: ${filterText}` : ""} найдено ${resultCount} вариантов. Рекомендую обратить внимание на вина с высокой оценкой схожести.`;
    }

    async generateTasteComment(selectedWines, recommendations) {
        await this.delay(600);
        
        const wineNames = selectedWines.slice(0, 3).map(w => w.title || w.variety).join(", ");
        const varietyCount = [...new Set(selectedWines.map(w => w.variety).filter(Boolean))].length;
        
        return `Проанализировав ваши предпочтения (${wineNames}), я заметил, что вам нравятся ${varietyCount > 1 ? 'разные сорта вин' : 'определенный сорт вин'}. Рекомендую следующие варианты, которые соответствуют вашему вкусу.`;
    }

    async generateSimpleComment(query, recommendations) {
        await this.delay(400);
        
        return `По вашему запросу "${query}" я подобрал ${recommendations.length} отличных вариантов. Эти вина идеально соответствуют вашему описанию и имеют высокие оценки.`;
    }

    async generateWineDescription(wine) {
        await this.delay(700);
        
        const points = wine.points || 0;
        const price = wine.price || 0;
        const variety = wine.variety || 'это вино';
        const country = wine.country || '';
        
        let description = `${wine.title || variety} ${country ? `из ${country}` : ''} — `;
        
        if (points >= 95) description += 'исключительное вино с высочайшими оценками. ';
        else if (points >= 90) description += 'отличное вино с высокими оценками. ';
        else if (points >= 85) description += 'хорошее вино достойного качества. ';
        else description += 'интересный вариант для знакомства. ';
        
        if (price > 100) description += 'Премиальный выбор для особых случаев.';
        else if (price > 50) description += 'Качественный вариант для ужина.';
        else if (price > 20) description += 'Отличное соотношение цены и качества.';
        else description += 'Доступный вариант для повседневного употребления.';
        
        if (wine.description && wine.description.length > 20) {
            description += ` Описание: ${wine.description.substring(0, 150)}...`;
        }
        
        return description;
    }

    async generatePairingRecommendation(wine) {
        await this.delay(500);
        
        const variety = wine.variety || '';
        const type = this.getWineType(variety);
        
        switch(type) {
            case 'red':
                return 'Идеально сочетается с красным мясом, стейками, пастой с томатным соусом, твердыми сырами и темным шоколадом.';
            case 'white':
                return 'Прекрасно подходит к морепродуктам, рыбе, белым мясом, салатам, мягким сырам и легким закускам.';
            case 'sparkling':
                return 'Отличный выбор для аперитива, сочетается с устрицами, фруктами, легкими десертами и праздничными блюдами.';
            default:
                return 'Универсальное вино, которое хорошо сочетается с различными блюдами, от пасты до сырных тарелок.';
        }
    }

    async generateOccasionRecommendation(wine) {
        await this.delay(400);
        
        const price = wine.price || 0;
        const points = wine.points || 0;
        
        if (price > 80 || points >= 95) {
            return 'Идеально для особых случаев: годовщины, праздники, важные ужины или в качестве премиального подарка.';
        } else if (price > 40) {
            return 'Отличный выбор для ужина в ресторане, свидания, встречи с друзьями или семейного праздника.';
        } else {
            return 'Подходит для повседневного употребления, пикников, барбекю, просмотра фильмов или неформальных встреч.';
        }
    }

    getWineType(variety) {
        if (!variety) return 'unknown';
        
        const redVarieties = ['cabernet', 'merlot', 'pinot noir', 'syrah', 'malbec', 'zinfandel', 'sangiovese', 'tempranillo', 'red blend'];
        const whiteVarieties = ['chardonnay', 'sauvignon', 'riesling', 'pinot gris', 'pinot grigio', 'white blend'];
        const sparklingVarieties = ['champagne', 'prosecco', 'sparkling', 'brut'];
        
        const lowerVariety = variety.toLowerCase();
        
        if (redVarieties.some(v => lowerVariety.includes(v))) return 'red';
        if (whiteVarieties.some(v => lowerVariety.includes(v))) return 'white';
        if (sparklingVarieties.some(v => lowerVariety.includes(v))) return 'sparkling';
        
        return 'unknown';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Создаем глобальный экземпляр
window.llmService = new LLMService();
