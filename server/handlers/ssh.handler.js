/**
 * SSH Connection Handler
 * Manages SSH connection lifecycle
 */
const os = require('os');
const config = require('../config');

class SSHHandler {
  constructor(socket, sessionManager) {
    this.socket = socket;
    this.sessionManager = sessionManager;
    this.currentSessionId = null;
  }

  /**
   * Attach socket to an existing session
   * @param {string} sessionId - Session ID to attach to
   * @returns {boolean} Success
   */
  attachToSession(sessionId) {
    if (this.sessionManager.attachSocket(sessionId, this.socket)) {
      this.currentSessionId = sessionId;
      return true;
    }
    return false;
  }

  /**
   * Detach socket from current session
   */
  detachFromSession() {
    if (this.currentSessionId) {
      this.sessionManager.detachSocket(this.currentSessionId, this.socket);
      this.currentSessionId = null;
    }
  }

  /**
   * Get current session ID
   * @returns {string|null}
   */
  getSessionId() {
    return this.currentSessionId;
  }

  /**
   * Get current session object
   * @returns {object|null}
   */
  getSession() {
    return this.sessionManager.get(this.currentSessionId);
  }

  /**
   * Start a new SSH connection
   * @param {object} params - Connection parameters
   */
  startConnection({ ip, username, password, port, sshKeyContent, passphrase, sessionId: existingSessionId }) {
    // Try to reconnect to existing session
    if (existingSessionId) {
      const existingSession = this.sessionManager.get(existingSessionId);
      if (existingSession?.isConnected) {
        if (this.attachToSession(existingSessionId)) {
          this.socket.emit('ssh.status', 'SSH connected');
          this.socket.emit('ssh.sessionId', existingSessionId);

          // Send buffered output
          if (existingSession.outputBuffer) {
            this.socket.emit('output', existingSession.outputBuffer);
          }

          if (existingSession.sftp) {
            this.socket.emit('sftp.ready');
          }
          return;
        }
      }
    }

    // Detach from any previous session
    this.detachFromSession();

    // Create new session
    const sessionId = this.sessionManager.generateId();
    const session = this.sessionManager.create(sessionId, { ip, username, password, port, sshKeyContent, passphrase });

    this.attachToSession(sessionId);
    session.isConnecting = true;

    // Set up connection handlers
    session.conn
      .on('ready', () => {
        session.isConnected = true;
        session.isConnecting = false;

        this.sessionManager.broadcast(session, 'ssh.status', 'SSH connected');
        this.sessionManager.broadcast(session, 'ssh.sessionId', sessionId);

        // Request shell with proper PTY settings for native shell experience
        const ptyOptions = {
          term: 'xterm-256color',
          cols: 80,
          rows: 24,
          width: 640,
          height: 480,
          modes: {
            ECHO: 1,        // Enable echo
            ICANON: 1,      // Canonical mode
            ISIG: 1,        // Enable signals
            IEXTEN: 1,      // Extended input processing
            OPOST: 1,       // Output processing
            ONLCR: 1,       // Map NL to CR-NL on output
          }
        };

        session.conn.shell(ptyOptions, (err, stream) => {
          if (err) {
            this.sessionManager.broadcast(session, 'ssh.error', err.message);
            return;
          }

          session.shellStream = stream;

          stream.on('data', (data) => {
            const output = data.toString();
            this.sessionManager.appendOutput(session, output);
            this.sessionManager.broadcast(session, 'output', output);
          });

          stream.on('close', () => {
            this.sessionManager.broadcast(session, 'ssh.status', 'Shell closed');
            session.isConnected = false;
            this.sessionManager.destroy(sessionId);
          });
        });

        // Request SFTP
        session.conn.sftp((err, sftp) => {
          if (err) {
            this.sessionManager.broadcast(session, 'ssh.error', 'SFTP unavailable');
            return;
          }
          session.sftp = sftp;
          this.sessionManager.broadcast(session, 'sftp.ready');
        });
      })
      .on('error', (err) => {
        session.isConnecting = false;
        this.sessionManager.broadcast(session, 'ssh.error', err.message);
        this.sessionManager.destroy(sessionId);
      })
      .on('close', () => {
        session.isConnected = false;
        this.sessionManager.broadcast(session, 'ssh.status', 'Connection closed');
      })
      .connect({
        host: ip,
        port: port || 22,
        username,
        password: sshKeyContent ? undefined : password,
        privateKey: sshKeyContent || undefined,
        passphrase: passphrase || undefined,
        readyTimeout: config.SSH_READY_TIMEOUT,
        tryKeyboard: true,
      });
  }

  /**
   * Reconnect to an existing session
   * @param {string} sessionId - Session to reconnect to
   */
  reconnect(sessionId) {
    const session = this.sessionManager.get(sessionId);

    if (!session) {
      this.socket.emit('ssh.error', 'Session not found or expired');
      this.socket.emit('ssh.sessionExpired', sessionId);
      return;
    }

    if (!session.isConnected) {
      this.socket.emit('ssh.error', 'Session is not connected');
      this.socket.emit('ssh.sessionExpired', sessionId);
      return;
    }

    this.detachFromSession();

    if (this.attachToSession(sessionId)) {
      this.socket.emit('ssh.status', 'SSH connected');
      this.socket.emit('ssh.sessionId', sessionId);
      this.socket.emit('ssh.reconnected', true);

      if (session.outputBuffer) {
        this.socket.emit('output', session.outputBuffer);
      }

      if (session.sftp) {
        this.socket.emit('sftp.ready');
      }
    }
  }

  /**
   * End current session
   */
  endSession() {
    if (this.currentSessionId) {
      this.sessionManager.destroy(this.currentSessionId);
      this.currentSessionId = null;
    }
  }

  /**
   * Handle terminal input
   * @param {string} data - Input data
   */
  handleInput(data) {
    const session = this.getSession();
    if (!session?.shellStream) return;
    session.shellStream.write(data);
    session.lastActivity = Date.now();
  }

  /**
   * Handle terminal resize
   * @param {object} params - Resize parameters
   */
  handleResize({ rows, cols }) {
    const session = this.getSession();
    if (session?.shellStream?.setWindow) {
      session.shellStream.setWindow(rows || 24, cols || 80, 600, 800);
    }
  }

  /**
   * Register socket event handlers
   */
  register() {
    this.socket.on('startSSHConnection', (params) => this.startConnection(params));
    this.socket.on('reconnectSession', (sessionId) => this.reconnect(sessionId));
    this.socket.on('endSession', () => this.endSession());
    this.socket.on('input', (data) => this.handleInput(data));
    this.socket.on('resize', (params) => this.handleResize(params));
  }

  /**
   * Cleanup on disconnect
   */
  cleanup() {
    this.detachFromSession();
  }
}

module.exports = SSHHandler;

