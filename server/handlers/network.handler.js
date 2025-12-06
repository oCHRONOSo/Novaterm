/**
 * Network Monitoring Handler
 * Handles network interfaces, connections, port scanning, and discovery
 */
const NetworkCollector = require('../services/NetworkCollector');
const PortScanner = require('../services/PortScanner');
const config = require('../config');

class NetworkHandler {
  constructor(socket, sessionManager, sshHandler) {
    this.socket = socket;
    this.sessionManager = sessionManager;
    this.sshHandler = sshHandler;
    this.interval = null;
    this.prevNetStats = {};
  }

  /**
   * Get current session
   * @returns {object|null}
   */
  getSession() {
    return this.sshHandler.getSession();
  }

  /**
   * Start network monitoring
   * @param {object} params - Start parameters
   */
  start({ interval }) {
    const session = this.getSession();
    if (!session) {
      this.socket.emit('network.error', 'No active session');
      return;
    }

    // Stop any existing monitoring
    this.stop();

    const collect = () => {
      NetworkCollector.collect(session, (data) => {
        this.socket.emit('network.interfaces', data.interfaces || []);
        this.socket.emit('network.connections', data.connections || []);

        // Calculate bandwidth
        if (data.interfaces) {
          data.interfaces.forEach(iface => {
            const prev = this.prevNetStats[iface.name];
            if (prev) {
              const timeDiff = (Date.now() - prev.timestamp) / 1000;
              this.socket.emit('network.bandwidth', {
                timestamp: Date.now(),
                interface: iface.name,
                rxBytesPerSec: (iface.rxBytes - prev.rxBytes) / timeDiff,
                txBytesPerSec: (iface.txBytes - prev.txBytes) / timeDiff,
              });
            }
            this.prevNetStats[iface.name] = {
              rxBytes: iface.rxBytes,
              txBytes: iface.txBytes,
              timestamp: Date.now(),
            };
          });
        }
      });
    };

    // Initial collection
    collect();
    this.interval = setInterval(collect, interval || config.MONITORING_DEFAULT_INTERVAL);
  }

  /**
   * Stop network monitoring
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Refresh network data once
   */
  refresh() {
    const session = this.getSession();
    if (!session) return;

    NetworkCollector.collect(session, (data) => {
      this.socket.emit('network.interfaces', data.interfaces || []);
      this.socket.emit('network.connections', data.connections || []);
    });
  }

  /**
   * Scan ports on a target
   * @param {object} params - Scan parameters
   */
  scan({ target, ports }) {
    const session = this.getSession();
    if (!session?.shellStream) {
      this.socket.emit('network.error', 'No active session');
      return;
    }

    PortScanner.scan(session, target, ports, this.socket);
  }

  /**
   * Discover network devices
   */
  discover() {
    const session = this.getSession();
    if (!session?.sftp) {
      this.socket.emit('network.error', 'No active session');
      return;
    }

    NetworkCollector.discover(session, (err, nodes) => {
      if (err) {
        this.socket.emit('network.error', err);
      } else {
        this.socket.emit('network.discovery', nodes);
      }
    });
  }

  /**
   * Register socket event handlers
   */
  register() {
    this.socket.on('network.start', (params) => this.start(params));
    this.socket.on('network.stop', () => this.stop());
    this.socket.on('network.refresh', () => this.refresh());
    this.socket.on('network.scan', (params) => this.scan(params));
    this.socket.on('network.discover', () => this.discover());
  }

  /**
   * Cleanup on disconnect
   */
  cleanup() {
    this.stop();
    this.prevNetStats = {};
  }
}

module.exports = NetworkHandler;

