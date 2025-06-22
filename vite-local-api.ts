import { Plugin } from "vite";
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

// Types
interface TableCell {
  value: string;
  interpolated: boolean;
}

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
function isValidNumber(value: string): boolean {
  const cleaned = value.replace(/[,\s]/g, "").replace(/^-+|[\-\s]+$/g, "");
  return !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
}

function cleanNumericValue(value: string): string {
  return value.replace(/[,\s]/g, "").replace(/^-+|[\-\s]+$/g, "");
}

function interpolateValue(
  data: (TableCell | null)[][],
  rowIndex: number,
  colIndex: number,
): string {
  let above: string | null = null;
  let below: string | null = null;

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

function parseTextToTable(text: string): TableCell[][] {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const rawTable: (string | null)[][] = [];

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

  return normalizedTable.map((row) =>
    row.filter((cell): cell is TableCell => cell !== null),
  );
}

export function localApiPlugin(): Plugin {
  return {
    name: "local-api",
    configureServer(server) {
      // Add API routes to Vite dev server
      server.middlewares.use("/api", express.json());

      // OCR endpoint
      server.middlewares.use(
        "/api/ocr",
        upload.single("file"),
        async (req: any, res: any) => {
          try {
            if (req.method !== "POST") {
              return res.status(405).json({ error: "Method not allowed" });
            }

            if (!req.file) {
              return res.status(400).json({
                error: "No file uploaded",
              });
            }

            console.log("🔍 Processing file:", req.file.originalname);

            // Check for Google Cloud credentials
            let useRealAPI = false;
            let extractedText = "";

            const credentialsBase64 =
              process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64 ||
              (fs.existsSync("./base64.txt")
                ? fs.readFileSync("./base64.txt", "utf8").trim()
                : null);

            if (credentialsBase64) {
              try {
                // Dynamically import Google Vision API
                const { ImageAnnotatorClient } = await import(
                  "@google-cloud/vision"
                );

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
                  console.log("✅ Successfully used Google Vision API");
                }
              } catch (visionError) {
                console.error(
                  "❌ Google Vision API error:",
                  visionError.message,
                );
              }
            }

            // Fallback to enhanced mock data
            if (!extractedText.trim()) {
              console.log("📊 Using enhanced mock data");
              extractedText = `Sample ID\tpH Level\tTemperature (°C)\tConcentration\tNotes
S001\t7.2\t25.4\t0.5 mg/L\tNormal range
S002\t\t24.1\t0.7 mg/L\tSlightly elevated  
S003\t7.0\t\t0.4 mg/L\tWithin range
S004\t6.8\t26.2\t\tHigh temperature
S005\t7.1\t25.0\t0.6 mg/L\tOptimal conditions`;
            }

            const tableData = parseTextToTable(extractedText);

            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                headers:
                  tableData.length > 0
                    ? tableData[0].map((cell) => cell.value)
                    : [],
                rows: tableData.slice(1),
                source: useRealAPI ? "Google Vision API" : "Mock Data",
                credentialsFound: !!credentialsBase64,
              }),
            );
          } catch (error) {
            console.error("❌ OCR processing error:", error);
            res.status(500).json({
              error: "Failed to process the image",
            });
          }
        },
      );

      // Export endpoint
      server.middlewares.use("/api/export", async (req: any, res: any) => {
        try {
          if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
          }

          // Read body manually for JSON
          let body = "";
          req.on("data", (chunk: any) => (body += chunk));
          req.on("end", async () => {
            try {
              const tableData = JSON.parse(body);

              if (!tableData || !Array.isArray(tableData)) {
                return res.status(400).json({
                  error: "Invalid request body",
                });
              }

              // Dynamically import ExcelJS
              const ExcelJS = await import("exceljs");
              const workbook = new ExcelJS.Workbook();
              const worksheet = workbook.addWorksheet("Lab Table Data");

              const interpolatedFill = {
                type: "pattern" as const,
                pattern: "solid" as const,
                fgColor: { argb: "FFCCCCFF" },
              };

              const normalFill = {
                type: "pattern" as const,
                pattern: "solid" as const,
                fgColor: { argb: "FFFFFFFF" },
              };

              const borderStyle = {
                top: { style: "thin" as const },
                left: { style: "thin" as const },
                bottom: { style: "thin" as const },
                right: { style: "thin" as const },
              };

              for (const [rowIndex, row] of tableData.entries()) {
                const excelRowIndex = rowIndex + 1;
                for (const [columnIndex, cell] of row.entries()) {
                  const excelColumnIndex = columnIndex + 1;
                  const cellAddress = worksheet.getCell(
                    excelRowIndex,
                    excelColumnIndex,
                  );

                  cellAddress.value = cell.value;
                  cellAddress.fill = cell.interpolated
                    ? interpolatedFill
                    : normalFill;
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
                    const columnLength = cell.value
                      ? cell.value.toString().length
                      : 10;
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
              res.setHeader(
                "Content-Disposition",
                `attachment; filename="${filename}"`,
              );
              res.setHeader("Cache-Control", "no-cache");

              await workbook.xlsx.write(res);
              console.log(`📊 Excel file generated: ${filename}`);
            } catch (parseError) {
              console.error("❌ Export error:", parseError);
              res.status(500).json({
                error: "Failed to generate Excel file",
              });
            }
          });
        } catch (error) {
          console.error("❌ Export error:", error);
          res.status(500).json({
            error: "Failed to generate Excel file",
          });
        }
      });

      // Health check endpoint
      server.middlewares.use("/api/health", (req: any, res: any) => {
        const hasCredentials = !!(
          process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64 ||
          (fs.existsSync("./base64.txt") &&
            fs.readFileSync("./base64.txt", "utf8").trim())
        );

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
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
          }),
        );
      });
    },
  };
}
