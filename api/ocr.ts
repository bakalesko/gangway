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
  missingRow?: boolean; // Mark entire missing rows
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
  if (
    firstAnchorValue &&
    lastAnchorValue &&
    isValidNumber(firstAnchorValue) &&
    isValidNumber(lastAnchorValue)
  ) {
    const firstNum = parseFloat(cleanNumericValue(firstAnchorValue));
    const lastNum = parseFloat(cleanNumericValue(lastAnchorValue));

    if (!isNaN(firstNum) && !isNaN(lastNum)) {
      // Analyze number patterns from anchor values
      const firstStr = firstAnchorValue.trim();
      const lastStr = lastAnchorValue.trim();

      // Determine if numbers are integers or decimals
      const isDecimal = firstStr.includes(".") || lastStr.includes(".");

      // Determine decimal places (if decimal)
      let decimalPlaces = 0;
      if (isDecimal) {
        const firstDecimals = firstStr.includes(".")
          ? firstStr.split(".")[1]?.length || 0
          : 0;
        const lastDecimals = lastStr.includes(".")
          ? lastStr.split(".")[1]?.length || 0
          : 0;
        decimalPlaces = Math.max(firstDecimals, lastDecimals);
      }

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
          if (
            firstIntStr.length > lastIntStr.length &&
            firstIntStr.length > 1
          ) {
            formattedValue = intValue
              .toString()
              .padStart(firstIntStr.length, "0");
          }
        }
      }

      console.log(
        `🎯 Smart interpolation for row ${rowIndex}, col ${colIndex}: ${formattedValue} (pattern: ${isDecimal ? "decimal" : "integer"})`,
      );
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

      const isDecimal = aboveStr.includes(".") || belowStr.includes(".");
      let decimalPlaces = 0;
      if (isDecimal) {
        const aboveDecimals = aboveStr.includes(".")
          ? aboveStr.split(".")[1]?.length || 0
          : 0;
        const belowDecimals = belowStr.includes(".")
          ? belowStr.split(".")[1]?.length || 0
          : 0;
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

        if (
          maxLength > 1 &&
          (aboveStr.startsWith("0") || belowStr.startsWith("0"))
        ) {
          formattedValue = intValue.toString().padStart(maxLength, "0");
        }
      }

      console.log(
        `📈 Pattern interpolation for row ${rowIndex}, col ${colIndex}: ${formattedValue}`,
      );
      return formattedValue;
    }
  }

  // Use anchor values as fallback
  if (firstAnchorValue && isValidNumber(firstAnchorValue)) {
    console.log(
      `⚓ Using first anchor for row ${rowIndex}, col ${colIndex}: ${firstAnchorValue}`,
    );
    return cleanNumericValue(firstAnchorValue);
  }

  if (lastAnchorValue && isValidNumber(lastAnchorValue)) {
    console.log(
      `⚓ Using last anchor for row ${rowIndex}, col ${colIndex}: ${lastAnchorValue}`,
    );
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
  lastRowValues?: string,
): TableCell[][] {
  console.log(
    `🎯 Parsing table with expected dimensions: ${expectedCols} columns x ${expectedRows} rows`,
  );

  // Parse anchor rows if provided
  let firstRowAnchor: string[] | undefined;
  let lastRowAnchor: string[] | undefined;

  if (firstRowValues) {
    firstRowAnchor = firstRowValues
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    console.log(`⚓ First row anchor: [${firstRowAnchor.join(", ")}]`);
  }

  if (lastRowValues) {
    lastRowAnchor = lastRowValues
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    console.log(`⚓ Last row anchor: [${lastRowAnchor.join(", ")}]`);
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
  if (maxColsFound < expectedCols * 0.7) {
    // If we have less than 70% of expected columns
    console.log(
      `🔄 Switching to single-space parsing strategy (found ${maxColsFound}/${expectedCols} columns)`,
    );
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

  console.log(
    `📊 Parse strategy: ${parseStrategy}, found ${rawTable.length} rows`,
  );

  if (rawTable.length === 0) {
    console.log("⚠️ No table data found, creating empty structure");
    return createEmptyTable(expectedCols, expectedRows);
  }

  // Use expected dimensions exactly as specified
  const targetCols = expectedCols;
  const targetRows = expectedRows; // Force exact row count

  console.log(
    `🎯 Target structure: ${targetCols} columns x ${targetRows} rows`,
  );

  // Take only the first targetRows from rawTable (strict limit)
  const limitedRawTable = rawTable.slice(0, targetRows);
  console.log(
    `📏 Limited raw table to ${limitedRawTable.length} rows (max: ${targetRows})`,
  );

  // Initialize the normalized table with exact dimensions
  const normalizedTable: (TableCell | null)[][] = [];

  for (let rowIndex = 0; rowIndex < targetRows; rowIndex++) {
    const row: (TableCell | null)[] = [];
    const sourceRow = limitedRawTable[rowIndex] || [];

    for (let colIndex = 0; colIndex < targetCols; colIndex++) {
      // Take only the first targetCols from each row (strict limit)
      let cellValue =
        colIndex < sourceRow.length ? sourceRow[colIndex] : undefined;

      // Override with anchor values for first and last rows if provided
      if (rowIndex === 0 && firstRowAnchor && firstRowAnchor[colIndex]) {
        cellValue = firstRowAnchor[colIndex];
        console.log(
          `🎯 Using first row anchor for [0,${colIndex}]: ${cellValue}`,
        );
      } else if (
        rowIndex === targetRows - 1 &&
        lastRowAnchor &&
        lastRowAnchor[colIndex]
      ) {
        cellValue = lastRowAnchor[colIndex];
        console.log(
          `🎯 Using last row anchor for [${rowIndex},${colIndex}]: ${cellValue}`,
        );
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

  // Enhanced interpolation for missing values
  console.log("🔧 Interpolating missing values...");
  let interpolatedCount = 0;

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
        normalizedTable[rowIndex][colIndex] = {
          value: interpolatedValue,
          interpolated: true,
        };
        interpolatedCount++;
      }
    }
  }

  console.log(`✅ Interpolated ${interpolatedCount} missing cells`);

  // Convert to final format (remove null values, but this shouldn't happen now)
  const finalTable = normalizedTable.map((row) =>
    row.filter((cell): cell is TableCell => cell !== null),
  );

  console.log(
    `📋 Final table: ${finalTable.length} rows x ${finalTable[0]?.length || 0} columns`,
  );
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

    // Get table dimensions and anchor values from request
    const expectedColumns =
      parseInt(
        Array.isArray(fields.expectedColumns)
          ? fields.expectedColumns[0]
          : fields.expectedColumns,
      ) || 13;
    const expectedRows =
      parseInt(
        Array.isArray(fields.expectedRows)
          ? fields.expectedRows[0]
          : fields.expectedRows,
      ) || 24;
    const firstRowValues = Array.isArray(fields.firstRowValues)
      ? fields.firstRowValues[0]
      : fields.firstRowValues;
    const lastRowValues = Array.isArray(fields.lastRowValues)
      ? fields.lastRowValues[0]
      : fields.lastRowValues;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.mimetype || "")) {
      return res.status(400).json({
        error: "Invalid file type. Only JPG, PNG, and PDF are allowed.",
      });
    }

    console.log(
      "Processing file:",
      file.originalFilename,
      "Size:",
      file.size,
      "Expected dimensions:",
      `${expectedColumns}x${expectedRows}`,
      "Anchor rows:",
      firstRowValues ? "First✓" : "First✗",
      lastRowValues ? "Last✓" : "Last✗",
    );

    let extractedText = "";
    let useRealAPI = false;
    let visionError = "";

    // Debug environment variables
    console.log("Environment check:");
    console.log(
      "- GOOGLE_CLOUD_CREDENTIALS_BASE64 exists:",
      !!process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
    );
    console.log(
      "- GOOGLE_CLOUD_CREDENTIALS_BASE64 length:",
      process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64?.length || 0,
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

    // Parse the extracted text into a structured table with user-specified dimensions and anchor rows
    const tableData = parseTextToTable(
      extractedText,
      expectedColumns,
      expectedRows,
      firstRowValues,
      lastRowValues,
    );

    console.log("Extracted table data:", JSON.stringify(tableData, null, 2));

    // Debug response
    const debugInfo = {
      environment: process.env.NODE_ENV || "unknown",
      vercel: !!process.env.VERCEL,
      credentialsFound: !!process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
      credentialsLength:
        process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64?.length || 0,
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

    res.status(500).json({
      error:
        "Failed to process the image. Please try again or contact support.",
    });
  }
}
