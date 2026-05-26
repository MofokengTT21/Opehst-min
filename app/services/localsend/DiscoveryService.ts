import dgram from 'react-native-udp';
import { Buffer } from 'buffer';
import { database } from '../../database';
import Device from '../../database/models/Device';

const MULTICAST_ADDR = '224.0.0.167';
const PORT = 53317;

export class DiscoveryService {
  private socket: any;
  private myFingerprint: string;
  private myAlias: string;

  constructor(myAlias: string, myFingerprint: string) {
    this.myAlias = myAlias;
    this.myFingerprint = myFingerprint;
    this.socket = dgram.createSocket({ type: 'udp4', reusePort: true });
  }

  public start() {
    this.socket.bind(PORT, () => {
      console.log('UDP Socket bound to port', PORT);
      try {
        this.socket.addMembership(MULTICAST_ADDR);
      } catch (err) {
        console.warn('Multicast membership error', err);
      }
      this.announce();
    });

    this.socket.on('message', async (msg: Buffer, rinfo: any) => {
      try {
        const payload = JSON.parse(msg.toString());
        if (payload.fingerprint && payload.fingerprint !== this.myFingerprint) {
          console.log('Discovered device:', payload.alias, rinfo.address);
          await this.saveDevice(payload, rinfo.address);
          
          if (payload.announce) {
            // Respond if it was an announcement
            this.respond(rinfo.address);
          }
        }
      } catch (e) {
        // Ignored, not valid JSON or expected LocalSend payload
      }
    });

    this.socket.on('error', (err: any) => {
      console.error('UDP Error:', err);
    });
  }

  public stop() {
    this.socket.close();
  }

  private announce() {
    const message = this.createPayload(true);
    const buffer = Buffer.from(JSON.stringify(message));
    this.socket.send(buffer, 0, buffer.length, PORT, MULTICAST_ADDR, (err: any) => {
      if (err) console.error('Error broadcasting', err);
    });
  }

  private respond(ip: string) {
    // Legacy fallback UDP response or TCP register - sticking to simple UDP reply for discovery
    const message = this.createPayload(false);
    const buffer = Buffer.from(JSON.stringify(message));
    this.socket.send(buffer, 0, buffer.length, PORT, ip, (err: any) => {
      if (err) console.error('Error responding', err);
    });
    // TCP register fallback can be added if needed
  }

  private createPayload(announce: boolean) {
    return {
      alias: this.myAlias,
      version: "2.0",
      deviceModel: "OpehstApp",
      deviceType: "mobile",
      fingerprint: this.myFingerprint,
      port: PORT,
      protocol: "http",
      download: false,
      announce
    };
  }

  private async saveDevice(payload: any, ip: string) {
    await database.write(async () => {
      const devices = await database.collections.get<Device>('devices').query().fetch();
      const existing = devices.find(d => d.fingerprint === payload.fingerprint);
      
      if (existing) {
        await existing.update(device => {
          device.ipAddress = ip;
          device.alias = payload.alias;
          device.lastSeen = new Date();
          device.isOnline = true;
        });
      } else {
        await database.collections.get<Device>('devices').create(device => {
          device.fingerprint = payload.fingerprint;
          device.alias = payload.alias;
          device.ipAddress = ip;
          device.port = payload.port || 53317;
          device.deviceType = payload.deviceType;
          device.deviceModel = payload.deviceModel;
          device.protocol = payload.protocol;
          device.lastSeen = new Date();
          device.isOnline = true;
        });
      }
    });
  }
}
