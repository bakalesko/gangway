#!/usr/bin/env node

const http = require("http");

console.log("🔍 Testing Lab Table Scanner application...\n");

// Test dev server
const testDevServer = () => {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:8080", (res) => {
      console.log("✅ Dev server responding:", res.statusCode);
      console.log("   Content-Type:", res.headers["content-type"]);
      resolve(true);
    });

    req.on("error", (err) => {
      console.log("❌ Dev server not responding:", err.message);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log("⏰ Dev server timeout (5s)");
      req.destroy();
      resolve(false);
    });
  });
};

// Test health API (if dev server includes api proxy)
const testHealthAPI = () => {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:8080/api/health", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("✅ Health API responding:", res.statusCode);
          console.log("   Status:", parsed.status);
          console.log("   Message:", parsed.message);
          resolve(true);
        } catch (e) {
          console.log("❌ Health API invalid JSON");
          resolve(false);
        }
      });
    });

    req.on("error", (err) => {
      console.log(
        "ℹ️  Health API not available (expected in dev):",
        err.message,
      );
      resolve(true); // Not an error in dev environment
    });

    req.setTimeout(3000, () => {
      console.log("ℹ️  Health API timeout (expected in dev)");
      req.destroy();
      resolve(true);
    });
  });
};

async function runTests() {
  console.log("Testing development server...");
  const devOk = await testDevServer();

  console.log("\nTesting health API...");
  await testHealthAPI();

  console.log("\n" + "=".repeat(50));
  if (devOk) {
    console.log("🎉 Application appears to be working correctly!");
    console.log("📱 Open http://localhost:8080 in your browser");
    console.log("🚀 For Vercel deployment, push to GitHub and check:");
    console.log("   1. Build logs in Vercel dashboard");
    console.log("   2. Function logs for API endpoints");
    console.log("   3. Try /api/health endpoint after deployment");
  } else {
    console.log("⚠️  Issues detected. Check:");
    console.log("   1. Is the dev server running? (npm run dev)");
    console.log("   2. Check console for errors");
    console.log("   3. Try restarting the dev server");
  }
}

runTests().catch(console.error);
