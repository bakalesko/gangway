const fs = require("fs");

// Read the base64 file
const base64Content = fs.readFileSync("base64.txt", "utf8");

// Clean the base64 content (remove spaces, newlines, etc.)
const cleanedBase64 = base64Content.replace(/\s/g, "");

console.log("Cleaned base64 length:", cleanedBase64.length);
console.log("First 100 characters:", cleanedBase64.substring(0, 100));

// Try to decode and verify it's valid JSON
try {
  const decoded = Buffer.from(cleanedBase64, "base64").toString("utf8");
  const json = JSON.parse(decoded);
  console.log("✅ Valid credentials file detected");
  console.log("Project ID:", json.project_id);
  console.log("Client Email:", json.client_email);

  // Write the cleaned base64 to a separate file
  fs.writeFileSync("credentials-clean.txt", cleanedBase64);
  console.log("✅ Clean credentials written to credentials-clean.txt");
} catch (error) {
  console.error("❌ Error decoding credentials:", error.message);
}
