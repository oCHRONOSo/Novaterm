/**
 * System Monitoring Handler
 * Handles CPU, memory, disk monitoring and process list
 */
const MetricsCollector = require('../services/MetricsCollector');
const config = require('../config');

class MonitoringHandler {
  constructor(socket, sessionManager, sshHandler) {
    this.socket = socket;
    this.sessionManager = sessionManager;
    this.sshHandler = sshHandler;
    this.interval = null;
    this.isActive = false;
  }

  /**
   * Get current session
   * @returns {object|null}
   */
  getSession() {
    return this.sshHandler.getSession();
  }

  /**
   * Start monitoring
   * @param {object} params - Start parameters
   */
  start({ interval }) {
    const session = this.getSession();
    if (!session) {
      this.socket.emit('ssh.error', 'No active session');
      return;
    }

    // Stop any existing monitoring
    this.stop();
    this.isActive = true;

    // Enforce minimum interval
    const actualInterval = Math.max(interval || config.MONITORING_DEFAULT_INTERVAL, config.MONITORING_MIN_INTERVAL);
    console.log(`[MonitoringHandler] Starting with interval ${actualInterval}ms`);

    const collect = () => {
      if (!this.isActive) return;

      const currentSession = this.getSession();
      if (!currentSession) {
        console.log('[MonitoringHandler] Session lost, stopping');
        this.stop();
        return;
      }

      // Collect metrics
      MetricsCollector.collect(currentSession, (metrics) => {
        if (this.isActive) {
          this.socket.emit('monitoring.metrics', metrics);
        }
      });

      // Collect processes
      MetricsCollector.collectProcesses(currentSession, (processes) => {
        if (this.isActive) {
          this.socket.emit('monitoring.processes', processes);
        }
      });
    };

    // Immediate first collection
    collect();
    this.interval = setInterval(collect, actualInterval);
  }

  /**
   * Stop monitoring
   */
  stop() {
    console.log('[MonitoringHandler] Stopping');
    this.isActive = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Refresh metrics once
   */
  refresh() {
    const session = this.getSession();
    if (!session) return;

    // Temporarily enable for one-time collection
    const wasActive = this.isActive;
    this.isActive = true;

    MetricsCollector.collect(session, (metrics) => {
      this.socket.emit('monitoring.metrics', metrics);
      if (!wasActive) this.isActive = false;
    });

    MetricsCollector.collectProcesses(session, (processes) => {
      this.socket.emit('monitoring.processes', processes);
    });
  }

  /**
   * Kill a process
   * @param {object} params - Kill parameters
   */
  kill({ pid, signal }) {
    const session = this.getSession();
    if (!session?.shellStream) return;

    session.shellStream.write(`kill -${signal || 'TERM'} ${pid}\n`);
  }

  /**
   * Register socket event handlers
   */
  register() {
    this.socket.on('monitoring.start', (params) => this.start(params));
    this.socket.on('monitoring.stop', () => this.stop());
    this.socket.on('monitoring.refresh', () => this.refresh());
    this.socket.on('monitoring.kill', (params) => this.kill(params));
  }

  /**
   * Cleanup on disconnect
   */
  cleanup() {
    this.stop();
  }
}

module.exports = MonitoringHandler;

