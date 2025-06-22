import { VercelRequest, VercelResponse } from "@vercel/node";
import { IncomingForm } from "formidable";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import fs from "fs";

// Vercel configuration for multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

// Types
interface TableCell {
  value: string;
  interpolated: boolean;
}

// Helper function to check if a value is a valid number
function isValidNumber(value: string): boolean {
  const cleaned = value.replace(/[,\s]/g, "").replace(/^-+|[\-\s]+$/g, "");
  return !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
}

// Helper function to clean numeric values
function cleanNumericValue(value: string): string {
  return value.replace(/[,\s]/g, "").replace(/^-+|[\-\s]+$/g, "");
}

// Helper function to interpolate missing values
function interpolateValue(
  data: (TableCell | null)[][],
  rowIndex: number,
  colIndex: number,
): string {
  let above: string | null = null;
  let below: string | null = null;

  // Look for value above
  for (let i = rowIndex - 1; i >= 0; i--) {
    if (data[i] && data[i][colIndex] && !data[i][colIndex]?.interpolated) {
      above = data[i][colIndex]?.value || null;
      break;
    }
  }

  // Look for value below
  for (let i = rowIndex + 1; i < data.length; i++) {
    if (data[i] && data[i][colIndex] && !data[i][colIndex]?.interpolated) {
      below = data[i][colIndex]?.value || null;
      break;
    }
  }

  // Interpolate between above and below
  if (above && below) {
    const aboveNum = parseFloat(cleanNumericValue(above));
    const belowNum = parseFloat(cleanNumericValue(below));
    if (!isNaN(aboveNum) && !isNaN(belowNum)) {
      return ((aboveNum + belowNum) / 2).toString();
    }
  }

  // Use above value if available
  if (above) return above;

  // Use below value if available
  if (below) return below;

  // Default fallback
  return "0";
}

// Helper function to parse text into structured table
function parseTextToTable(text: string): TableCell[][] {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const rawTable: (string | null)[][] = [];

  // Parse lines into table structure
  for (const line of lines) {
    const cells = line
      .split(/\s{2,}|\t/)
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    if (cells.length > 0) {
      rawTable.push(cells);
    }
  }

  if (rawTable.length === 0) {
    return [];
  }

  // Determine the maximum number of columns
  const maxCols = Math.max(...rawTable.map((row) => row.length));

  // Normalize table structure and identify numeric cells
  const normalizedTable: (TableCell | null)[][] = rawTable.map((row) => {
    const normalizedRow: (TableCell | null)[] = [];
    for (let i = 0; i < maxCols; i++) {
      const cellValue = row[i];
      if (cellValue && isValidNumber(cellValue)) {
        normalizedRow[i] = {
          value: cleanNumericValue(cellValue),
          interpolated: false,
        };
      } else if (cellValue) {
        // Non-numeric values (like headers)
        normalizedRow[i] = {
          value: cellValue,
          interpolated: false,
        };
      } else {
        normalizedRow[i] = null;
      }
    }
    return normalizedRow;
  });

  // Interpolate missing values
  for (let rowIndex = 0; rowIndex < normalizedTable.length; rowIndex++) {
    for (let colIndex = 0; colIndex < maxCols; colIndex++) {
      if (!normalizedTable[rowIndex][colIndex]) {
        const interpolatedValue = interpolateValue(
          normalizedTable,
          rowIndex,
          colIndex,
        );
        normalizedTable[rowIndex][colIndex] = {
          value: interpolatedValue,
          interpolated: true,
        };
      }
    }
  }

  // Convert to final format (remove null values)
  return normalizedTable.map((row) =>
    row.filter((cell): cell is TableCell => cell !== null),
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse multipart form data
    const form = new IncomingForm({
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await new Promise<[any, any]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({
        error: "No file uploaded. Please upload a JPG, PNG, or PDF file.",
      });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.mimetype || "")) {
      return res.status(400).json({
        error: "Invalid file type. Only JPG, PNG, and PDF are allowed.",
      });
    }

    console.log("Processing file:", file.originalFilename, "Size:", file.size);

    let extractedText = "";
    let useRealAPI = false;
    let visionError = "";

    // Debug environment variables
    console.log("Environment check:");
    console.log(
      "- GOOGLE_CLOUD_CREDENTIALS_BASE64 exists:",
      !!process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
    );
    console.log("- NODE_ENV:", process.env.NODE_ENV);
    console.log("- VERCEL:", process.env.VERCEL);

    // Try to use Google Cloud Vision API if credentials are available
    try {
      if (!process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64) {
        throw new Error(
          "GOOGLE_CLOUD_CREDENTIALS_BASE64 environment variable not found",
        );
      }

      console.log("🔑 Found base64 credentials, decoding...");

      let credentialsJson;
      try {
        credentialsJson = Buffer.from(
          process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
          "base64",
        ).toString("utf-8");
      } catch (decodeError) {
        throw new Error(
          "Failed to decode base64 credentials: " + decodeError.message,
        );
      }

      let credentials;
      try {
        credentials = JSON.parse(credentialsJson);
        console.log("📋 Credentials parsed, project:", credentials.project_id);
      } catch (parseError) {
        throw new Error(
          "Failed to parse credentials JSON: " + parseError.message,
        );
      }

      console.log("🚀 Initializing Google Vision client...");
      const visionClient = new ImageAnnotatorClient({
        credentials: credentials,
      });

      console.log("📁 Reading file buffer...");
      const fileBuffer = fs.readFileSync(file.filepath);
      console.log("📄 File buffer size:", fileBuffer.length);

      console.log("🔍 Calling Google Vision API...");
      const [result] = await visionClient.documentTextDetection({
        image: { content: fileBuffer },
      });

      console.log("📊 Vision API response received");
      const detections = result.textAnnotations;

      if (detections && detections.length > 0 && detections[0].description) {
        extractedText = detections[0].description;
        useRealAPI = true;
        console.log(
          "✅ SUCCESS: Extracted",
          extractedText.length,
          "characters",
        );
        console.log("📝 First 200 chars:", extractedText.substring(0, 200));
      } else {
        console.log("⚠️ No text detected in the image");
        throw new Error("No text detected in image");
      }
    } catch (error) {
      visionError =
        error instanceof Error ? error.message : "Unknown Vision API error";
      console.error("❌ Google Cloud Vision error:", visionError);
      console.error("📜 Full error:", error);
    }

    // If Google Vision API failed, return error instead of mock data
    if (!useRealAPI) {
      const debugInfo = {
        environment: process.env.NODE_ENV || "unknown",
        vercel: !!process.env.VERCEL,
        credentialsFound: !!process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
        credentialsLength:
          process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64?.length || 0,
        useRealAPI: false,
        extractedTextLength: 0,
        error: visionError,
      };

      return res.status(422).json({
        error: "Google Vision API is not available",
        details: visionError,
        debug: debugInfo,
      });
    }

    // Parse the extracted text into a structured table
    const tableData = parseTextToTable(extractedText);

    console.log("Extracted table data:", JSON.stringify(tableData, null, 2));

    // Debug response
    const debugInfo = {
      environment: process.env.NODE_ENV || "unknown",
      vercel: !!process.env.VERCEL,
      credentialsFound: !!process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
      credentialsLength:
        process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64?.length || 0,
      useRealAPI,
      extractedTextLength: extractedText.length,
    };

    console.log("🔧 Debug info:", debugInfo);

    res.json({
      headers:
        tableData.length > 0 ? tableData[0].map((cell) => cell.value) : [],
      rows: tableData.slice(1),
      source: useRealAPI ? "Google Vision API" : "Mock Data",
      debug: debugInfo,
    });
  } catch (error) {
    console.error("OCR processing error:", error);

    res.status(500).json({
      error:
        "Failed to process the image. Please try again or contact support.",
    });
  }
}
