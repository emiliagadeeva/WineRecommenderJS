// llm-service.js
class LLMService {
    constructor() {
        this.engine = null;
        this.initialized = false;
        this.initPromise = null;
        this.modelLoaded = false;
        
        // Настройки модели (используем маленькую модель для браузера)
        this.modelConfig = {
            model: "TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC",
            modelLib: "/models/TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC-webgpu.wasm", // или URL к модели
            temperature: 0.7,
            maxGenLength: 300
        };
    }

    async initialize() {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = (async () => {
            try {
                console.log("🔄 Инициализация LLM в браузере...");
                
                // Инициализируем движок WebLLM
                this.engine = await window.webllm.CreateWebWorkerEngine(
                    new Worker("/workers/llm-worker.js"), // Создаем воркер
                    this.modelConfig
                );
                
                // Альтернатива: напрямую без воркера
                if (!window.webllm) {
                    console.error("WebLLM не загружен!");
                    return false;
                }
                
                // Инициализируем движок
                const initProgressCallback = (report) => {
                    console.log(`Загрузка модели: ${Math.floor(report.progress * 100)}%`);
                };
                
                this.engine = await window.webllm.CreateMLCEngine(
                    this.modelConfig.model,
                    { initProgressCallback }
                );
                
                this.initialized = true;
                this.modelLoaded = true;
                console.log("✅ LLM инициализирован в браузере!");
                return true;
                
            } catch (error) {
                console.error("Ошибка инициализации LLM:", error);
                // Fallback на шаблонные ответы
                this.initialized = false;
                return false;
            }
        })();
        
        return this.initPromise;
    }

    async generateComment(promptType, context) {
        // Если LLM не загружен, используем шаблоны
        if (!this.initialized || !this.modelLoaded) {
            return this.generateTemplateComment(promptType, context);
        }

        try {
            const prompt = this.buildPrompt(promptType, context);
            
            console.log("🤖 Генерируем LLM комментарий...");
            
            const response = await this.engine.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(promptType)
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            });
            
            const comment = response.choices[0].message.content;
            console.log("✅ LLM комментарий сгенерирован");
            return comment;
            
        } catch (error) {
            console.error("Ошибка генерации LLM:", error);
            return this.generateTemplateComment(promptType, context);
        }
    }

    buildPrompt(promptType, context) {
        switch(promptType) {
            case 'filtered':
                return this.buildFilteredPrompt(context);
            case 'taste':
                return this.buildTastePrompt(context);
            case 'simple':
                return this.buildSimplePrompt(context);
            case 'wine_details':
                return this.buildWineDetailsPrompt(context);
            case 'pairing':
                return this.buildPairingPrompt(context);
            default:
                return this.buildSimplePrompt(context);
        }
    }

    buildFilteredPrompt(context) {
        const { query, wine, filters, similarity_score } = context;
        
        return `Ты опытный сомелье. Объясни почему это вино подходит под запрос пользователя.

Запрос пользователя: "${query}"

Фильтры:
- Тип вина: ${filters.variety || 'любой'}
- Страна: ${filters.country || 'любая'} 
- Макс цена: $${filters.max_price || 'не ограничена'}

Информация о вине:
- Название: ${wine.title || 'Не указано'}
- Сорт: ${wine.variety || 'Не указан'}
- Страна: ${wine.country || 'Не указана'}
- Регион: ${wine.region_1 || 'Не указан'}
- Винодельня: ${wine.winery || 'Не указана'}
- Цена: $${wine.price || 'Не указана'}
- Рейтинг: ${wine.points || 'Не указан'}/100
- Схожесть с запросом: ${(similarity_score * 100).toFixed(1)}%

Описание: ${wine.description || 'Описание отсутствует'}

Объяснение (2-3 предложения на русском, в дружеском тоне):`;
    }

    buildTastePrompt(context) {
        const { recommendations, preference_analysis, selected_wines } = context;
        
        const selectedNames = selected_wines.map(w => w.name || w.title).join(', ');
        const topRecommendation = recommendations[0];
        
        return `Ты AI-сомелье. Проанализируй предпочтения пользователя и объясни почему эти рекомендации подходят.

Выбранные пользователем вина: ${selectedNames}

Анализ предпочтений:
- Любимые сорта: ${preference_analysis.favorite_varieties?.map(v => v.variety).join(', ') || 'разные'}
- Предпочитаемые страны: ${preference_analysis.preferred_countries?.map(c => c.country).join(', ') || 'разные'}
- Средняя цена: $${preference_analysis.average_price?.toFixed(2) || 'N/A'}
- Средний рейтинг: ${preference_analysis.average_rating?.toFixed(1) || 'N/A'}/100

Топ рекомендация:
- Название: ${topRecommendation.title}
- Сорт: ${topRecommendation.variety}
- Страна: ${topRecommendation.country}
- Цена: $${topRecommendation.price}
- Рейтинг: ${topRecommendation.points || 'N/A'}/100

Объясни на русском почему именно эта рекомендация идеально подходит под вкусы пользователя (2-3 предложения):`;
    }

    buildWineDetailsPrompt(context) {
        const { wine } = context;
        
        return `Ты эксперт по вину. Дай краткую, но информативную характеристику этого вина.

Название: ${wine.title || 'Без названия'}
Сорт: ${wine.variety || 'Не указан'}
Страна: ${wine.country || 'Не указана'}
Регион: ${wine.region_1 || wine.province || 'Не указан'}
Винодельня: ${wine.winery || 'Не указана'}
Цена: $${wine.price || 'Не указана'}
Рейтинг: ${wine.points || '0'}/100

Описание: ${wine.description || 'Описание отсутствует'}

Характеристики:
- Профиль вкуса: ${wine.flavor_profile || 'Не указан'}
- Аромат: ${wine.aroma || 'Не указан'}
- Сладость: ${wine.sweetness || 'Не указана'}
- Тело: ${wine.body || 'Не указано'}
- Танины: ${wine.tannins || 'Не указаны'}
- Кислотность: ${wine.acidity || 'Не указана'}

Дайте экспертную оценку этого вина на русском (3-4 предложения):`;
    }

    buildPairingPrompt(context) {
        const { wine } = context;
        
        return `Ты шеф-сомелье. Посоветуй с чем сочетать это вино.

Название: ${wine.title}
Тип: ${wine.variety}
Характеристики: ${wine.body || 'среднее тело'} тело, ${wine.tannins || 'умеренные'} танины, ${wine.acidity || 'средняя'} кислотность
Вкусовой профиль: ${wine.flavor_profile || 'фруктовый'}
Аромат: ${wine.aroma || 'ягодный'}

Дайте рекомендации по сочетанию с едой (3-4 конкретных блюда) на русском:`;
    }

    getSystemPrompt(promptType) {
        const basePrompt = "Ты опытный сомелье и AI-ассистент по винам. Отвечай на русском языке, будь дружелюбным и информативным. Используй эмоджи для выразительности.";
        
        const typePrompts = {
            'filtered': `${basePrompt} Объясняй почему вино подходит под запрос.`,
            'taste': `${basePrompt} Анализируй предпочтения пользователя и давай персонализированные рекомендации.`,
            'simple': `${basePrompt} Помогай пользователю найти идеальное вино.`,
            'wine_details': `${basePrompt} Дай экспертную характеристику вина.`,
            'pairing': `${basePrompt} Дай конкретные рекомендации по сочетанию с едой.`
        };
        
        return typePrompts[promptType] || basePrompt;
    }

    // Fallback шаблоны если LLM не работает
    generateTemplateComment(promptType, context) {
        console.log("⚠️ Используем шаблонный комментарий");
        
        const templates = {
            'filtered': () => {
                const { wine, query } = context;
                return `🍷 Отличный выбор! "${wine.title}" идеально подходит под ваш запрос "${query}". Это ${wine.variety} из ${wine.country} обладает насыщенным вкусом и хорошо сочетается с красным мясом.`;
            },
            'taste': () => {
                const { recommendations, preference_analysis } = context;
                const topWine = recommendations[0];
                return `🤖 На основе ваших предпочтений я подобрал идеальное вино! "${topWine.title}" соответствует вашим вкусам: это ${topWine.variety} в любимом ценовом диапазоне.`;
            },
            'simple': () => {
                const { query, wine } = context;
                return `✨ Для "${query}" рекомендую "${wine.title}"! Это прекрасное ${wine.variety} за $${wine.price} порадует вас сбалансированным вкусом.`;
            },
            'wine_details': () => {
                const { wine } = context;
                return `🎯 Это ${wine.variety || 'вино'} из ${wine.country || 'известного региона'}. Обладает ${wine.body || 'средним'} телом и ${wine.aroma || 'приятным ароматом'}. Идеально для особых случаев.`;
            },
            'pairing': () => {
                const { wine } = context;
                const pairings = wine.variety?.toLowerCase().includes('red') 
                    ? ["стейк из говядины 🥩", "выдержанные сыры 🧀", "грибы 🍄", "паста болоньезе 🍝"]
                    : ["морепродукты 🦐", "куриное филе 🍗", "легкие салаты 🥗", "козий сыр 🧀"];
                return `🍽️ Идеально сочетается с: ${pairings.slice(0, 3).join(', ')}. Подавайте при ${wine.variety?.toLowerCase().includes('red') ? '16-18°C' : '8-12°C'}.`;
            }
        };
        
        const template = templates[promptType] || templates.simple;
        return template();
    }

    // Метод для быстрой инициализации с задержкой
    async initializeLazy() {
        if (!this.initialized) {
            // Инициализируем в фоне, не блокируя UI
            setTimeout(() => {
                this.initialize().catch(console.error);
            }, 3000); // Ждем 3 секунды перед инициализацией
        }
    }
}

// Создаем глобальный экземпляр
window.llmService = new LLMService();

// Начинаем ленивую инициализацию при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.llmService.initializeLazy();
});
