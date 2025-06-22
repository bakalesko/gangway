# API Setup Instructions

## Google Cloud Vision API Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Cloud Vision API** in the API Library

### 2. Create Service Account Credentials

1. Go to **IAM & Admin > Service Accounts**
2. Click **Create Service Account**
3. Fill in the details and click **Create and Continue**
4. Grant the role **Cloud Vision API User** (or Editor for broader access)
5. Click **Done**

### 3. Generate and Download Credentials

1. Click on the created service account
2. Go to the **Keys** tab
3. Click **Add Key > Create new key**
4. Choose **JSON** format
5. Download the file and rename it to `credentials.json`
6. Place it in the root folder of your project

### 4. Environment Setup

1. Copy `.env.example` to `.env`
2. Update the `GOOGLE_APPLICATION_CREDENTIALS` path if needed
3. Make sure `credentials.json` is in your `.gitignore` file

## Running the Application

### Development Mode

```bash
# Install dependencies (if not already done)
npm install

# Run both frontend and backend
npm run dev:full

# Or run them separately:
# Terminal 1 - Frontend (Vite)
npm run dev

# Terminal 2 - Backend (Express + OCR API)
npm run dev:server
```

### Production Mode

```bash
# Build the frontend
npm run build

# Build the backend
npm run build:server

# Start the backend server
npm run start:server
```

## API Endpoints

- **POST /api/ocr** - Upload and process images with OCR
- **POST /api/export** - Export table data to Excel (placeholder)
- **GET /api/health** - Health check endpoint

## Testing the API

You can test the OCR endpoint using curl:

```bash
curl -X POST \
  http://localhost:3001/api/ocr \
  -F "file=@path/to/your/image.jpg"
```

## File Size Limits

- Maximum file size: 10MB
- Supported formats: JPG, PNG, PDF

## Troubleshooting

1. **"Google Cloud Vision credentials not found"**

   - Make sure `credentials.json` exists in the root folder
   - Check the file path in your `.env` file

2. **"Permission denied" errors**

   - Ensure your service account has the correct permissions
   - Verify the API is enabled in your Google Cloud project

3. **CORS errors in development**

   - The Vite dev server proxies API calls to the backend
   - Make sure both servers are running (`npm run dev:full`)

4. **File upload errors**
   - Check file size (max 10MB)
   - Verify file format (JPG, PNG, PDF only)
