import { VercelRequest, VercelResponse } from "@vercel/node";
import ExcelJS from "exceljs";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
}
