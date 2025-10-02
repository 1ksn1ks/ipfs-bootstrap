import { createHelia } from 'helia';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import { bootstrap } from '@libp2p/bootstrap';
import { identify } from '@libp2p/identify';
import { kadDHT } from '@libp2p/kad-dht';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { createLibp2p } from 'libp2p';
import { ping } from '@libp2p/ping';
import http from 'http';

const bootstrapList = [];  // Self-bootstrap

// HTTP server for health checks & WS upgrades
const httpServer = http.createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }
  res.writeHead(404);
  res.end();
});

httpServer.on('upgrade', (req, socket, head) => {
  console.log('WS upgrade requested:', req.url);
});

const libp2pConfig = {
  transports: [
    webSockets({ server: httpServer, upgrade: true }),
    tcp(),
    circuitRelayTransport()
  ],
  connectionEncryption: [noise()],
  streamMuxers: [mplex()],
  peerDiscovery: [],
  services: {
    identify: identify(),
    dht: kadDHT({ clientMode: false }),
    relay: circuitRelayServer(),
    ping: ping()
  },
  addresses: {
    listen: [
      `/ip4/0.0.0.0/tcp/0/ws`,
      `/ip4/127.0.0.1/tcp/0`
    ]
  }
};

const libp2p = await createLibp2p(libp2pConfig);  // Import from 'libp2p'
const helia = await createHelia({ libp2p });

console.log('Bootstrap Peer ID:', helia.libp2p.peerId.toString());
console.log('Multiaddrs:', helia.libp2p.getMultiaddrs().map(ma => ma.toString()));

helia.libp2p.addEventListener('peer:connect', (evt) => {
  console.log('Client connected:', evt.detail.toString());
});

helia.libp2p.addEventListener('peer:disconnect', (evt) => {
  console.log('Disconnected:', evt.detail.toString());
});

// Listen on DO's PORT
const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP/WS server on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await helia.stop();
  process.exit(0);
});

console.log('DO App Platform bootstrap ready!');