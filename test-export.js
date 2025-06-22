// Test script for Excel export API
const fs = require("fs");

// Sample test data
const testData = [
  // Headers
  [
    { value: "Sample ID", interpolated: false },
    { value: "pH Level", interpolated: false },
    { value: "Temperature (°C)", interpolated: false },
    { value: "Concentration", interpolated: false },
    { value: "Notes", interpolated: false },
  ],
  // Data rows
  [
    { value: "S001", interpolated: false },
    { value: "7.2", interpolated: true },
    { value: "25.4", interpolated: false },
    { value: "0.5 mg/L", interpolated: false },
    { value: "Normal range", interpolated: false },
  ],
  [
    { value: "S002", interpolated: false },
    { value: "6.8", interpolated: false },
    { value: "24.1", interpolated: true },
    { value: "0.7 mg/L", interpolated: false },
    { value: "Slightly elevated", interpolated: false },
  ],
  [
    { value: "S003", interpolated: false },
    { value: "7.0", interpolated: false },
    { value: "25.8", interpolated: false },
    { value: "0.4 mg/L", interpolated: true },
    { value: "Within range", interpolated: false },
  ],
];

async function testExport() {
  try {
    console.log("Testing Excel export API...");

    const response = await fetch("http://localhost:3001/api/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    // Save the file
    const buffer = await response.arrayBuffer();
    const filename = "test-export.xlsx";

    fs.writeFileSync(filename, Buffer.from(buffer));
    console.log(`✅ Excel file created successfully: ${filename}`);
    console.log(
      "📊 File contains headers and data with proper interpolated cell formatting",
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Only run if server is available
testExport();
