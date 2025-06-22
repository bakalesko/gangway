import { VercelRequest, VercelResponse } from "@vercel/node";
import { ImageAnnotatorClient } from "@google-cloud/vision";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("🔧 Testing Google Cloud Vision credentials...");

    // Check if credentials exist
    if (!process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64) {
      return res.status(400).json({
        status: "error",
        message:
          "GOOGLE_CLOUD_CREDENTIALS_BASE64 environment variable not found",
        debug: {
          hasCredentials: false,
          credentialsLength: 0,
        },
      });
    }

    console.log("🔑 Found base64 credentials, decoding...");

    // Decode credentials
    let credentialsJson;
    try {
      credentialsJson = Buffer.from(
        process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
        "base64",
      ).toString("utf-8");
    } catch (decodeError) {
      return res.status(400).json({
        status: "error",
        message: "Failed to decode base64 credentials",
        error: decodeError.message,
      });
    }

    // Parse credentials
    let credentials;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch (parseError) {
      return res.status(400).json({
        status: "error",
        message: "Failed to parse credentials JSON",
        error: parseError.message,
      });
    }

    // Validate credentials structure
    if (
      !credentials.type ||
      !credentials.project_id ||
      !credentials.client_email ||
      !credentials.private_key
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid credentials structure",
        debug: {
          hasType: !!credentials.type,
          hasProjectId: !!credentials.project_id,
          hasClientEmail: !!credentials.client_email,
          hasPrivateKey: !!credentials.private_key,
        },
      });
    }

    console.log("📋 Credentials structure validated");
    console.log("🚀 Initializing Google Vision client...");

    // Try to initialize the Vision client
    try {
      const visionClient = new ImageAnnotatorClient({
        credentials: credentials,
      });

      console.log("✅ Google Vision client initialized successfully");

      return res.json({
        status: "success",
        message: "Google Cloud Vision API credentials are properly configured",
        debug: {
          hasCredentials: true,
          credentialsLength: process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64.length,
          projectId: credentials.project_id,
          clientEmail: credentials.client_email,
          type: credentials.type,
        },
      });
    } catch (visionError) {
      return res.status(422).json({
        status: "error",
        message: "Failed to initialize Google Vision client",
        error: visionError.message,
        debug: {
          projectId: credentials.project_id,
          clientEmail: credentials.client_email,
        },
      });
    }
  } catch (error) {
    console.error("❌ Credentials test error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error during credentials test",
      error: error.message,
    });
  }
}
