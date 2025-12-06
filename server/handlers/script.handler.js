/**
 * Script Execution Handler
 * Handles running configuration scripts on remote servers
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const shell = require('../utils/shell');

class ScriptHandler {
  constructor(socket, sessionManager, sshHandler) {
    this.socket = socket;
    this.sessionManager = sessionManager;
    this.sshHandler = sshHandler;
  }

  /**
   * Get current session
   * @returns {object|null}
   */
  getSession() {
    return this.sshHandler.getSession();
  }

  /**
   * Find a script in the scripts directory
   * @param {string} scriptName - Script path relative to scripts/
   * @returns {string|null} Full path if found
   */
  findScript(scriptName) {
    const candidate = path.join(process.cwd(), 'scripts', scriptName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    return null;
  }

  /**
   * Transfer and run a script
   * @param {object} params - Run parameters
   */
  async run({ scriptName, args }) {
    const session = this.getSession();
    if (!session?.sftp || !session?.shellStream) {
      this.socket.emit('ssh.error', 'No active SSH/SFTP session');
      return;
    }

    // Find script locally
    const scriptPath = this.findScript(scriptName);
    if (!scriptPath) {
      this.socket.emit('ssh.error', `Script not found: ${scriptName}`);
      return;
    }

    // Generate unique remote filename
    const remoteName = `/tmp/script_${Date.now()}_${Math.random().toString(36).slice(2)}.sh`;

    // Transfer script
    try {
      await new Promise((resolve, reject) => {
        session.sftp.fastPut(scriptPath, remoteName, {}, (err) =>
          err ? reject(err) : resolve()
        );
      });
    } catch (err) {
      this.socket.emit('ssh.error', `Transfer failed: ${err.message}`);
      return;
    }

    // Build argument list
    const argList = shell.buildArgs(args || []);

    // Build execution command
    const cmd = [
      `chmod +x ${remoteName}`,
      session.passwordForSudo
        ? `printf '%s\\n' ${shell.escapeArg(session.passwordForSudo)} | sudo -S ${remoteName} ${argList}`
        : `${remoteName} ${argList}`,
      `rm -f ${remoteName}`,
    ].join(' && ');

    // Execute
    session.shellStream.write(cmd + os.EOL);
  }

  /**
   * Register socket event handlers
   */
  register() {
    this.socket.on('runScript', (params) => this.run(params));
  }

  /**
   * Cleanup on disconnect
   */
  cleanup() {
    // Nothing to clean up
  }
}

module.exports = ScriptHandler;

