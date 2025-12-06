/**
 * Log Streaming Handler
 * Handles real-time log viewing and fetching
 */
const LogFetcher = require('../services/LogFetcher');
const config = require('../config');

class LogsHandler {
  constructor(socket, sessionManager, sshHandler) {
    this.socket = socket;
    this.sessionManager = sessionManager;
    this.sshHandler = sshHandler;
    this.interval = null;
    this.isActive = false;
    this.sources = [];
    this.lastLogsCache = {};
  }

  /**
   * Get current session
   * @returns {object|null}
   */
  getSession() {
    return this.sshHandler.getSession();
  }

  /**
   * Start log streaming
   * @param {object} params - Start parameters
   */
  start({ sources, lines }) {
    const session = this.getSession();
    if (!session?.sftp) {
      this.socket.emit('logs.error', 'No active session');
      return;
    }

    // Stop existing streaming
    this.stop();
    
    this.isActive = true;
    this.sources = sources;

    // Clear cached last lines for new sources
    sources.forEach(source => {
      const sourceKey = source.replace(/[^a-z0-9]/gi, '_');
      delete this.lastLogsCache[sourceKey];
    });

    console.log(`[LogsHandler] Starting log stream for ${sources.length} sources: ${sources.join(', ')}`);

    // Initial fetch
    LogFetcher.fetch(session, sources, lines, true, this.socket, this.lastLogsCache);

    // Start polling
    this.interval = setInterval(() => {
      if (!this.isActive) return;
      
      const currentSession = this.getSession();
      if (currentSession) {
        LogFetcher.fetch(currentSession, this.sources, lines, false, this.socket, this.lastLogsCache);
      }
    }, config.LOG_POLL_INTERVAL);
  }

  /**
   * Stop log streaming
   */
  stop() {
    console.log('[LogsHandler] Stopping log stream');
    this.isActive = false;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    this.sources = [];
  }

  /**
   * Fetch logs once (without streaming)
   * @param {object} params - Fetch parameters
   */
  fetch({ sources, lines }) {
    const session = this.getSession();
    if (!session?.sftp) {
      this.socket.emit('logs.error', 'No active session');
      return;
    }

    console.log(`[LogsHandler] Fetching logs from ${sources.length} sources`);

    // Temporarily enable for one-time fetch
    const wasActive = this.isActive;
    this.isActive = true;
    
    LogFetcher.fetch(session, sources, lines, true, this.socket, this.lastLogsCache);
    
    setTimeout(() => {
      if (!wasActive) this.isActive = false;
    }, config.SFTP_READ_TIMEOUT);
  }

  /**
   * Register socket event handlers
   */
  register() {
    this.socket.on('logs.start', (params) => this.start(params));
    this.socket.on('logs.stop', () => this.stop());
    this.socket.on('logs.fetch', (params) => this.fetch(params));
  }

  /**
   * Cleanup on disconnect
   */
  cleanup() {
    this.stop();
    this.lastLogsCache = {};
  }
}

module.exports = LogsHandler;

