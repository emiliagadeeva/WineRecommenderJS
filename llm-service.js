// llm-service.js
class LLMService {
    constructor() {
        // ⚠️ ВАШ OPENAI API KEY - замените на свой!
        this.apiKey = "sk-your-actual-openai-api-key-here";
        this.apiUrl = "https://api.openai.com/v1/chat/completions";
        this.useCache = true;
        this.cache = new Map();
        this.isInitialized = true; // Всегда true, так как используем API
    }

    async initialize() {
        console.log("✅ LLM Service ready (using OpenAI API)");
        return true;
    }

    async generateComment(promptType, context) {
        try {
            const cacheKey = `${promptType}_${JSON.stringify(context).substring(0, 100)}`;
            
            if (this.useCache && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }
            
            const prompt = this.buildPrompt(promptType, context);
            
            console.log("🤖 Запрос к OpenAI API...");
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
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
                    max_tokens: 300
                })
            });
            
            if (!response.ok) {
                throw new Error(`OpenAI API Error: ${response.status}`);
            }
            
            const data = await response.json();
            const comment = data.choices[0].message.content;
            
            if (this.useCache) {
                this.cache.set(cacheKey, comment);
            }
            
            console.log("✅ OpenAI ответ получен");
            return comment;
            
        } catch (error) {
            console.error("Ошибка OpenAI API:", error);
            return this.generateFallbackComment(promptType, context);
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
            case 'occasion':
                return this.buildOccasionPrompt(context);
            default:
                return this.buildSimplePrompt(context);
        }
    }

    buildFilteredPrompt(context) {
        const { query, recommendations, filters } = context;
        const topWine = recommendations[0];
        
        return `Ты опытный сомелье. Объясни почему эти вина подходят под запрос пользователя.

Запрос пользователя: "${query}"

Фильтры:
- Тип вина: ${filters.variety || 'любой'}
- Страна: ${filters.country || 'любая'} 
- Макс цена: $${filters.max_price || 'не ограничена'}

Топ рекомендация:
- Название: ${topWine.title || 'Не указано'}
- Сорт: ${topWine.variety || 'Не указан'}
- Страна: ${topWine.country || 'Не указана'}
- Цена: $${topWine.price || 'Не указана'}
- Рейтинг: ${topWine.points || 'Не указан'}/100
- Схожесть с запросом: ${(topWine.similarity_score * 100).toFixed(1)}%

Описание: ${topWine.description || 'Описание отсутствует'}

Дай краткое, но информативное объяснение на русском языке (2-3 предложения), почему это вино идеально подходит под запрос пользователя. Будь дружелюбным и используй э
