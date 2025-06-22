// This is a simple Node.js script that can be run with a local server
// For development purposes only

const fs = require("fs");
const path = require("path");

// Mock Google Vision API response for development
const mockVisionResponse = `Sample ID	pH Level	Temperature	Concentration	Notes
S001	7.2	25.4	0.5	Normal
S002		24.1	0.7	Elevated  
S003	7.0		0.4	Range
S004	6.8	26.2		High`;

// Helper functions (same as in the API)
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

  return normalizedTable.map((row) => row.filter((cell) => cell !== null));
}

// Export for demonstration
console.log("Mock OCR API Response:");
const tableData = parseTextToTable(mockVisionResponse);
console.log({
  headers: tableData.length > 0 ? tableData[0].map((cell) => cell.value) : [],
  rows: tableData.slice(1),
});
