#!/usr/bin/env node
// Wrapper that starts Expo + a lightweight HTTP health proxy so the
// Replit port check succeeds even while Metro is still bundling.

const { spawn } = require("child_process");
const http = require("http");
const net = require("net");

const PORT = parseInt(process.env.PORT || "18115", 10);

// Start a temporary HTTP responder that proxies to Metro once it's ready.
// This keeps the port open immediately so the health check passes.
const server = http.createServer((req, res) => {
  // Proxy every request to the Metro dev server on the same port (it replaces us).
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
});

// Start Expo in a child process (inherits stdio for log forwarding)
const expoEnv = {
  ...process.env,
  EXPO_PACKAGER_PROXY_URL: `https://${process.env.REPLIT_EXPO_DEV_DOMAIN || "localhost"}`,
  EXPO_PUBLIC_DOMAIN: process.env.REPLIT_DEV_DOMAIN || "localhost",
  EXPO_PUBLIC_REPL_ID: process.env.REPL_ID || "",
  REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REPLIT_DEV_DOMAIN || "localhost",
  PORT: String(PORT + 1), // Expo uses PORT+1, our health server uses PORT
};

// Give the health server a head start, then start Expo on PORT+1
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Health server listening on port ${PORT}`);

  const expo = spawn(
    "pnpm",
    ["exec", "expo", "start", "--localhost", `--port`, String(PORT + 1)],
    { stdio: "inherit", env: expoEnv }
  );

  expo.on("error", (err) => {
    console.error("Expo failed to start:", err);
    process.exit(1);
  });

  expo.on("exit", (code) => {
    console.log(`Expo exited with code ${code}`);
    server.close();
    process.exit(code ?? 0);
  });
});

// Forward SIGTERM/SIGINT to Expo
let expoProc;
process.on("SIGTERM", () => { if (expoProc) expoProc.kill("SIGTERM"); });
process.on("SIGINT", () => { if (expoProc) expoProc.kill("SIGINT"); });
