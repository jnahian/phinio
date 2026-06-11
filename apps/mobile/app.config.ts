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
  // react-native-mmkv v4 ships as a Nitro module — autolinking handles
  // the native install; there is no config plugin to register here.
  plugins: [
    'expo-router',
    'expo-notifications',
    [
      'expo-build-properties',
      {
        ios: {
          // Liquid Glass primitives (`expo-glass-effect`) require iOS 26+.
          deploymentTarget: '26.0',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
}

export default config
