// Metro config — monorepo aware.
// Without watchFolders + nodeModulesPaths, Metro can't resolve workspace
// packages (@phinio/trpc, etc.) symlinked from the root node_modules.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// 1. Watch all files in the monorepo
config.watchFolders = [workspaceRoot]

// 2. Resolve modules from both the local app and the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// 3. Force resolution to a single copy of duplicated deps in pnpm hoisting
config.resolver.disableHierarchicalLookup = true

// 4. Workspace packages (@phinio/calc, @phinio/trpc) use NodeNext ESM
// imports — `./emi.js` on disk is `emi.ts`. Metro resolves literally, so
// retry failed relative `.js` requests without the extension and let
// sourceExts find the TypeScript source.
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest
  try {
    return resolve(context, moduleName, platform)
  } catch (error) {
    if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
      return resolve(context, moduleName.slice(0, -3), platform)
    }
    throw error
  }
}

module.exports = config
