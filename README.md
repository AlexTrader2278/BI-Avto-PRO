# 🚗 BI-AVTO PRO

**Интеллектуальная система диагностики и рекомендаций по обслуживанию автомобилей с использованием AI**

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8)
![AI Powered](https://img.shields.io/badge/AI-Powered-ff6b6b)

## 🎯 Возможности

- **🔍 VIN Декодер** - Автоматическое определение марки, модели и года по VIN номеру
- **📊 AI Диагностика** - Глубокий анализ проблем автомобиля с использованием искусственного интеллекта
- **💡 Умные рекомендации** - Персонализированные рекомендации по обслуживанию и ремонту
- **📈 Прогнозная аналитика** - Оценка вероятности поломок и необходимости обслуживания
- **📁 Загрузка файлов** - Поддержка изображений и документов для более точной диагностики
- **💬 AI Чат** - Интерактивный помощник для ответов на вопросы
- **📊 Визуализация данных** - Mermaid диаграммы и графики для наглядного представления

## 🛠️ Технологический стек

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Lucide React Icons
- **Charts**: Recharts, Mermaid
- **AI Integration**: Google Gemini API / Anthropic Claude API
- **Deployment**: Vercel / GitHub Pages

## 📦 Установка и запуск

### Предварительные требования

- Node.js 18+ 
- npm или yarn
- API ключ от Google Gemini или Anthropic Claude

### 1. Клонирование репозитория

```bash
git clone https://github.com/AlexTrader2278/BI-Avto-PRO.git
cd BI-Avto-PRO
```

### 2. Установка зависимостей

```bash
npm install
# или
yarn install
```

### 3. Настройка переменных окружения

Создайте файл `.env.local` в корне проекта:

```env
# Выберите ОДИН из вариантов:

# Вариант A: Google Gemini API
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here

# Вариант B: Anthropic Claude API
NEXT_PUBLIC_ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

#### Как получить API ключ:

**Google Gemini:**
1. Перейдите на [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Создайте API ключ
3. Скопируйте ключ в `.env.local`

**Anthropic Claude:**
1. Зарегистрируйтесь на [Anthropic](https://console.anthropic.com/)
2. Создайте API ключ в консоли
3. Скопируйте ключ в `.env.local`

### 4. Выбор AI провайдера

По умолчанию используется **Google Gemini**. Чтобы использовать **Claude**, измените импорт в `app/page.tsx`:

```typescript
// Замените эту строку:
import { analyzeCar, lookupVin, chatWithAI } from '@/lib/ai';

// На эту:
import { analyzeCar, lookupVin, chatWithAI } from '@/lib/ai-claude';
```

### 5. Запуск в режиме разработки

```bash
npm run dev
# или
yarn dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

### 6. Сборка для продакшена

```bash
npm run build
npm start
```

## 🚀 Деплой на Vercel

### Быстрый деплой

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AlexTrader2278/BI-Avto-PRO)

### Ручной деплой

1. Зарегистрируйтесь на [Vercel](https://vercel.com)
2. Импортируйте репозиторий из GitHub
3. Добавьте переменные окружения:
   - `NEXT_PUBLIC_GEMINI_API_KEY` или
   - `NEXT_PUBLIC_ANTHROPIC_API_KEY`
4. Нажмите "Deploy"

## 📖 Использование

### 1. Ввод данных автомобиля

- **VIN номер** (опционально) - введите для автоматического заполнения
- **Марка** - название производителя (например, Toyota)
- **Модель** - модель автомобиля (например, Camry)
- **Год выпуска** (опционально)
- **Пробег** - текущий пробег в километрах
- **Описание проблемы** - подробное описание симптомов

### 2. Загрузка файлов

Прикрепите фотографии повреждений, диагностические отчеты или другие документы для более точного анализа.

### 3. Получение анализа

Нажмите кнопку "Анализировать" и получите:
- Детальный анализ проблем
- Рекомендации по обслуживанию
- Прогноз вероятности поломок
- Визуальные диаграммы плана работ

### 4. Использование чата

Задавайте дополнительные вопросы AI ассистенту о диагностике, стоимости ремонта или рекомендациях.

## 🏗️ Структура проекта

```
bi-avto-pro/
├── app/
│   ├── page.tsx          # Главная страница
│   ├── layout.tsx        # Layout приложения
│   └── globals.css       # Глобальные стили
├── components/
│   └── MermaidViewer.tsx # Компонент диаграмм
├── lib/
│   ├── ai.ts            # Gemini AI интеграция
│   ├── ai-claude.ts     # Claude AI интеграция
│   └── types.ts         # TypeScript типы
├── public/
├── .env.local           # Переменные окружения (не коммитится)
├── .env.example         # Пример конфигурации
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── vercel.json
```

## 🔧 Конфигурация

### Настройка AI моделей

В файлах `lib/ai.ts` и `lib/ai-claude.ts` можно изменить параметры моделей:

```typescript
// Gemini
const model = genAI.getGenerativeModel({ 
  model: "gemini-pro" // или "gemini-1.5-pro"
});

// Claude
model: "claude-sonnet-4-20250514" // или другие модели
```

### Настройка промптов

Промпты для AI находятся в функциях `analyzeCar()`, `lookupVin()` и `chatWithAI()`. Можете адаптировать их под свои нужды.

## 🐛 Решение проблем

### API не отвечает
- Проверьте правильность API ключа в `.env.local`
- Убедитесь, что у вас есть доступ к API (квоты, биллинг)
- Проверьте интернет соединение

### Mermaid диаграммы не отображаются
- Убедитесь, что в начале `MermaidViewer.tsx` есть `'use client'`
- Проверьте синтаксис Mermaid в ответе AI
- Откройте консоль браузера для диагностики ошибок

### TypeScript ошибки
- Запустите `npm install` для обновления зависимостей
- Проверьте версии пакетов в `package.json`
- Временно используйте `// @ts-ignore` для игнорирования ошибок

### Vercel деплой падает
- Проверьте наличие всех зависимостей в `package.json`
- Убедитесь, что переменные окружения добавлены в Vercel
- Проверьте логи сборки в Vercel Dashboard

## 📝 Лицензия

MIT License - используйте свободно для коммерческих и личных проектов.

## 🤝 Вклад в проект

Приветствуются pull requests! Для крупных изменений сначала откройте issue для обсуждения.

## 📧 Контакты

Создайте issue на GitHub для вопросов и предложений.

---

**Создано с ❤️ для автомобильной индустрии**