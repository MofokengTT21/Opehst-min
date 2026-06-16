import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getApiUrl = () => {
  // Try to use the Expo packager host dynamically (works during development on LAN)
  // This automatically adapts when your local IP changes!
  let hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
  
  if (!hostUri && Constants.manifest2?.extra?.expoGo?.hostUri) {
    hostUri = Constants.manifest2.extra.expoGo.hostUri;
  }

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:3000`;
  }
  
  // Fallback if hostUri is not available
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000'; // Default Android emulator loopback
  }

  return 'http://localhost:3000'; // Default iOS simulator / web
};

export const API_BASE_URL = getApiUrl();
export const API_AUTH_URL = `${API_BASE_URL}/api/auth`;
