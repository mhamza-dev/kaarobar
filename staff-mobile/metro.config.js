// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');

const {getDefaultConfig} = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(workspaceRoot, 'shared');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// `shared/` lives outside this project directory, so Metro must be told to watch
// it — otherwise edits there don't trigger a reload and imports fail to resolve.
config.watchFolders = [sharedRoot];

// `shared/` has no node_modules of its own, so bare specifiers inside it cannot
// be resolved by walking up. Add this app's node_modules as an extra search
// path — every dependency shared code uses (react-native, expo-*, formik, yup)
// then comes from whichever app is bundling it.
//
// Note: hierarchical lookup stays ON. Disabling it breaks packages that ship
// nested dependencies (react-native-reanimated bundles its own `semver`).
config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths ?? []),
  path.resolve(projectRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@shared': path.resolve(sharedRoot, 'mobile'),
  '@core': path.resolve(sharedRoot, 'core'),
};

module.exports = config;
