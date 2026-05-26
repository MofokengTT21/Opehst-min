import { database } from '../../database';
import Device from '../../database/models/Device';

export class SyncClient {
  public async pushToDiscoveredPeers(delta: any) {
    const devices = await database.collections.get<Device>('devices').query().fetch();
    
    for (const device of devices) {
      if (device.isOnline && device.ipAddress) {
        this.pushToDevice(device, delta);
      }
    }
  }

  private async pushToDevice(device: Device, delta: any) {
    try {
      const url = `http://${device.ipAddress}:${device.port}/opehst/sync`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(delta)
      });
      
      if (response.ok) {
        console.log(`Successfully pushed delta to ${device.alias} (${device.ipAddress})`);
      } else {
        console.warn(`Failed to push delta to ${device.alias}: ${response.status}`);
      }
    } catch (e) {
      console.warn(`Error pushing to ${device.alias}`, e);
    }
  }

  public async uploadFile(device: Device, fileUri: string, metadata: any) {
    try {
      // 1. Prepare Upload
      const prepareUrl = `http://${device.ipAddress}:${device.port}/api/localsend/v2/prepare-upload`;
      const preparePayload = {
        info: {
          alias: "OpehstApp",
          version: "2.0",
          deviceModel: "Mobile",
          deviceType: "mobile",
          fingerprint: "my-device-fingerprint", // Should use actual fingerprint
          port: 53317,
          protocol: "http",
          download: false
        },
        files: {
          [metadata.id]: {
            id: metadata.id,
            fileName: metadata.fileName,
            size: metadata.size,
            fileType: metadata.fileType
          }
        }
      };

      const prepareResponse = await fetch(prepareUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preparePayload)
      });

      if (!prepareResponse.ok) {
        throw new Error('Prepare upload failed');
      }

      const prepareResult = await prepareResponse.json();
      const sessionId = prepareResult.sessionId;
      const fileToken = prepareResult.files[metadata.id];

      // 2. Upload File (In a real implementation, we'd stream the file bytes using expo-file-system or similar)
      const uploadUrl = `http://${device.ipAddress}:${device.port}/api/localsend/v2/upload?sessionId=${sessionId}&fileId=${metadata.id}&token=${fileToken}`;
      
      // Simulating upload for now. In production, use FileSystem.uploadAsync
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: "Simulated file content" // This should be the actual file blob/stream
      });

      if (uploadResponse.ok) {
        console.log(`File ${metadata.fileName} uploaded successfully to ${device.alias}`);
      }
    } catch (e) {
      console.error(`File upload error to ${device.alias}`, e);
    }
  }
}
