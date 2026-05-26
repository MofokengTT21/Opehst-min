import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
import { applySyncChanges } from '../../database/sync';
import { database } from '../../database';
import Device from '../../database/models/Device';

const PORT = 53317;

export class SyncServer {
  private server: any;
  private myAlias: string;
  private myFingerprint: string;

  constructor(myAlias: string, myFingerprint: string) {
    this.myAlias = myAlias;
    this.myFingerprint = myFingerprint;
  }

  public start() {
    this.server = TcpSocket.createServer((socket) => {
      let dataBuffer = Buffer.alloc(0);

      socket.on('data', (data: any) => {
        // Simple HTTP parser
        const chunk = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
        dataBuffer = Buffer.concat([dataBuffer, chunk]);
        
        // Check if headers are fully received
        const headerEndIndex = dataBuffer.indexOf('\r\n\r\n');
        if (headerEndIndex !== -1) {
          const headersStr = dataBuffer.toString('utf8', 0, headerEndIndex);
          const [requestLine, ...headerLines] = headersStr.split('\r\n');
          const [method, url, httpVersion] = requestLine.split(' ');

          const headers: Record<string, string> = {};
          headerLines.forEach(line => {
            const separator = line.indexOf(':');
            if (separator !== -1) {
              const key = line.substring(0, separator).trim().toLowerCase();
              const value = line.substring(separator + 1).trim();
              headers[key] = value;
            }
          });

          const contentLength = parseInt(headers['content-length'] || '0', 10);
          const bodyStart = headerEndIndex + 4;

          // If we have the full body
          if (dataBuffer.length >= bodyStart + contentLength) {
            const bodyBuffer = Buffer.from(dataBuffer.subarray(bodyStart, bodyStart + contentLength));
            
            this.handleRequest(method, url, headers, bodyBuffer, socket);
            
            // Note: Keep-alive is ignored for now, we close the socket after response
          }
        }
      });

      socket.on('error', (error) => {
        console.error('Socket Error:', error);
      });
    });

    this.server.listen({ port: PORT, host: '0.0.0.0' }, () => {
      console.log(`SyncServer running on port ${PORT}`);
    });

    this.server.on('error', (error: any) => {
      console.error('SyncServer Error:', error);
    });
  }

  public stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private handleRequest(method: string, url: string, headers: any, body: Buffer, socket: any) {
    const parsedUrl = new URL(`http://localhost${url}`);
    const path = parsedUrl.pathname;

    console.log(`Incoming request: ${method} ${path}`);

    if (path === '/opehst/sync' && method === 'POST') {
      this.handleSyncPush(body, socket);
    } else if (path === '/api/localsend/v2/register' && method === 'POST') {
      this.handleLocalSendRegister(body, socket);
    } else if (path === '/api/localsend/v2/prepare-upload' && method === 'POST') {
      this.handlePrepareUpload(body, socket);
    } else if (path === '/api/localsend/v2/upload' && method === 'POST') {
      const sessionId = parsedUrl.searchParams.get('sessionId');
      const fileId = parsedUrl.searchParams.get('fileId');
      const token = parsedUrl.searchParams.get('token');
      this.handleUpload(sessionId, fileId, token, body, socket);
    } else {
      this.sendResponse(socket, 404, 'Not Found');
    }
  }

  private async handleSyncPush(body: Buffer, socket: any) {
    try {
      const payload = JSON.parse(body.toString());
      console.log('Received Sync Delta', payload);
      
      if (payload.changes) {
        await applySyncChanges(payload.changes);
      }
      
      this.sendResponse(socket, 200, 'OK', { success: true });
    } catch (e) {
      console.error('Error handling sync push:', e);
      this.sendResponse(socket, 400, 'Bad Request');
    }
  }

  private async handleLocalSendRegister(body: Buffer, socket: any) {
    try {
      const payload = JSON.parse(body.toString());
      console.log('Received LocalSend Register', payload);
      
      const ip = socket.remoteAddress || '127.0.0.1';
      
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

      this.sendResponse(socket, 200, 'OK', {
        alias: this.myAlias,
        version: '2.0',
        deviceModel: 'OpehstApp',
        deviceType: 'mobile',
        fingerprint: this.myFingerprint,
        download: false
      });
    } catch (e) {
      console.error('Error handling register:', e);
      this.sendResponse(socket, 400, 'Bad Request');
    }
  }

  private handlePrepareUpload(body: Buffer, socket: any) {
    try {
      const payload = JSON.parse(body.toString());
      console.log('Received Prepare Upload', payload);
      
      const responseFiles: Record<string, string> = {};
      if (payload.files) {
        for (const fileId in payload.files) {
          // Generate a token for each file
          responseFiles[fileId] = `token-${fileId}`; 
        }
      }

      this.sendResponse(socket, 200, 'OK', {
        sessionId: `session-${Date.now()}`,
        files: responseFiles
      });
    } catch (e) {
      this.sendResponse(socket, 400, 'Bad Request');
    }
  }

  private handleUpload(sessionId: string | null, fileId: string | null, token: string | null, body: Buffer, socket: any) {
    console.log(`Received Upload for session ${sessionId}, file ${fileId}`);
    // TODO: Save body buffer to file system (expo-file-system)
    this.sendResponse(socket, 200, 'OK');
  }

  private sendResponse(socket: any, statusCode: number, statusMessage: string, bodyObj?: any) {
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : '';
    const headers = [
      `HTTP/1.1 ${statusCode} ${statusMessage}`,
      'Connection: close',
      'Content-Type: application/json',
      `Content-Length: ${Buffer.byteLength(bodyStr)}`,
      '',
      bodyStr
    ].join('\r\n');

    socket.write(headers, () => {
      socket.destroy();
    });
  }
}
