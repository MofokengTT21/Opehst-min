import { Platform } from 'react-native';

let discoveryService: any = null;
let syncServer: any = null;
let initialized = false;

export function initServices() {
  if (initialized) return;

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    console.log('LocalSend services are disabled on non-native platform:', Platform.OS);
    return;
  }

  initialized = true;

  console.log('Initializing LocalSend services...');
  console.log('UI First Mode: LocalSend services are temporarily silenced.');
  return;
  
  try {
    const { DiscoveryService } = require('./localsend/DiscoveryService');
    const { SyncServer } = require('./localsend/SyncServer');

    // We should use actual device info for alias and fingerprint in production
    const myAlias = 'OpehstApp';
    const myFingerprint = 'fingerprint-' + Math.random().toString(36).substring(7);

    discoveryService = new DiscoveryService(myAlias, myFingerprint);
    syncServer = new SyncServer(myAlias, myFingerprint);

    syncServer.start();
    discoveryService.start();
  } catch (e) {
    console.error('Failed to initialize LocalSend services:', e);
  }
}

export function stopServices() {
  if (!initialized) return;
  
  try {
    if (discoveryService) {
      discoveryService.stop();
    }
    if (syncServer) {
      syncServer.stop();
    }
  } catch (e) {
    console.error('Failed to stop LocalSend services:', e);
  }
  
  initialized = false;
}

