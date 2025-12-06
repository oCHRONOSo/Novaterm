/**
 * SSH Session Manager
 * Handles creation, retrieval, and cleanup of SSH sessions
 */
const crypto = require('crypto');
const { Client } = require('ssh2');
const config = require('../config');

class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Generate a unique session ID
   * @returns {string} Hex session ID
   */
  generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Create a new session
   * @param {string} id - Session ID
   * @param {object} connectionConfig - SSH connection config
   * @returns {object} Session object
   */
  create(id, connectionConfig) {
    const session = {
      id,
      conn: new Client(),
      shellStream: null,
      sftp: null,
      passwordForSudo: connectionConfig.password || '',
      config: connectionConfig,
      sockets: new Set(),
      outputBuffer: '',
      lastActivity: Date.now(),
      cleanupTimer: null,
      isConnected: false,
      isConnecting: false,
    };

    this.sessions.set(id, session);
    console.log(`[Session ${id.slice(0, 8)}] Created`);
    return session;
  }

  /**
   * Get a session by ID
   * @param {string} id - Session ID
   * @returns {object|undefined} Session object
   */
  get(id) {
    return this.sessions.get(id);
  }

  /**
   * Check if session exists and is connected
   * @param {string} id - Session ID
   * @returns {boolean}
   */
  isActive(id) {
    const session = this.get(id);
    return session?.isConnected || false;
  }

  /**
   * Destroy a session and clean up resources
   * @param {string} id - Session ID
   */
  destroy(id) {
    const session = this.sessions.get(id);
    if (!session) return;

    console.log(`[Session ${id.slice(0, 8)}] Destroying`);

    // Clear cleanup timer
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
    }

    // Close connections
    try {
      if (session.shellStream) {
        session.shellStream.end();
      }
      session.conn.end();
    } catch (e) {
      console.error(`[Session ${id.slice(0, 8)}] Destroy error:`, e.message);
    }

    this.sessions.delete(id);
  }

  /**
   * Schedule session cleanup after timeout
   * @param {string} id - Session ID
   */
  scheduleCleanup(id) {
    const session = this.get(id);
    if (!session) return;

    // Clear existing timer
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = null;
    }

    // Only schedule if no sockets attached
    if (session.sockets.size === 0) {
      console.log(`[Session ${id.slice(0, 8)}] Scheduling cleanup in ${config.SESSION_TIMEOUT / 1000}s`);
      
      session.cleanupTimer = setTimeout(() => {
        const s = this.get(id);
        if (s && s.sockets.size === 0) {
          this.destroy(id);
        }
      }, config.SESSION_TIMEOUT);
    }
  }

  /**
   * Cancel scheduled cleanup
   * @param {string} id - Session ID
   */
  cancelCleanup(id) {
    const session = this.get(id);
    if (session?.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = null;
    }
  }

  /**
   * Attach a socket to a session
   * @param {string} id - Session ID
   * @param {object} socket - Socket.IO socket
   * @returns {boolean} Success
   */
  attachSocket(id, socket) {
    const session = this.get(id);
    if (!session) return false;

    session.sockets.add(socket);
    this.cancelCleanup(id);
    
    console.log(`[Session ${id.slice(0, 8)}] Socket attached (${session.sockets.size} clients)`);
    return true;
  }

  /**
   * Detach a socket from a session
   * @param {string} id - Session ID
   * @param {object} socket - Socket.IO socket
   */
  detachSocket(id, socket) {
    const session = this.get(id);
    if (!session) return;

    session.sockets.delete(socket);
    console.log(`[Session ${id.slice(0, 8)}] Socket detached (${session.sockets.size} clients remaining)`);
    
    this.scheduleCleanup(id);
  }

  /**
   * Append data to session output buffer
   * @param {object} session - Session object
   * @param {string} data - Data to append
   */
  appendOutput(session, data) {
    session.outputBuffer += data;
    
    // Trim buffer if too large
    if (session.outputBuffer.length > config.MAX_OUTPUT_BUFFER) {
      session.outputBuffer = session.outputBuffer.slice(-config.MAX_OUTPUT_BUFFER);
    }
    
    session.lastActivity = Date.now();
  }

  /**
   * Broadcast event to all sockets in a session
   * @param {object} session - Session object
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  broadcast(session, event, data) {
    session.sockets.forEach((socket) => {
      socket.emit(event, data);
    });
  }

  /**
   * Get all active sessions (for monitoring/debugging)
   * @returns {Array} Array of session info
   */
  getAllSessions() {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      isConnected: s.isConnected,
      socketsCount: s.sockets.size,
      lastActivity: s.lastActivity,
    }));
  }
}

// Export singleton instance
module.exports = new SessionManager();

