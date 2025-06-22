# Excel Export API Documentation

## Overview

The `/api/export` endpoint generates downloadable Excel (.xlsx) files from table data with proper formatting for interpolated cells.

## API Endpoint

**POST `/api/export`**

### Request Format

**Content-Type:** `application/json`

**Body:** 2D array of cell objects where each cell contains:

- `value` (string): The cell content
- `interpolated` (boolean): Whether the value was interpolated by OCR

```json
[
  [
    { "value": "Sample ID", "interpolated": false },
    { "value": "pH Level", "interpolated": false },
    { "value": "Temperature", "interpolated": false }
  ],
  [
    { "value": "S001", "interpolated": false },
    { "value": "7.2", "interpolated": true },
    { "value": "25.4", "interpolated": false }
  ]
]
```

### Response

**Content-Type:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

**Headers:**

- `Content-Disposition: attachment; filename="lab-table-export-YYYY-MM-DD.xlsx"`
- `Cache-Control: no-cache`

**Body:** Binary Excel file (.xlsx format)

## Excel File Features

### Formatting

- **Interpolated cells**: Light blue background (#CCCCFF)
- **Normal cells**: White background
- **All cells**: Black borders, Arial font (size 10), center-aligned
- **Auto-sized columns**: Based on content (min 10, max 50 characters)

### Structure

- Each row from the input array becomes a row in Excel
- First row typically contains headers
- Subsequent rows contain data
- Maintains the exact structure and order of input data

## Error Handling

### 400 Bad Request

```json
{
  "error": "Invalid request body. Expected an array of table rows."
}
```

Possible validation errors:

- Missing or invalid request body
- Non-array input
- Invalid row structure (not arrays)
- Invalid cell structure (missing `value` or `interpolated` properties)

### 500 Internal Server Error

```json
{
  "error": "Failed to generate Excel file. Please try again."
}
```

## Usage Examples

### Frontend JavaScript (Fetch API)

```javascript
async function downloadExcel(tableData) {
  const response = await fetch("/api/export", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tableData),
  });

  if (!response.ok) {
    throw new Error("Export failed");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lab-table-export.xlsx";
  a.click();
  window.URL.revokeObjectURL(url);
}
```

### cURL Command

```bash
curl -X POST http://localhost:3001/api/export \
  -H "Content-Type: application/json" \
  -d '[
    [{"value":"ID","interpolated":false},{"value":"Value","interpolated":false}],
    [{"value":"1","interpolated":false},{"value":"100","interpolated":true}]
  ]' \
  --output lab-table.xlsx
```

### Node.js Test

```bash
# Run the included test script
npm run test:export
```

## Integration with Lab Table Scanner

The frontend automatically formats data correctly for this API:

1. **Headers**: Extracted from `tableData.headers` and converted to cell objects
2. **Data rows**: Taken from `tableData.rows` (already in correct format)
3. **Interpolated formatting**: Automatically applied based on cell properties

The Excel file will show:

- Clear visual distinction between original and interpolated data
- Professional formatting suitable for lab reports
- Proper column sizing and alignment
- Downloadable with timestamp in filename

## Technical Implementation

**Dependencies:**

- `exceljs`: Excel file generation
- `express`: HTTP server framework

**Key Features:**

- Streaming Excel generation (memory efficient)
- Proper MIME type handling
- Cross-browser compatibility
- Comprehensive error validation
- Professional Excel formatting
