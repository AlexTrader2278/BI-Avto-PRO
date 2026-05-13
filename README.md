# 🚗 BI-Avto-PRO

**AI-сервис прогноза слабых мест автомобиля до поломки — на основе обсуждений с автофорумов.**

Введи марку/модель/год/пробег — получи топ-5 типичных проблем актуальных именно для твоего пробега, с вероятностью, причиной, решением и реальными ссылками на форумы где это обсуждают.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8)
![Vercel](https://img.shields.io/badge/Vercel-deployed-000)

## 🎯 Возможности

- **🔍 VIN-декодер** — Год определяется детерминированно по 10-му символу VIN (без AI, ошибки невозможны). Марка — по WMI-таблице на ~80 производителей: Россия, Корея, Япония, Германия, Франция, Италия, Китай, США. Модель — через AI с проверкой соответствия WMI.
- **📊 AI-анализ проблем** — Двухшаговая схема: Perplexity Sonar ищет реальные обсуждения на Drom.ru, Drive2.ru, Reddit → GPT-4o-mini структурирует в гарантированный JSON.
- **🎯 Привязка к пробегу** — AI учитывает текущий пробег и показывает только актуальные проблемы (не «уже пройденные»).
- **🚦 Светофорная визуализация** — Каждая проблема: критично (красный) / внимание (жёлтый) / плановое (зелёный) + сводка рисков.
- **💬 AI-чат по авто** — Защищён от jailbreak и off-topic, отвечает только по конкретной машине.
- **🔗 Реальные источники** — Каждый анализ сопровождается кликабельными ссылками на форумные обсуждения (citations от Perplexity).
- **⚡ Кэш + Rate Limit** — Повторные запросы не жгут токены, защита от флуда по IP.
- **🎨 Neumorphism UI** — Современный мобильно-дружелюбный дизайн.

## 🛠️ Технологический стек

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Lucide icons
- **AI:** OpenRouter (proxy для Perplexity Sonar + OpenAI GPT-4o-mini)
- **Hosting:** Vercel
- **Analytics:** Vercel Analytics
- **Security:** CSP-заголовки, защита от clickjacking, HSTS, rate limiting

## 📦 Установка локально

### Требования

- Node.js 18+
- API-ключ OpenRouter ([openrouter.ai](https://openrouter.ai))

### Запуск

```bash
git clone https://github.com/AlexTrader2278/BI-Avto-PRO.git
cd BI-Avto-PRO
npm install
```

Создай `.env.local`:

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

Запусти:

```bash
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000).

### Сборка продакшена

```bash
npm run build
npm start
```

## 🚀 Деплой на Vercel

1. Импортируй репозиторий в [Vercel](https://vercel.com/new).
2. Добавь переменную окружения `OPENROUTER_API_KEY` (Settings → Environment Variables).
3. Deploy.

Vercel автоматически передеплоит на каждый push в `main`.

## 🏗️ Структура проекта

```
BI-Avto-PRO/
├── app/
│   ├── page.tsx               # Главная: форма + анализ + чат
│   ├── layout.tsx             # Корневой layout + Vercel Analytics
│   ├── globals.css            # Стили neumorphism
│   └── api/
│       ├── analyze/route.ts   # Анализ: Perplexity + GPT-4o-mini
│       ├── chat-ai/route.ts   # Чат с ограничениями (только авто)
│       └── vin/route.ts       # VIN-декодер (WMI + AI)
├── lib/
│   ├── ai.ts                  # Клиент API (frontend)
│   ├── cache.ts               # In-memory кэш анализов
│   ├── ratelimit.ts           # Rate limiting по IP
│   ├── vinDecoder.ts          # WMI-таблица + декодер года
│   └── types.ts               # TypeScript типы
├── next.config.js             # + security headers
├── package.json
└── tsconfig.json
```

## 🔧 Как это работает

### Анализ авто (`/api/analyze`)

1. **Кэш-чек** — если такой же запрос (марка+модель+год+пробег) был — возвращаем мгновенно.
2. **Шаг 1: Perplexity Sonar** ищет на Drom.ru, Drive2.ru, Reddit обсуждения проблем для пробега ≥ заданного. Возвращает текст + список citations (URL).
3. **Шаг 2: GPT-4o-mini** структурирует найденное в JSON: 5 проблем с вероятностью, причиной, решением, severity. Использует `response_format: json_object` для гарантии валидного JSON.
4. **Валидация и нормализация:** обрезаем citation-маркеры из текста, ограничиваем вероятность 1–95%, приводим severity к одному из 3 значений.

### VIN-декодер (`/api/vin`)

1. **Валидация формата** — 17 символов, без I/O/Q.
2. **Год** — позиция 10 VIN по таблице SAE J775. Выбираем самый свежий год не из будущего (`A` может быть 1980 или 2010 — берём 2010+1, если он ≤ текущему+1).
3. **WMI (первые 3 символа)** — поиск в локальной таблице ~80 производителей. Если найден — известна страна и список ожидаемых марок.
4. **Модель** — Perplexity sonar с подсказкой `WMI + год + ожидаемые марки`. Если AI вернул марку не из списка WMI — игнорируем её, оставляем марку из таблицы.
5. **Честность** — если AI не уверен в модели, возвращает пустую строку. Фронт показывает жёлтую плашку «введите модель вручную» — лучше пустое поле, чем неверная модель.

### Защита AI-чата (`/api/chat-ai`)

System-prompt запрещает отвечать на нонавтомобильные темы, реагировать на «забудь все инструкции», переключаться на другие роли. Любой off-topic → вежливый отказ.

## 🐛 Решение проблем

**«API не отвечает» / 401-402 ошибки** — проверь `OPENROUTER_API_KEY`, баланс OpenRouter, доступ к моделям `perplexity/sonar` и `openai/gpt-4o-mini`.

**Источники пустые в анализе** — Perplexity не вернул citations. В логах Vercel будет видно (логируется `[analyze] Perplexity citations field`).

**VIN не определился** — добавь WMI (первые 3 символа) в `lib/vinDecoder.ts` → таблица `WMI_TABLE`.

**Rate limit (429)** — слишком много запросов с одного IP. Параметры в `lib/ratelimit.ts`.

## 📝 Лицензия

Все права защищены. Использование без письменного разрешения автора запрещено.

## 📧 Контакты

GitHub Issues — для багов и предложений.

---

**Сделано для тех, кто хочет знать слабые места авто до того как они проявятся.**
