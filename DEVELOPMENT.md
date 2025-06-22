# Development Setup for Lab Table Scanner

## Quick Start

To run the complete Lab Table Scanner application with both frontend and API server:

```bash
npm run dev:full
```

This command will start:

- **Frontend (Vite)**: http://localhost:8080
- **API Server (Express)**: http://localhost:3001
- **Automatic Proxy**: `/api/*` requests from frontend are proxied to the API server

## Individual Services

### Frontend Only

```bash
npm run dev
```

Starts only the Vite development server on port 8080.

### API Server Only

```bash
npm run api
```

Starts only the Express API server on port 3001.

## Google Cloud Vision API Setup

The application uses Google Cloud Vision API for OCR functionality. The credentials should be stored in `base64.txt` file in the root directory.

### Status Check

Visit http://localhost:8080/api/health to check the system status:

```json
{
  "status": "OK",
  "timestamp": "2025-06-22T11:19:54.778Z",
  "environment": "development",
  "visionClientStatus": "Connected",
  "credentialsStatus": {
    "base64Found": true,
    "base64Length": 3136
  },
  "message": "Lab Table Scanner API is running"
}
```

- `visionClientStatus: "Connected"` means Google Vision API is ready
- `base64Found: true` means credentials are properly loaded
- `base64Length > 0` indicates valid credential data

## API Endpoints

### OCR Processing

- **Endpoint**: `POST /api/ocr`
- **Purpose**: Extract table data from uploaded images
- **Accepts**: JPG, PNG, PDF files (max 10MB)
- **Parameters**:
  - `file`: The uploaded image/PDF file
  - `expectedColumns`: Number of expected columns (default: 13)
  - `expectedRows`: Number of expected rows (default: 24)
- **Returns**: Structured table data with specified dimensions or error details

#### Table Configuration

The OCR processing now supports configurable table dimensions to improve accuracy:

- **Колони (Columns)**: 1-50 columns supported
- **Редове (Rows)**: 1-100 rows supported
- **Smart Parsing**: Uses multiple parsing strategies based on expected dimensions
- **Interpolation**: Automatically fills missing cells with interpolated values

### Excel Export

- **Endpoint**: `POST /api/export`
- **Purpose**: Convert table data to Excel format
- **Accepts**: JSON array of table rows
- **Returns**: Excel file download

### Health Check

- **Endpoint**: `GET /api/health`
- **Purpose**: System status and connectivity check
- **Returns**: Status information and diagnostics

## Development Architecture

```
┌─────────────────┐    Proxy     ┌─────────────────┐
│   Frontend      │─────────────▶│   API Server    │
│   (Vite)        │   /api/*     │   (Express)     │
│   Port 8080     │              │   Port 3001     │
└─────────────────┘              └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Google Vision   │
                                 │ API             │
                                 └─────────────────┘
```

## Troubleshooting

### Google Vision API Not Connected

1. Check that `base64.txt` exists and contains valid base64-encoded credentials
2. Verify the health endpoint shows `visionClientStatus: "Connected"`
3. Check the development logs for initialization messages

### API Requests Failing

1. Ensure both frontend and API server are running (`npm run dev:full`)
2. Check that port 3001 is not blocked or used by another service
3. Verify the proxy configuration in `vite.config.ts`

### File Upload Issues

1. Ensure file size is under 10MB
2. Use supported formats: JPG, PNG, PDF
3. Check browser network tab for detailed error messages

## Production Deployment

For production deployment on Vercel, the application uses serverless functions in the `/api/` directory instead of the Express server. The Express server in `/server/` is only for local development.
