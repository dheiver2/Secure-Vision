'use-strict';

import http from 'http';
import { io as ioclient } from 'socket.io-client';
import Server from '../../src/api/index.js';
import SocketServer from '../../src/api/socket.js';
import Database from '../../src/api/database.js';

let server;
let socket;
let port;

beforeAll(async () => {
  const database = new Database();
  await database.prepareDatabase();
  await Database.resetDatabase();
  await database.prepareDatabase();

  // Create server and attach socket
  const controller = new (await import('events')).EventEmitter();
  server = new Server(controller);
  socket = new SocketServer(server);

  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });
});

afterAll(async () => {
  // Stop background watchers to avoid open handles
  SocketServer.stopWatchSystem?.();
  await new Promise((resolve) => server.close(resolve));
});

describe('Socket anonymous connection', () => {
  it('connects without Bearer token and stays connected', async () => {
    const client = ioclient(`http://localhost:${port}`, {
      transports: ['websocket'],
      autoConnect: true,
      timeout: 5000,
    });

    const connected = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 7000);
      client.on('connect', () => {
        clearTimeout(timer);
        resolve(true);
      });
      client.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    expect(connected).toBe(true);

    // Ensure not unauthenticated
    let unauth = false;
    client.on('unauthenticated', () => (unauth = true));
    await new Promise((r) => setTimeout(r, 500));
    expect(unauth).toBe(false);

    await new Promise((resolve) => {
      client.on('disconnect', resolve);
      client.close();
    });
  });
});