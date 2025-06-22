import express from "express";
import multer from "multer";
import cors from "cors";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads (10MB limit)
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPG, PNG, and PDF are allowed."));
    }
  },
});

// Initialize Google Cloud Vision client
let visionClient: ImageAnnotatorClient;

try {
  // Try to load credentials from base64 environment variable first
  if (process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64) {
    console.log("🔑 Found base64 credentials, decoding...");

    const credentialsJson = Buffer.from(
      process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
      "base64",
    ).toString("utf-8");

    const credentials = JSON.parse(credentialsJson);
    console.log("📋 Credentials parsed, project:", credentials.project_id);

    visionClient = new ImageAnnotatorClient({
      credentials: credentials,
    });
    console.log(
      "✅ Google Cloud Vision client initialized successfully with base64 credentials",
    );
  } else {
    // Fallback to file-based credentials
    const credentialsPath =
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.join(process.cwd(), "credentials.json");

    if (fs.existsSync(credentialsPath)) {
      visionClient = new ImageAnnotatorClient({
        keyFilename: credentialsPath,
      });
      console.log(
        "✅ Google Cloud Vision client initialized successfully with file credentials",
      );
    } else {
      console.warn(
        "⚠️ Google Cloud Vision credentials not found. API will return errors for OCR requests.",
      );
    }
  }
} catch (error) {
  console.error("❌ Error initializing Google Cloud Vision client:", error);
}

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

// OCR API endpoint
app.post("/api/ocr", upload.single("file"), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded. Please upload a JPG, PNG, or PDF file.",
      });
    }

    console.log(
      "Processing file:",
      req.file.originalname,
      "Size:",
      req.file.size,
    );

    let extractedText = "";
    let useRealAPI = false;
    let visionError = "";

    if (visionClient) {
      try {
        console.log("🔍 Calling Google Vision API...");
        // Use Google Cloud Vision API
        const [result] = await visionClient.documentTextDetection({
          image: { content: req.file.buffer },
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
          visionError = "No text detected in image";
        }
      } catch (error) {
        visionError =
          error instanceof Error ? error.message : "Unknown Vision API error";
        console.error("❌ Google Cloud Vision error:", visionError);
      }
    } else {
      visionError = "Google Cloud Vision client not initialized";
      console.error("❌ Vision client not available");
    }

    // If Google Vision API failed, return error instead of mock data
    if (!useRealAPI) {
      const debugInfo = {
        environment: process.env.NODE_ENV || "unknown",
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

    res.json({
      headers:
        tableData.length > 0 ? tableData[0].map((cell) => cell.value) : [],
      rows: tableData.slice(1),
    });
  } catch (error) {
    console.error("OCR processing error:", error);

    if (error instanceof Error && error.message.includes("Invalid file type")) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof Error && error.message.includes("File too large")) {
      return res.status(400).json({ error: "File size exceeds 10MB limit" });
    }

    res.status(500).json({
      error:
        "Failed to process the image. Please try again or contact support.",
    });
  }
});

// Export API endpoint - Generate Excel file from table data
app.post("/api/export", async (req, res) => {
  try {
    const tableData = req.body;

    // Validate request body structure
    if (!tableData || !Array.isArray(tableData)) {
      return res.status(400).json({
        error: "Invalid request body. Expected an array of table rows.",
      });
    }

    // Validate that each row is an array of cell objects
    for (const [rowIndex, row] of tableData.entries()) {
      if (!Array.isArray(row)) {
        return res.status(400).json({
          error: `Invalid row structure at index ${rowIndex}. Expected array of cell objects.`,
        });
      }

      for (const [cellIndex, cell] of row.entries()) {
        if (
          typeof cell !== "object" ||
          cell === null ||
          typeof cell.value === "undefined" ||
          typeof cell.interpolated !== "boolean"
        ) {
          return res.status(400).json({
            error: `Invalid cell structure at row ${rowIndex}, column ${cellIndex}. Expected {value: string, interpolated: boolean}.`,
          });
        }
      }
    }

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Lab Table Data");

    // Set worksheet properties
    worksheet.properties.defaultRowHeight = 20;

    // Define styles
    const interpolatedFill = {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FFCCCCFF" }, // Light blue (#CCCCFF)
    };

    const normalFill = {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FFFFFFFF" }, // White
    };

    const borderStyle = {
      top: { style: "thin" as const },
      left: { style: "thin" as const },
      bottom: { style: "thin" as const },
      right: { style: "thin" as const },
    };

    // Add data to worksheet
    for (const [rowIndex, row] of tableData.entries()) {
      const excelRowIndex = rowIndex + 1; // Excel rows are 1-indexed

      for (const [columnIndex, cell] of row.entries()) {
        const excelColumnIndex = columnIndex + 1; // Excel columns are 1-indexed
        const cellAddress = worksheet.getCell(excelRowIndex, excelColumnIndex);

        // Set cell value
        cellAddress.value = cell.value;

        // Set cell formatting
        cellAddress.fill = cell.interpolated ? interpolatedFill : normalFill;
        cellAddress.border = borderStyle;

        // Set font
        cellAddress.font = {
          name: "Arial",
          size: 10,
          color: { argb: "FF000000" },
        };

        // Center align text
        cellAddress.alignment = {
          vertical: "middle",
          horizontal: "center",
        };
      }
    }

    // Auto-fit columns based on content
    worksheet.columns.forEach((column) => {
      if (column && column.eachCell) {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 50); // Min 10, max 50
      }
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    const filename = `lab-table-export-${timestamp}.xlsx`;

    // Set response headers for Excel file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");

    // Write the workbook to response
    await workbook.xlsx.write(res);

    console.log(`Excel file generated successfully: ${filename}`);
    console.log(`Rows processed: ${tableData.length}`);
    console.log(`Columns: ${tableData.length > 0 ? tableData[0].length : 0}`);
  } catch (error) {
    console.error("Export error:", error);

    // Handle specific error types
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        error: "Invalid JSON format in request body.",
      });
    }

    if (error instanceof Error && error.message.includes("Invalid")) {
      return res.status(400).json({
        error: error.message,
      });
    }

    res.status(500).json({
      error: "Failed to generate Excel file. Please try again.",
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    visionClientStatus: visionClient ? "Connected" : "Not configured",
  });
});

// Error handling middleware
app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Server error:", error);

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File size exceeds 10MB limit" });
      }
    }

    res.status(500).json({ error: "Internal server error" });
  },
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`OCR API available at http://localhost:${PORT}/api/ocr`);
  console.log(`Health check at http://localhost:${PORT}/api/health`);
});

export default app;
