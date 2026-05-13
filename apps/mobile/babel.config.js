// IMPORTANT: When Reanimated is added in Phase 3C, its plugin
// (`react-native-reanimated/plugin`) must be the LAST entry in `plugins`.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
  }
}
