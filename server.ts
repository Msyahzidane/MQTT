import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, createWebSocketStream, Server } from 'ws';
import * as net from 'net';
import * as tls from 'tls';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add API routes here
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  let vite: any;
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // WebSocket Server for MQTT proxying
  const wss = new WebSocketServer({ 
    server, 
    path: '/ably-mqtt-proxy',
    handleProtocols: (protocols) => {
      // Echo back the first requested protocol, usually 'mqtt' or 'mqttv3.1'
      return protocols instanceof Set ? protocols.values().next().value :
             Array.isArray(protocols) && protocols.length ? protocols[0] : false;
    }
  });

  wss.on('connection', (ws, req) => {
    console.log('Proxying MQTT connection to Ably');
    
    // Connect to Ably's strict TLS MQTT server
    const ablySocket = tls.connect({
      host: 'mqtt.ably.io',
      port: 8883,
    });

    const wsStream = createWebSocketStream(ws);

    wsStream.pipe(ablySocket).pipe(wsStream);

    ablySocket.on('error', (err) => {
      console.error('Ably Socket Error:', err);
      ws.close();
    });

    ws.on('error', (err) => {
      console.error('WebSocket Error:', err);
      ablySocket.destroy();
    });

    ws.on('close', () => {
      ablySocket.destroy();
    });

    ablySocket.on('close', () => {
      ws.close();
    });
  });
}

startServer();
