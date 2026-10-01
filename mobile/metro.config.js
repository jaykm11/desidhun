const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', 'web');

const config = getDefaultConfig(projectRoot);

// The raga, genre, tempo and billing tables in ../web are the shared source of
// truth for the API and every client, so Metro has to watch them too.
config.watchFolders = [sharedRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
