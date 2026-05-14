const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite@16 uses wa-sqlite which compiles to WebAssembly.
// Metro doesn't resolve .wasm files by default — add it as an asset.
config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];

module.exports = config;
