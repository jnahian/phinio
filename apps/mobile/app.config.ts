import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Phinio',
  slug: 'phinio',
  scheme: 'phinio',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'com.phinio.app',
    supportsTablet: true,
  },
  android: {
    package: 'com.phinio.app',
  },
  // iOS 26 deployment target (Liquid Glass requirement) is set via the
  // expo-build-properties plugin at prebuild / EAS build time. We don't add
  // the package in Phase 3A because no native build runs here; Phase 3C
  // installs `expo-build-properties` and `expo-glass-effect` together.
  // react-native-mmkv v4 ships as a Nitro module — autolinking handles
  // the native install; there is no config plugin to register here.
  plugins: ['expo-router'],
  experiments: {
    typedRoutes: true,
  },
}

export default config
