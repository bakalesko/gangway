#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function cleanCredentials() {
  const base64File = path.join(__dirname, "..", "base64.txt");

  if (!fs.existsSync(base64File)) {
    console.error("❌ base64.txt file not found");
    process.exit(1);
  }

  try {
    console.log("📖 Reading base64.txt...");
    const base64Content = fs.readFileSync(base64File, "utf8");

    console.log("🧹 Cleaning base64 content...");
    // Remove all whitespace, spaces, newlines, and other non-base64 characters
    const cleanedBase64 = base64Content.replace(/[^A-Za-z0-9+/=]/g, "");

    console.log(`📏 Original length: ${base64Content.length}`);
    console.log(`📏 Cleaned length: ${cleanedBase64.length}`);

    // Verify it's valid base64 and JSON
    console.log("🔍 Validating credentials...");
    const decoded = Buffer.from(cleanedBase64, "base64").toString("utf8");
    const json = JSON.parse(decoded);

    // Verify it's a valid Google Cloud service account
    if (json.type !== "service_account") {
      throw new Error("Not a service account credential file");
    }

    if (!json.project_id || !json.client_email || !json.private_key) {
      throw new Error("Missing required fields in credentials");
    }

    console.log("✅ Credentials validated successfully!");
    console.log(`🏷️  Project ID: ${json.project_id}`);
    console.log(`📧 Client Email: ${json.client_email}`);

    // Write the cleaned base64 to a new file
    const cleanFile = path.join(__dirname, "..", "credentials-clean.txt");
    fs.writeFileSync(cleanFile, cleanedBase64);
    console.log(`💾 Clean base64 saved to: ${cleanFile}`);

    // Also create a proper JSON file for reference
    const credentialsFile = path.join(__dirname, "..", "credentials.json");
    fs.writeFileSync(credentialsFile, JSON.stringify(json, null, 2));
    console.log(`💾 JSON credentials saved to: ${credentialsFile}`);

    // Output the environment variable value
    console.log(
      "\n🔧 To use these credentials, set this environment variable:",
    );
    console.log(`GOOGLE_CLOUD_CREDENTIALS_BASE64="${cleanedBase64}"`);

    return cleanedBase64;
  } catch (error) {
    console.error("❌ Error processing credentials:", error.message);
    process.exit(1);
  }
}

// Run the cleanup
if (require.main === module) {
  cleanCredentials();
}

module.exports = cleanCredentials;
