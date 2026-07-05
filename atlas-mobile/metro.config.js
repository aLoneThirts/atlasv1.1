// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// shared/yks-calc.ts repo kökünde yaşıyor (Edge Function'la aynı dosyayı
// paylaşmak için, bkz. shared/yks-calc.ts başlığı) — Metro varsayılan olarak
// yalnız projectRoot'u izler, bu yüzden repo kökünü de watchFolders'a ekliyoruz.
config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
