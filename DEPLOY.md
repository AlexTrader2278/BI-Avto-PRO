# 🚀 Руководство по деплою BI-AVTO PRO

## Варианты деплоя

### 1. Vercel (Рекомендуется) ⭐

**Преимущества:**
- Автоматический деплой при push в GitHub
- Бесплатный SSL сертификат
- CDN по всему миру
- Простая настройка переменных окружения
- Предпросмотр для каждого PR

**Шаги:**

1. **Подготовка репозитория**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Регистрация на Vercel**
   - Перейдите на [vercel.com](https://vercel.com)
   - Войдите через GitHub

3. **Импорт проекта**
   - Нажмите "Add New" → "Project"
   - Выберите репозиторий `BI-Avto-PRO`
   - Нажмите "Import"

4. **Настройка переменных окружения**
   
   В разделе "Environment Variables" добавьте:
   
   **Для Gemini:**
   ```
   Name: NEXT_PUBLIC_GEMINI_API_KEY
   Value: ваш_ключ_gemini
   Environment: Production, Preview, Development
   ```
   
   **Для Claude:**
   ```
   Name: NEXT_PUBLIC_ANTHROPIC_API_KEY
   Value: ваш_ключ_claude
   Environment: Production, Preview, Development
   ```

5. **Деплой**
   - Нажмите "Deploy"
   - Дождитесь завершения (обычно 2-3 минуты)
   - Получите ссылку вида `https://bi-avto-pro.vercel.app`

6. **Настройка домена (опционально)**
   - Settings → Domains
   - Добавьте свой домен
   - Настройте DNS записи

---

### 2. Netlify

**Преимущества:**
- Drag-and-drop деплой
- Бесплатный план
- Хорошая документация

**Шаги:**

1. **Сборка проекта**
   ```bash
   npm run build
   ```

2. **Создайте `netlify.toml`**
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"

   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```

3. **Деплой**
   - Зарегистрируйтесь на [netlify.com](https://netlify.com)
   - "Add new site" → "Import from Git"
   - Выберите репозиторий
   - Добавьте переменные окружения
   - Deploy

---

### 3. GitHub Pages (Статический экспорт)

**⚠️ Ограничения:**
- Не поддерживает серверные функции Next.js
- Требует статический экспорт
- API ключи будут видны в клиентском коде

**Не рекомендуется для продакшена из-за безопасности!**

**Шаги:**

1. **Настройте `next.config.js`**
   ```javascript
   module.exports = {
     output: 'export',
     images: {
       unoptimized: true,
     },
   };
   ```

2. **Добавьте скрипт в `package.json`**
   ```json
   "scripts": {
     "export": "next build && next export"
      }
   ```

3. **Создайте `.github/workflows/deploy.yml`**
   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [main]

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - uses: actions/setup-node@v2
           with:
             node-version: '18'
         - run: npm install
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./out
   ```

4. **Настройте GitHub Pages**
   - Settings → Pages
   - Source: Deploy from a branch
   - Branch: gh-pages

---

### 4. Railway

**Преимущества:**
- Простой деплой
- Поддержка баз данных
- $5/месяц бесплатно

**Шаги:**

1. Зарегистрируйтесь на [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub"
3. Выберите репозиторий
4. Добавьте переменные окружения
5. Deploy

---

### 5. DigitalOcean App Platform

**Преимущества:**
- Полный контроль
- Масштабируемость
- Интеграция с DO сервисами

**Шаги:**

1. Зарегистрируйтесь на [digitalocean.com](https://digitalocean.com)
2. "Apps" → "Create App"
3. Выберите GitHub репозиторий
4. Настройте:
   ```
   Build Command: npm run build
   Run Command: npm start
   Port: 3000
   ```
5. Добавьте переменные окружения
6. Deploy

---

## 🔒 Безопасность API ключей

### ❌ НЕ ДЕЛАЙТЕ:

- Не коммитьте `.env.local` в git
- Не храните ключи в коде
- Не используйте GitHub Pages для продакшена

### ✅ ДЕЛАЙТЕ:

- Используйте переменные окружения
- Храните ключи в Vercel/Netlify настройках
- Используйте разные ключи для dev/prod
- Регулярно ротируйте API ключи

---

## 📊 Мониторинг после деплоя

### Проверьте:

- ✅ Сайт открывается без ошибок
- ✅ VIN поиск работает
- ✅ Анализ возвращает данные
- ✅ Mermaid диаграммы отображаются
- ✅ Чат отвечает
- ✅ Загрузка файлов работает
- ✅ Мобильная версия корректна

### Инструменты мониторинга:

- **Vercel Analytics** - встроенная аналитика
- **Google Analytics** - для трекинга пользователей
- **Sentry** - для отслеживания ошибок
- **LogRocket** - для записи сессий

---

## 🔄 Обновление деплоя

### Vercel (автоматически):

```bash
git add .
git commit -m "Update feature"
git push origin main
# Vercel автоматически задеплоит изменения
```

### Manual redeploy:

```bash
# В Vercel Dashboard:
# Deployments → ... → Redeploy
```

---

## 🆘 Troubleshooting

### Ошибка: "Build failed"

**Решение:**
- Проверьте логи сборки
- Убедитесь, что все зависимости в `package.json`
- Запустите `npm run build` локально

### Ошибка: "Function execution timed out"

**Решение:**
- Оптимизируйте AI запросы
- Используйте меньшие модели
- Увеличьте timeout в настройках Vercel

### Ошибка: "Environment variable not found"

**Решение:**
- Проверьте написание переменных
- Убедитесь, что они добавлены для всех environment
- Сделайте redeploy после добавления переменных

---

## 📈 Оптимизация производительности

### 1. Edge Functions (Vercel)

```javascript
// app/api/analyze/route.ts
export const runtime = 'edge';
```

### 2. Кэширование

```javascript
export const revalidate = 3600; // 1 час
```

### 3. Сжатие изображений

```bash
npm install sharp
```

### 4. Lazy loading

```typescript
import dynamic from 'next/dynamic';

const MermaidViewer = dynamic(() => import('@/components/MermaidViewer'), {
  loading: () => <p>Loading...</p>,
});
```

---

**🎉 Готово! Ваше приложение задеплоено и готово к использованию!**