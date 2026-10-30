import { ConfigContext, ExpoConfig } from 'expo/config';

// Extiende app.json. Android bloquea HTTP sin cifrar en las versiones instalables:
// se permite solo cuando la API es http:// (pruebas en la red local); con https:// (VPS) queda bloqueado.
export default ({ config }: ConfigContext): ExpoConfig => {
  const apiHttp = (process.env.EXPO_PUBLIC_API_URL ?? '').startsWith('http://');
  return {
    ...(config as ExpoConfig),
    plugins: [...(config.plugins ?? []), ['expo-build-properties', { android: { usesCleartextTraffic: apiHttp } }]],
  };
};
