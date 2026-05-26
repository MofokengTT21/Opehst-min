const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Add wasm asset support for SQLite web driver
config.resolver.assetExts.push('wasm');

// Add security headers required by WebAssembly / SharedArrayBuffer locally
config.server = config.server || {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return middleware(req, res, next);
  };
};

// Ignore better-sqlite3 (NodeJS adapter for WatermelonDB) on mobile
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'better-sqlite3') {
    return {
      type: 'empty',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
