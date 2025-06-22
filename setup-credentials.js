const fs = require("fs");

try {
  // Read the base64 file
  const base64Content = fs.readFileSync("base64.txt", "utf8");

  // Clean the base64 content (remove all whitespace and special characters)
  const cleanedBase64 = base64Content.replace(/[^A-Za-z0-9+/=]/g, "");

  console.log("Original length:", base64Content.length);
  console.log("Cleaned base64 length:", cleanedBase64.length);

  // Verify it's valid base64 and JSON
  const decoded = Buffer.from(cleanedBase64, "base64").toString("utf8");
  const json = JSON.parse(decoded);

  console.log("✅ Valid Google Cloud credentials detected");
  console.log("Project ID:", json.project_id);
  console.log("Client Email:", json.client_email);

  // Write cleaned base64 for easy copying
  fs.writeFileSync("credentials-clean.txt", cleanedBase64);
  console.log("✅ Clean base64 written to credentials-clean.txt");

  // Also write the JSON for verification
  fs.writeFileSync("credentials.json", JSON.stringify(json, null, 2));
  console.log("✅ JSON credentials written to credentials.json");
} catch (error) {
  console.error("❌ Error processing credentials:", error.message);
  process.exit(1);
}
