import { initSocket, stopSocket } from './socket';

export function initServices() {
  initSocket();
}

export function stopServices() {
  stopSocket();
}
