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
      "base64"
    ).toString("utf-8");

    const credentials = JSON.parse(credentialsJson);
    console.log("📋 Credentials parsed, project:", credentials.project_id);

    visionClient = new ImageAnnotatorClient({
      credentials: credentials,
    });
    console.log("✅ Google Cloud Vision client initialized successfully with base64 credentials");
  } else {
    // Fallback to file-based credentials
    const credentialsPath =
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.join(process.cwd(), "credentials.json");

    if (fs.existsSync(credentialsPath)) {
      visionClient = new ImageAnnotatorClient({
        keyFilename: credentialsPath,
      });
      console.log("✅ Google Cloud Vision client initialized successfully with file credentials");
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

// Advanced numeric interpolation with digit pattern matching
function interpolateValue(
  data: (TableCell | null)[][],
  rowIndex: number,
  colIndex: number,
  firstRowAnchor?: string[],
  lastRowAnchor?: string[],
): string {
  const totalRows = data.length;

  // Try to get anchor values for this column
  const firstAnchorValue = firstRowAnchor?.[colIndex];
  const lastAnchorValue = lastRowAnchor?.[colIndex];

  // Advanced numeric interpolation with pattern analysis
  if (firstAnchorValue && lastAnchorValue &&
      isValidNumber(firstAnchorValue) && isValidNumber(lastAnchorValue)) {

    const firstNum = parseFloat(cleanNumericValue(firstAnchorValue));
    const lastNum = parseFloat(cleanNumericValue(lastAnchorValue));

    if (!isNaN(firstNum) && !isNaN(lastNum)) {
      // Analyze number patterns from anchor values
      const firstStr = firstAnchorValue.trim();
      const lastStr = lastAnchorValue.trim();

      // Determine if numbers are integers or decimals
      const isDecimal = firstStr.includes('.') || lastStr.includes('.');

      // Determine decimal places (if decimal)
      let decimalPlaces = 0;
      if (isDecimal) {
        const firstDecimals = firstStr.includes('.') ? firstStr.split('.')[1]?.length || 0 : 0;
        const lastDecimals = lastStr.includes('.') ? lastStr.split('.')[1]?.length || 0 : 0;
        decimalPlaces = Math.max(firstDecimals, lastDecimals);
      }

      // Determine minimum digit count (for zero-padding)
      const firstDigits = firstStr.replace(/[^0-9]/g, '').length;
      const lastDigits = lastStr.replace(/[^0-9]/g, '').length;
      const minDigits = Math.max(firstDigits, lastDigits);

      // Progressive interpolation based on row position
      const progress = rowIndex / (totalRows - 1);
      const interpolatedValue = firstNum + (lastNum - firstNum) * progress;

      // Format according to detected pattern
      let formattedValue: string;

      if (isDecimal) {
        formattedValue = interpolatedValue.toFixed(decimalPlaces);
      } else {
        // Integer formatting with potential zero-padding
        const intValue = Math.round(interpolatedValue);
        formattedValue = intValue.toString();

        // Check if we need zero-padding (e.g., 19 -> 9 should be 09)
        if (firstNum > 0 && lastNum > 0) {
          const firstIntStr = Math.round(firstNum).toString();
          const lastIntStr = Math.round(lastNum).toString();

          // If first number has more digits than last, pad the result
          if (firstIntStr.length > lastIntStr.length && firstIntStr.length > 1) {
            formattedValue = intValue.toString().padStart(firstIntStr.length, '0');
          }
        }
      }

      console.log(`🎯 Smart interpolation for row ${rowIndex}, col ${colIndex}: ${formattedValue} (pattern: ${isDecimal ? 'decimal' : 'integer'}, digits: ${minDigits})`);
      return formattedValue;
    }
  }

  // Fallback to traditional nearest-neighbor interpolation with pattern matching
  let above: string | null = null;
  let below: string | null = null;
  let aboveIndex = -1;
  let belowIndex = -1;

  // Look for value above
  for (let i = rowIndex - 1; i >= 0; i--) {
    if (data[i] && data[i][colIndex] && !data[i][colIndex]?.interpolated) {
      above = data[i][colIndex]?.value || null;
      aboveIndex = i;
      break;
    }
  }

  // Look for value below
  for (let i = rowIndex + 1; i < data.length; i++) {
    if (data[i] && data[i][colIndex] && !data[i][colIndex]?.interpolated) {
      below = data[i][colIndex]?.value || null;
      belowIndex = i;
      break;
    }
  }

  // Smart interpolation between found values with pattern analysis
  if (above && below && isValidNumber(above) && isValidNumber(below)) {
    const aboveNum = parseFloat(cleanNumericValue(above));
    const belowNum = parseFloat(cleanNumericValue(below));

    if (!isNaN(aboveNum) && !isNaN(belowNum)) {
      // Analyze patterns from nearby values
      const aboveStr = above.trim();
      const belowStr = below.trim();

      const isDecimal = aboveStr.includes('.') || belowStr.includes('.');
      let decimalPlaces = 0;
      if (isDecimal) {
        const aboveDecimals = aboveStr.includes('.') ? aboveStr.split('.')[1]?.length || 0 : 0;
        const belowDecimals = belowStr.includes('.') ? belowStr.split('.')[1]?.length || 0 : 0;
        decimalPlaces = Math.max(aboveDecimals, belowDecimals);
      }

      // Linear interpolation based on position between above and below
      const totalDistance = belowIndex - aboveIndex;
      const currentDistance = rowIndex - aboveIndex;
      const progress = currentDistance / totalDistance;

      const interpolatedValue = aboveNum + (belowNum - aboveNum) * progress;

      // Format according to detected pattern
      let formattedValue: string;
      if (isDecimal) {
        formattedValue = interpolatedValue.toFixed(decimalPlaces);
      } else {
        const intValue = Math.round(interpolatedValue);
        formattedValue = intValue.toString();

        // Check for zero-padding pattern
        const aboveIntStr = Math.round(aboveNum).toString();
        const belowIntStr = Math.round(belowNum).toString();
        const maxLength = Math.max(aboveIntStr.length, belowIntStr.length);

        if (maxLength > 1 && (aboveStr.startsWith('0') || belowStr.startsWith('0'))) {
          formattedValue = intValue.toString().padStart(maxLength, '0');
        }
      }

      console.log(`📈 Pattern interpolation for row ${rowIndex}, col ${colIndex}: ${formattedValue}`);
      return formattedValue;
    }
  }

  // Use anchor values as fallback
  if (firstAnchorValue && isValidNumber(firstAnchorValue)) {
    console.log(`⚓ Using first anchor for row ${rowIndex}, col ${colIndex}: ${firstAnchorValue}`);
    return cleanNumericValue(firstAnchorValue);
  }

  if (lastAnchorValue && isValidNumber(lastAnchorValue)) {
    console.log(`⚓ Using last anchor for row ${rowIndex}, col ${colIndex}: ${lastAnchorValue}`);
    return cleanNumericValue(lastAnchorValue);
  }

  // Use single nearby value if available
  if (above) return above;
  if (below) return below;

  // Default fallback
  return "0";
}

// Helper function to parse text into structured table with fixed dimensions and anchor rows
function parseTextToTable(
  text: string,
  expectedCols: number = 13,
  expectedRows: number = 24,
  firstRowValues?: string,
  lastRowValues?: string
): TableCell[][] {
  console.log(`🎯 Parsing table with expected dimensions: ${expectedCols} columns x ${expectedRows} rows`);

  // Parse anchor rows if provided
  let firstRowAnchor: string[] | undefined;
  let lastRowAnchor: string[] | undefined;

  if (firstRowValues) {
    firstRowAnchor = firstRowValues
      .split(/[,\s]+/)
      .map(v => v.trim())
      .filter(v => v.length > 0);
    console.log(`⚓ First row anchor: [${firstRowAnchor.join(', ')}]`);
  }

  if (lastRowValues) {
    lastRowAnchor = lastRowValues
      .split(/[,\s]+/)
      .map(v => v.trim())
      .filter(v => v.length > 0);
    console.log(`⚓ Last row anchor: [${lastRowAnchor.join(', ')}]`);
  }

  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  console.log(`📝 Found ${lines.length} non-empty lines in OCR text`);

  // Try multiple parsing strategies for better accuracy
  const rawTable: (string | null)[][] = [];

  // Strategy 1: Split by multiple spaces or tabs (most common)
  let parseStrategy = "multiple-spaces";
  for (const line of lines) {
    const cells = line
      .split(/\s{2,}|\t/)
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    if (cells.length > 0) {
      rawTable.push(cells);
    }
  }

  // Strategy 2: If we don't have enough columns, try single space separation
  const maxColsFound = Math.max(...rawTable.map((row) => row.length));
  if (maxColsFound < expectedCols * 0.7) { // If we have less than 70% of expected columns
    console.log(`🔄 Switching to single-space parsing strategy (found ${maxColsFound}/${expectedCols} columns)`);
    parseStrategy = "single-spaces";
    rawTable.length = 0; // Clear previous results

    for (const line of lines) {
      const cells = line
        .split(/\s+/)
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      if (cells.length > 0) {
        rawTable.push(cells);
      }
    }
  }

  console.log(`📊 Parse strategy: ${parseStrategy}, found ${rawTable.length} rows`);

  if (rawTable.length === 0) {
    console.log("⚠️ No table data found, creating empty structure");
    return createEmptyTable(expectedCols, expectedRows);
  }

  // Use expected dimensions exactly as specified
  const targetCols = expectedCols;
  const targetRows = expectedRows; // Force exact row count

  console.log(`🎯 Target structure: ${targetCols} columns x ${targetRows} rows`);

  // Take only the first targetRows from rawTable (strict limit)
  const limitedRawTable = rawTable.slice(0, targetRows);
  console.log(`📏 Limited raw table to ${limitedRawTable.length} rows (max: ${targetRows})`);

  // Initialize the normalized table with exact dimensions
  const normalizedTable: (TableCell | null)[][] = [];

  for (let rowIndex = 0; rowIndex < targetRows; rowIndex++) {
    const row: (TableCell | null)[] = [];
    const sourceRow = limitedRawTable[rowIndex] || [];

    for (let colIndex = 0; colIndex < targetCols; colIndex++) {
      // Take only the first targetCols from each row (strict limit)
      let cellValue = colIndex < sourceRow.length ? sourceRow[colIndex] : undefined;

      // Override with anchor values for first and last rows if provided
      if (rowIndex === 0 && firstRowAnchor && firstRowAnchor[colIndex]) {
        cellValue = firstRowAnchor[colIndex];
        console.log(`🎯 Using first row anchor for [0,${colIndex}]: ${cellValue}`);
      } else if (rowIndex === targetRows - 1 && lastRowAnchor && lastRowAnchor[colIndex]) {
        cellValue = lastRowAnchor[colIndex];
        console.log(`🎯 Using last row anchor for [${rowIndex},${colIndex}]: ${cellValue}`);
      }

      if (cellValue && cellValue.trim()) {
        // Always try to treat as numeric value first
        if (isValidNumber(cellValue)) {
          row[colIndex] = {
            value: cellValue.trim(), // Keep original format for pattern analysis
            interpolated: false,
          };
        } else {
          // For first row (headers), keep as-is, otherwise try to extract numbers
          if (rowIndex === 0) {
            row[colIndex] = {
              value: cellValue.trim(),
              interpolated: false,
            };
          } else {
            // Try to extract numeric parts from mixed content
            const numericMatch = cellValue.match(/[\d.,]+/);
            if (numericMatch && isValidNumber(numericMatch[0])) {
              row[colIndex] = {
                value: numericMatch[0].trim(),
                interpolated: false,
              };
            } else {
              row[colIndex] = null; // Will be interpolated later
            }
          }
        }
      } else {
        row[colIndex] = null; // Will be interpolated later
      }
    }
    normalizedTable.push(row);
  }

  // Enhanced interpolation for missing values with missing row detection
  console.log("🔧 Interpolating missing values...");
  let interpolatedCount = 0;
  let missingRowCount = 0;

  // First, detect entirely missing rows
  const missingRows = new Set<number>();
  for (let rowIndex = 1; rowIndex < normalizedTable.length - 1; rowIndex++) { // Skip header and last row
    const row = normalizedTable[rowIndex];
    const hasAnyValue = row.some(cell => cell && !cell.interpolated);
    if (!hasAnyValue) {
      missingRows.add(rowIndex);
      missingRowCount++;
      console.log(`🔍 Detected missing row: ${rowIndex}`);
    }
  }

  for (let rowIndex = 0; rowIndex < normalizedTable.length; rowIndex++) {
    for (let colIndex = 0; colIndex < targetCols; colIndex++) {
      if (!normalizedTable[rowIndex][colIndex]) {
        const interpolatedValue = interpolateValue(
          normalizedTable,
          rowIndex,
          colIndex,
          firstRowAnchor,
          lastRowAnchor,
        );

        // Round to 1 decimal place if anchor rows have decimals
        let finalValue = interpolatedValue;
        if (firstRowAnchor && lastRowAnchor &&
            firstRowAnchor[colIndex] && lastRowAnchor[colIndex] &&
            isValidNumber(firstRowAnchor[colIndex]) && isValidNumber(lastRowAnchor[colIndex])) {
          const firstHasDecimal = firstRowAnchor[colIndex].includes('.');
          const lastHasDecimal = lastRowAnchor[colIndex].includes('.');
          if (firstHasDecimal || lastHasDecimal) {
            const numValue = parseFloat(finalValue);
            if (!isNaN(numValue)) {
              finalValue = numValue.toFixed(1);
            }
          }
        }

        normalizedTable[rowIndex][colIndex] = {
          value: finalValue,
          interpolated: true,
          missingRow: missingRows.has(rowIndex), // Mark if entire row is missing
        };
        interpolatedCount++;
      }
    }
  }

  console.log(`✅ Interpolated ${interpolatedCount} missing cells, ${missingRowCount} missing rows`);
}

  console.log(`✅ Interpolated ${interpolatedCount} missing cells`);

  // Convert to final format (remove null values, but this shouldn't happen now)
  const finalTable = normalizedTable.map((row) =>
    row.filter((cell): cell is TableCell => cell !== null),
  );

  console.log(`📋 Final table: ${finalTable.length} rows x ${finalTable[0]?.length || 0} columns`);
  return finalTable;
}

// Helper function to create empty table structure
function createEmptyTable(cols: number, rows: number): TableCell[][] {
  console.log(`📝 Creating empty table structure: ${cols}x${rows}`);
  const table: TableCell[][] = [];

  // Create header row
  const headers: TableCell[] = [];
  for (let i = 0; i < cols; i++) {
    headers.push({
      value: `Column ${i + 1}`,
      interpolated: true,
    });
  }
  table.push(headers);

  // Create data rows
  for (let rowIndex = 1; rowIndex < rows; rowIndex++) {
    const row: TableCell[] = [];
    for (let colIndex = 0; colIndex < cols; colIndex++) {
      row.push({
        value: "",
        interpolated: true,
      });
    }
    table.push(row);
  }

  return table;
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

    // Get table dimensions and anchor values from request
    const expectedColumns = parseInt(req.body.expectedColumns) || 13;
    const expectedRows = parseInt(req.body.expectedRows) || 24;
    const firstRowValues = req.body.firstRowValues || undefined;
    const lastRowValues = req.body.lastRowValues || undefined;

    console.log(
      "Processing file:",
      req.file.originalname,
      "Size:",
      req.file.size,
      "Expected dimensions:",
      `${expectedColumns}x${expectedRows}`,
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
          console.log("✅ SUCCESS: Extracted", extractedText.length, "characters");
          console.log("📝 First 200 chars:", extractedText.substring(0, 200));
        } else {
          console.log("⚠️ No text detected in the image");
          visionError = "No text detected in image";
        }
      } catch (error) {
        visionError = error instanceof Error ? error.message : "Unknown Vision API error";
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
        credentialsLength: process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64?.length || 0,
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

    // Parse the extracted text into a structured table with user-specified dimensions and anchor rows
    const tableData = parseTextToTable(extractedText, expectedColumns, expectedRows, firstRowValues, lastRowValues);

    console.log("Extracted table data:", JSON.stringify(tableData, null, 2));

    // Debug response
    const debugInfo = {
      environment: process.env.NODE_ENV || "unknown",
      credentialsFound: !!process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
      credentialsLength: process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64?.length || 0,
      useRealAPI: true,
      extractedTextLength: extractedText.length,
      error: null,
    };

    console.log("🔧 Debug info:", debugInfo);

    res.json({
      headers:
        tableData.length > 0 ? tableData[0].map((cell) => cell.value) : [],
      rows: tableData.slice(1),
      source: "Google Vision API",
      debug: debugInfo,
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
    console.error("❌ Export error details:", error);
    console.error("❌ Error type:", typeof error);
    console.error("❌ Error name:", error instanceof Error ? error.name : "Unknown");
    console.error("❌ Error message:", error instanceof Error ? error.message : "Unknown");
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack");

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
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    visionClientStatus: visionClient ? "Connected" : "Not configured",
    credentialsStatus: {
      base64Found: !!process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
      base64Length: process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64?.length || 0,
    },
    message: "Lab Table Scanner API is running",
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