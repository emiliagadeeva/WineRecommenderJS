// llm-service.js
class LLMService {
    constructor() {
        // ⚠️ ВАШ OPENAI API KEY - замените на свой!
        this.apiKey = "sk-your-actual-openai-api-key-here";
        this.apiUrl = "https://api.openai.com/v1/chat/completions";
        this.useCache = true;
        this.cache = new Map();
        this.isInitialized = true;
        this.useLocalFallback = true; // Использовать локальные ответы если API не работает
    }

    async initialize() {
        console.log("🤖 Инициализация LLM Service...");
        
        // Проверяем доступность API
        try {
            // Простая проверка сети
            if (!navigator.onLine) {
                console.warn("⚠️ Нет подключения к интернету, используем локальные ответы");
                this.isInitialized = false;
                return false;
            }
            
            // Проверяем API ключ (базовая валидация)
            if (!this.apiKey || this.apiKey.includes('your-actual')) {
                console.warn("⚠️ API ключ не настроен, используем локальные ответы");
                this.isInitialized = false;
                return false;
            }
            
            console.log("✅ LLM Service готов (используем OpenAI API)");
            return true;
            
        } catch (error) {
            console.error("❌ Ошибка инициализации LLM:", error);
            this.isInitialized = false;
            return false;
        }
    }

    async generateComment(promptType, context) {
        try {
            // Проверяем кэш
            const cacheKey = `${promptType}_${JSON.stringify(context).substring(0, 100)}`;
            
            if (this.useCache && this.cache.has(cacheKey)) {
                console.log("💾 Используем кэшированный ответ");
                return this.cache.get(cacheKey);
            }
            
            // Если API не инициализирован, используем локальные ответы
            if (!this.isInitialized) {
                console.log("⚠️ API не доступен, используем локальный ответ");
                return this.generateLocalComment(promptType, context);
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
                const errorText = await response.text();
                console.error(`❌ OpenAI API Error ${response.status}:`, errorText);
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            const comment = data.choices[0].message.content;
            
            if (this.useCache) {
                this.cache.set(cacheKey, comment);
            }
            
            console.log("✅ OpenAI ответ получен");
            return comment;
            
        } catch (error) {
            console.error("❌ Ошибка OpenAI API:", error);
            
            // Используем локальную генерацию как fallback
            if (this.useLocalFallback) {
                return this.generateLocalComment(promptType, context);
            }
            
            throw error;
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
        const topWine = recommendations[0] || {};
        
        return `Ты опытный сомелье. Объясни почему эти вина подходят под запрос пользователя.

Запрос пользователя: "${query}"

Фильтры:
- Тип вина: ${filters.variety || 'любой'}
- Страна: ${filters.country || 'любая'} 
- Макс цена: $${filters.max_price || 'не ограничена'}

Топ рекомендация:
- Название: ${topWine.title || topWine.name || 'Не указано'}
- Сорт: ${topWine.variety || 'Не указан'}
- Страна: ${topWine.country || 'Не указана'}
- Цена: $${topWine.price || 'Не указана'}
- Рейтинг: ${topWine.points || topWine.rating || 'Не указан'}/100

Описание: ${topWine.description || 'Описание отсутствует'}

Дай краткое, но информативное объяснение на русском языке (2-3 предложения), почему это вино идеально подходит под запрос пользователя. Будь дружелюбным и используй эмоджи для выразительности.`;
    }

    buildTastePrompt(context) {
        const { recommendations, preference_analysis, selected_wines } = context;
        const topWine = recommendations[0] || {};
        const selectedNames = selected_wines.map(w => w.title || w.name).join(', ');
        
        return `Ты AI-сомелье. Проанализируй предпочтения пользователя и объясни почему эти рекомендации подходят.

Пользователь выбрал эти вина: ${selectedNames}

Анализ предпочтений:
- Любимые сорта: ${preference_analysis.favorite_varieties?.map(v => `${v.variety} (${v.count}x)`).join(', ') || 'разные'}
- Предпочитаемые страны: ${preference_analysis.preferred_countries?.map(c => `${c.country} (${c.count}x)`).join(', ') || 'разные'}
- Средняя цена: $${preference_analysis.average_price?.toFixed(2) || 'N/A'}
- Средний рейтинг: ${preference_analysis.average_rating?.toFixed(1) || 'N/A'}/100

Лучшая рекомендация:
- Название: ${topWine.title || topWine.name}
- Сорт: ${topWine.variety}
- Страна: ${topWine.country}
- Цена: $${topWine.price}

Дай персональную рекомендацию на русском языке (2-3 предложения). Объясни, почему именно это вино идеально соответствует вкусам пользователя. Будь дружелюбным и используй эмоджи.`;
    }

    buildSimplePrompt(context) {
        const { query, recommendations } = context;
        const topWine = recommendations[0] || {};
        
        return `Ты помощник по выбору вина. Пользователь ищет: "${query}"

Найденные варианты (топ-1):
- Название: ${topWine.title || topWine.name}
- Сорт: ${topWine.variety}
- Страна: ${topWine.country}
- Цена: $${topWine.price}
- Рейтинг: ${topWine.points || topWine.rating || 'N/A'}/100

Описание: ${topWine.description || 'Описание отсутствует'}

Дай краткую рекомендацию на русском языке (2-3 предложения), почему это вино подходит под запрос. Будь убедительным и используй эмоджи.`;
    }

    buildWineDetailsPrompt(context) {
        const { wine } = context;
        
        return `Ты эксперт-сомелье. Дай экспертную характеристику этого вина.

Информация о вине:
- Название: ${wine.title || wine.name || 'Без названия'}
- Сорт: ${wine.variety || 'Не указан'}
- Страна происхождения: ${wine.country || 'Не указана'}
- Регион: ${wine.region_1 || wine.province || 'Не указан'}
- Винодельня: ${wine.winery || 'Не указана'}
- Цена: $${wine.price || 'Не указана'}
- Рейтинг: ${wine.points || wine.rating || 0}/100

Характеристики:
- Профиль вкуса: ${wine.flavor_profile || 'Не указан'}
- Аромат: ${wine.aroma || 'Не указан'}
- Тело: ${wine.body || 'Не указано'}
- Танины: ${wine.tannins || 'Не указаны'}
- Кислотность: ${wine.acidity || 'Не указана'}
- Сладость: ${wine.sweetness || 'Не указана'}

Описание: ${wine.description || 'Описание отсутствует'}

Дай развернутую экспертную оценку этого вина на русском языке (3-4 предложения). Опиши его характер, потенциал и лучшие случаи для употребления. Будь профессиональным но понятным.`;
    }

    buildPairingPrompt(context) {
        const { wine } = context;
        
        return `Ты шеф-сомелье. Посоветуй идеальные сочетания для этого вина.

Вино:
- Название: ${wine.title || wine.name}
- Сорт: ${wine.variety}
- Характеристики: ${wine.body || 'среднее'} тело, ${wine.tannins || 'умеренные'} танины
- Вкусовой профиль: ${wine.flavor_profile || 'фруктовый'}
- Ароматы: ${wine.aroma || 'ягодные ноты'}

Дай конкретные рекомендации по сочетанию с едой (3-4 конкретных блюда) на русском языке. Укажи также температуру подачи и возможные альтернативы.`;
    }

    buildOccasionPrompt(context) {
        const { wine } = context;
        
        return `Для какого случая идеально подходит это вино?

Вино: ${wine.title || wine.name} (${wine.variety})
Характеристики: ${wine.body || 'среднее'} тело, ${wine.flavor_profile || 'сбалансированный вкус'}
Цена: $${wine.price}
Рейтинг: ${wine.points || wine.rating}/100

Перечисли 3-4 подходящих случая для этого вина на русском языке. Будь конкретным и дай полезные советы.`;
    }

    getSystemPrompt(promptType) {
        const basePrompt = "Ты опытный сомелье и AI-ассистент по винам. Отвечай на русском языке, будь дружелюбным, информативным и профессиональным. Используй эмоджи для выразительности.";
        
        const typePrompts = {
            'filtered': `${basePrompt} Объясняй почему вино подходит под запрос пользователя.`,
            'taste': `${basePrompt} Анализируй предпочтения пользователя и давай персонализированные рекомендации.`,
            'simple': `${basePrompt} Помогай пользователю найти идеальное вино по описанию.`,
            'wine_details': `${basePrompt} Дай экспертную характеристику вина.`,
            'pairing': `${basePrompt} Дай конкретные рекомендации по сочетанию с едой.`,
            'occasion': `${basePrompt} Посоветуй лучшие случаи для употребления этого вина.`
        };
        
        return typePrompts[promptType] || basePrompt;
    }

    generateLocalComment(promptType, context) {
        console.log("⚠️ Используем локальный комментарий");
        
        const localGenerators = {
            'filtered': () => {
                const { query, recommendations } = context;
                const topWine = recommendations[0] || {};
                return `🍷 Отличный выбор! Вино "${topWine.title || topWine.name}" идеально подходит под ваш запрос "${query}". Это ${topWine.variety || 'вино'} из ${topWine.country || 'известного региона'} обладает насыщенным вкусом и хорошо сочетается с красным мясом. Рекомендую! ✨`;
            },
            'taste': () => {
                const { recommendations, preference_analysis } = context;
                const topWine = recommendations[0] || {};
                const favorite = preference_analysis.favorite_varieties?.[0]?.variety || 'подобным сортам';
                return `🎯 На основе ваших предпочтений я нашел идеальное соответствие! "${topWine.title || topWine.name}" — это ${topWine.variety || 'вино'}, который идеально подходит под ваш вкус к ${favorite}. Вино обладает прекрасным балансом и долгим послевкусием. 🍇`;
            },
            'simple': () => {
                const { query, recommendations } = context;
                const topWine = recommendations[0] || {};
                return `✨ Для "${query}" рекомендую "${topWine.title || topWine.name}"! Это прекрасное ${topWine.variety || 'вино'} за $${topWine.price || 'разумную цену'} порадует вас сбалансированным вкусом и ароматом. Идеальный выбор! 🥂`;
            },
            'wine_details': () => {
                const { wine } = context;
                const priceCategory = wine.price < 30 ? 'бюджетный' : wine.price < 100 ? 'средний' : 'премиум';
                return `📊 **Экспертная характеристика:**\n\n🍇 ${wine.variety || 'Вино'} из ${wine.country || 'известного региона'}\n💰 Ценовой сегмент: ${priceCategory}\n🎯 Особенности: ${wine.body || 'среднее'} тело, ${wine.aroma || 'приятный аромат'}\n✨ Идеально для: особых случаев и ужинов\n\nЭто вино обладает хорошим потенциалом и отлично подойдет как для начинающих, так и для опытных ценителей.`;
            },
            'pairing': () => {
                const { wine } = context;
                const isRed = wine.variety?.toLowerCase().includes('red') || 
                             wine.variety?.toLowerCase().includes('cabernet') ||
                             wine.variety?.toLowerCase().includes('merlot') ||
                             wine.variety?.toLowerCase().includes('pinot noir');
                
                const pairings = isRed 
                    ? ["🥩 Стейк рибай с розмарином", "🧀 Выдержанный пармезан", "🍝 Паста болоньезе", "🍄 Грибы на гриле"]
                    : ["🦐 Морепродукты с лимоном", "🍗 Куриное филе в сливочном соусе", "🥗 Свежие салаты", "🧀 Козий сыр с медом"];
                
                const temp = isRed ? '16-18°C' : '8-12°C';
                
                return `🍽️ **Идеальные сочетания:**\n\n${pairings.slice(0, 3).join('\n')}\n\n🌡️ Температура подачи: ${temp}\n⏱️ Подавайте через 15-30 минут после открытия`;
            },
            'occasion': () => {
                const { wine } = context;
                const isExpensive = wine.price > 100;
                const occasions = isExpensive 
                    ? ["🎉 Праздничный ужин", "💕 Романтический вечер", "🤝 Деловая встреча", "🎂 Особое событие"]
                    : ["🏠 Домашний ужин", "👨‍👩‍👧‍👦 Семейный обед", "🎬 Киновечер", "🌇 Встреча заката"];
                
                return `🎉 **Идеально для:**\n\n${occasions.map((occ, i) => `${i+1}. ${occ}`).join('\n')}\n\n✨ Это вино украсит любой момент и создаст нужное настроение!`;
            }
        };
        
        const generator = localGenerators[promptType] || localGenerators.simple;
        return generator();
    }

    // Алиас для обратной совместимости
    generateFallbackComment(promptType, context) {
        return this.generateLocalComment(promptType, context);
    }
}

// Создаем глобальный экземпляр
window.llmService = new LLMService();
