const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// Helper functions
function isValidNumber(value) {
  const cleaned = value.replace(/[,\s]/g, "").replace(/^-+|[\-\s]+$/g, "");
  return !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
}

function cleanNumericValue(value) {
  return value.replace(/[,\s]/g, "").replace(/^-+|[\-\s]+$/g, "");
}

function interpolateValue(data, rowIndex, colIndex) {
  let above = null;
  let below = null;

  for (let i = rowIndex - 1; i >= 0; i--) {
    if (data[i] && data[i][colIndex] && !data[i][colIndex]?.interpolated) {
      above = data[i][colIndex]?.value || null;
      break;
    }
  }

  for (let i = rowIndex + 1; i < data.length; i++) {
    if (data[i] && data[i][colIndex] && !data[i][colIndex]?.interpolated) {
      below = data[i][colIndex]?.value || null;
      break;
    }
  }

  if (above && below) {
    const aboveNum = parseFloat(cleanNumericValue(above));
    const belowNum = parseFloat(cleanNumericValue(below));
    if (!isNaN(aboveNum) && !isNaN(belowNum)) {
      return ((aboveNum + belowNum) / 2).toString();
    }
  }

  if (above) return above;
  if (below) return below;
  return "0";
}

function parseTextToTable(text) {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const rawTable = [];

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

  const maxCols = Math.max(...rawTable.map((row) => row.length));
  const normalizedTable = rawTable.map((row) => {
    const normalizedRow = [];
    for (let i = 0; i < maxCols; i++) {
      const cellValue = row[i];
      if (cellValue && isValidNumber(cellValue)) {
        normalizedRow[i] = {
          value: cleanNumericValue(cellValue),
          interpolated: false,
        };
      } else if (cellValue) {
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

  return normalizedTable.map((row) => row.filter((cell) => cell !== null));
}

// OCR API endpoint
app.post("/api/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
      });
    }

    console.log("Processing file:", req.file.originalname);

    // Read Google Cloud credentials from environment or base64.txt
    let useRealAPI = false;
    let extractedText = "";

    // Check for credentials
    const credentialsBase64 =
      process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64 ||
      (fs.existsSync("./base64.txt")
        ? fs.readFileSync("./base64.txt", "utf8").trim()
        : null);

    if (credentialsBase64) {
      try {
        // Try to use Google Vision API
        const { ImageAnnotatorClient } = require("@google-cloud/vision");

        const credentialsJson = Buffer.from(
          credentialsBase64,
          "base64",
        ).toString("utf-8");
        const credentials = JSON.parse(credentialsJson);

        const visionClient = new ImageAnnotatorClient({
          credentials: credentials,
        });

        const [result] = await visionClient.documentTextDetection({
          image: { content: req.file.buffer },
        });

        const detections = result.textAnnotations;
        if (detections && detections.length > 0) {
          extractedText = detections[0].description || "";
          useRealAPI = true;
          console.log("Successfully used Google Vision API");
        }
      } catch (visionError) {
        console.error("Google Vision API error:", visionError.message);
      }
    }

    // Fallback to mock data
    if (!extractedText.trim()) {
      console.log("Using mock data for demonstration");
      extractedText = `Sample ID\tpH Level\tTemperature\tConcentration\tNotes
S001\t7.2\t25.4\t0.5\tNormal range
S002\t\t24.1\t0.7\tSlightly elevated
S003\t7.0\t\t0.4\tWithin range
S004\t6.8\t26.2\t\tHigh temperature`;
    }

    const tableData = parseTextToTable(extractedText);

    res.json({
      headers:
        tableData.length > 0 ? tableData[0].map((cell) => cell.value) : [],
      rows: tableData.slice(1),
      source: useRealAPI ? "Google Vision API" : "Mock Data",
    });
  } catch (error) {
    console.error("OCR processing error:", error);
    res.status(500).json({
      error: "Failed to process the image",
    });
  }
});

// Export API endpoint
app.post("/api/export", async (req, res) => {
  try {
    const ExcelJS = require("exceljs");
    const tableData = req.body;

    if (!tableData || !Array.isArray(tableData)) {
      return res.status(400).json({
        error: "Invalid request body",
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Lab Table Data");

    const interpolatedFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFCCCCFF" },
    };

    const normalFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFFF" },
    };

    const borderStyle = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };

    for (const [rowIndex, row] of tableData.entries()) {
      const excelRowIndex = rowIndex + 1;

      for (const [columnIndex, cell] of row.entries()) {
        const excelColumnIndex = columnIndex + 1;
        const cellAddress = worksheet.getCell(excelRowIndex, excelColumnIndex);

        cellAddress.value = cell.value;
        cellAddress.fill = cell.interpolated ? interpolatedFill : normalFill;
        cellAddress.border = borderStyle;
        cellAddress.font = {
          name: "Arial",
          size: 10,
          color: { argb: "FF000000" },
        };
        cellAddress.alignment = {
          vertical: "middle",
          horizontal: "center",
        };
      }
    }

    worksheet.columns.forEach((column) => {
      if (column && column.eachCell) {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      }
    });

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `lab-table-export-${timestamp}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");

    await workbook.xlsx.write(res);
    console.log(`Excel file generated: ${filename}`);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({
      error: "Failed to generate Excel file",
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  const hasCredentials = !!(
    process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64 ||
    (fs.existsSync("./base64.txt") &&
      fs.readFileSync("./base64.txt", "utf8").trim())
  );

  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    googleVisionAPI: hasCredentials
      ? "Credentials available"
      : "No credentials",
    credentialsSource: process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64
      ? "Environment"
      : fs.existsSync("./base64.txt")
        ? "base64.txt file"
        : "None",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Development API server running on port ${PORT}`);
  console.log(`📋 OCR API: http://localhost:${PORT}/api/ocr`);
  console.log(`📊 Export API: http://localhost:${PORT}/api/export`);
  console.log(`💗 Health check: http://localhost:${PORT}/api/health`);

  // Check credentials on startup
  const hasCredentials = !!(
    process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64 ||
    (fs.existsSync("./base64.txt") &&
      fs.readFileSync("./base64.txt", "utf8").trim())
  );

  if (hasCredentials) {
    console.log("✅ Google Cloud Vision API credentials found");
  } else {
    console.log("⚠️  No Google Cloud credentials found - using mock data");
  }
});

module.exports = app;
