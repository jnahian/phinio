// IMPORTANT: `react-native-reanimated/plugin` MUST stay last in the
// `plugins` array — Reanimated's worklet transform relies on running
// after every other plugin that touches function bodies. Anything new
// must be inserted BEFORE it.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  }
}
