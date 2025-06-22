# Vercel Deployment Guide

## Подготовка за deployment

### 1. Премахване на локални файлове

Преди да push-нете в GitHub, премахнете следните файлове:

```bash
# Премахнете тези файлове от git tracking
git rm --cached credentials.json
git rm --cached .env

# Добавете ги в .gitignore
echo "credentials.json" >> .gitignore
echo ".env" >> .gitignore
echo "test-export.js" >> .gitignore
echo "server/" >> .gitignore
```

### 2. Commit и push промените

```bash
git add .
git commit -m "Setup Vercel deployment with serverless functions"
git push origin main
```

## Настройка в Vercel

### 1. Свързване на проекта

1. Отидете на [vercel.com](https://vercel.com)
2. Логнете се и натиснете "New Project"
3. Изберете вашия GitHub repository
4. Натиснете "Deploy"

### 2. Environment Variables

След deployment-а, добавете environment variables в Vercel:

1. Отидете в проекта в Vercel Dashboard
2. Settings → Environment Variables
3. Добавете:

```
GOOGLE_APPLICATION_CREDENTIALS (optional)
```

### 3. Google Cloud Credentials (Optional)

За да работи OCR functionality-то с истински Google Cloud Vision API:

1. Създайте service account в Google Cloud Console
2. Download credentials като JSON
3. Copy съдържанието на JSON файла
4. В Vercel Environment Variables добавете:
   - Key: `GOOGLE_CLOUD_CREDENTIALS`
   - Value: Целия JSON като string

## Файлова структура за Vercel

```
your-project/
├── api/                    # Vercel Serverless Functions
│   ├── ocr.ts             # OCR API endpoint
│   └── export.ts          # Excel export endpoint
├── src/                   # React frontend
├── dist/                  # Build output (generated)
├── vercel.json           # Vercel configuration
└── package.json          # Dependencies
```

## Какво се случва при deployment

1. **Frontend Build**: Vite build-ва React app-а в `dist/` folder
2. **Serverless Functions**: Vercel автоматично deploy-ва `api/*.ts` файловете
3. **Routing**: `vercel.json` настройва routing между frontend и API

## API Endpoints след deployment

```
https://your-app.vercel.app/api/ocr     - OCR processing
https://your-app.vercel.app/api/export  - Excel export
https://your-app.vercel.app/           - Frontend app
```

## Troubleshooting

### Build грешки

Ако получите build грешки:

1. Проверете че `vite.config.ts` няма синтактични грешки
2. Уверете се че всички dependencies са в `package.json`
3. Проверете че няма import-и към `server/` folder във frontend кода

### API грешки

1. Проверете Vercel Function logs в Dashboard
2. Уверете се че environment variables са настроени правилно
3. За OCR: Без Google Cloud credentials, API-то ще използва mock data

### CORS проблеми

Vercel автоматично handling CORS за API routes, но ако имате проблеми:

1. Проверете че API calls са към същия domain
2. Уверете се че използвате relative paths (`/api/ocr` не `http://localhost:3001/api/ocr`)

## Development vs Production

### Local Development

```bash
npm run dev:full  # Frontend + Express server
```

### Production (Vercel)

- Frontend: Static files served от Vercel CDN
- Backend: Serverless functions в `api/` folder
- No Express server needed

## Monitoring

1. Vercel Dashboard показва:

   - Deployment status
   - Function invocations
   - Performance metrics
   - Error logs

2. За debugging, check Function logs в Vercel Dashboard

## Scaling

Vercel автоматично scale-ва:

- Static assets (frontend)
- Serverless functions (API)
- No server management needed

## Costs

- Free tier включва:
  - 100GB bandwidth
  - 100GB-hrs serverless function execution
  - Unlimited static deployments

Perfect за lab table scanner application! 🚀
