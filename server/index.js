/**
 * Novaterm Server Entry Point
 * Modular Socket.IO server for SSH terminal management
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');
const next = require('next');
const { Server } = require('socket.io');
const path = require('path');

// Session Manager
const sessionManager = require('./session/SessionManager');

// Handlers
const SSHHandler = require('./handlers/ssh.handler');
const SFTPHandler = require('./handlers/sftp.handler');
const MonitoringHandler = require('./handlers/monitoring.handler');
const LogsHandler = require('./handlers/logs.handler');
const NetworkHandler = require('./handlers/network.handler');
const CTFHandler = require('./handlers/ctf.handler');
const PackageHandler = require('./handlers/package.handler');
const ScriptHandler = require('./handlers/script.handler');

/**
 * Start the server
 */
async function start() {
  const dev = process.env.NODE_ENV !== 'production';
  
  // Initialize Next.js with parent directory as root
  const app = next({ dev, dir: path.resolve(__dirname, '..') });
  const handle = app.getRequestHandler();

  await app.prepare();
  console.log('[Server] Next.js prepared');

  // Create HTTP server
  const server = http.createServer((req, res) => handle(req, res));

  // Initialize Socket.IO
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  console.log('[Server] Socket.IO initialized');

  // Handle connections
  io.on('connection', (socket) => {
    console.log(`[Server] Client connected: ${socket.id}`);

    // Initialize SSH handler first (required by other handlers)
    const sshHandler = new SSHHandler(socket, sessionManager);

    // Initialize all handlers with dependencies
    const handlers = {
      ssh: sshHandler,
      sftp: new SFTPHandler(socket, sessionManager, sshHandler),
      monitoring: new MonitoringHandler(socket, sessionManager, sshHandler),
      logs: new LogsHandler(socket, sessionManager, sshHandler),
      network: new NetworkHandler(socket, sessionManager, sshHandler),
      ctf: new CTFHandler(socket, sessionManager, sshHandler),
      package: new PackageHandler(socket, sessionManager, sshHandler),
      script: new ScriptHandler(socket, sessionManager, sshHandler),
    };

    // Register all event handlers
    Object.values(handlers).forEach(handler => {
      if (typeof handler.register === 'function') {
        handler.register();
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      console.log(`[Server] Client disconnected: ${socket.id}`);
      
      Object.values(handlers).forEach(handler => {
        if (typeof handler.cleanup === 'function') {
          handler.cleanup();
        }
      });
    });
  });

  // Start listening
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`[Server] Ready on http://localhost:${port}`);
    console.log(`[Server] Environment: ${dev ? 'development' : 'production'}`);
  });
}

// Start the server
start().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});

