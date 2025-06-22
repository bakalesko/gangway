# Google Vision API Troubleshooting Guide

## Important: Development vs Production

**⚠️ This application is designed for Vercel deployment.**

- **Development Mode**: API endpoints may not work fully, but you can still test image uploads
- **Production Mode**: Full functionality available when deployed to Vercel

## Problem: "Google Vision API not working" / "API not detected"

### Quick Diagnosis

1. **Open the application in your browser**
2. **Click "Check System Status"** in the Error Log section
3. **Expected messages in development:**
   - ⚠️ API endpoints not available in development mode
   - 💡 This is normal - the app is configured for Vercel deployment
   - 🧪 Try uploading an image to test Google Vision API

## Testing in Development Mode

**To test Google Vision API in development:**

1. Make sure `base64.txt` exists with your credentials
2. Upload a test image using the "Scan Table" button
3. Check the error log for detailed feedback

### If you see credential errors:

#### Step 1: Verify Credentials File

Make sure you have a `base64.txt` file in the root directory containing your Google Cloud service account credentials encoded in base64 format.

#### Step 2: Check Credentials Format

Your `base64.txt` should contain a base64-encoded JSON that looks like this when decoded:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "your-service@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

#### Step 3: Google Cloud Setup

1. **Enable the Cloud Vision API** in your Google Cloud Console
2. **Create a Service Account** with Vision API permissions
3. **Download the JSON key file**
4. **Encode it to base64** and put it in `base64.txt`

### Common Issues & Solutions

#### Issue: "GOOGLE_CLOUD_CREDENTIALS_BASE64 environment variable not found"

**Solution:** The application couldn't find the credentials in `base64.txt`. Make sure:

- File exists in the root directory (same level as package.json)
- File contains valid base64-encoded content
- Restart the development server after adding the file

#### Issue: "Failed to decode base64 credentials"

**Solution:** Your base64 encoding is corrupted. To fix:

1. Take your original `credentials.json` file
2. Encode it properly: `base64 -w 0 credentials.json > base64.txt`
3. Restart the dev server

#### Issue: "No text detected in image"

**Solution:** This is a Google Vision API response, meaning:

- Your credentials work ✅
- The image doesn't contain readable text or tables
- Try a clearer image with better contrast

#### Issue: "Failed to initialize Google Vision client"

**Solution:** Check your Google Cloud project:

- Is the Cloud Vision API enabled?
- Does your service account have the right permissions?
- Is your project billing enabled?

### Manual Testing

You can test your credentials manually by visiting:

```
http://localhost:8080/api/test-credentials
```

This will return detailed information about your credential status.

### Getting Help

If you're still having issues:

1. Check the browser developer console for additional errors
2. Look at the "System Status & Error Log" section in the app
3. Verify your Google Cloud project settings
4. Make sure you're using the correct service account JSON file

### Environment Variables (Alternative Setup)

Instead of using `base64.txt`, you can also set the environment variable directly:

```bash
export GOOGLE_CLOUD_CREDENTIALS_BASE64="your_base64_encoded_credentials_here"
npm run dev
```
