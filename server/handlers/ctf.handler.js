/**
 * CTF Tools Handler
 * Handles tool installation, checking, and command execution
 */
const tempFile = require('../utils/tempFile');
const config = require('../config');

class CTFHandler {
  constructor(socket, sessionManager, sshHandler) {
    this.socket = socket;
    this.sessionManager = sessionManager;
    this.sshHandler = sshHandler;
    this.commandBuffer = '';
    this.commandTimeout = null;
    this.outputInterval = null;
  }

  /**
   * Get current session
   * @returns {object|null}
   */
  getSession() {
    return this.sshHandler.getSession();
  }

  /**
   * Check if a tool is installed
   * @param {object} params - Check parameters
   */
  checkTool({ toolId, checkCmd }) {
    const session = this.getSession();
    if (!session?.sftp) {
      this.socket.emit('ctf.toolStatus', { toolId, installed: false });
      return;
    }

    const outputFile = tempFile.generate(`ctf_check_${toolId}`, 'txt');
    session.shellStream?.write(`${checkCmd} > ${outputFile} 2>&1 && echo "FOUND" >> ${outputFile} || echo "NOTFOUND" >> ${outputFile}\n`);

    setTimeout(() => {
      session.sftp.readFile(outputFile, (err, data) => {
        let installed = false;
        if (!err && data) {
          const result = data.toString();
          installed = result.includes('FOUND') && !result.includes('NOTFOUND');
        }
        this.socket.emit('ctf.toolStatus', { toolId, installed });
        tempFile.cleanup(session.shellStream, outputFile);
      });
    }, config.SFTP_COMMAND_TIMEOUT);
  }

  /**
   * Check all tools at once using a unified script
   * @param {object} params - Parameters containing the check script
   */
  checkAllTools({ script }) {
    const session = this.getSession();
    if (!session?.sftp || !session?.shellStream) {
      this.socket.emit('ctf.checkAllToolsResult', {});
      return;
    }

    const scriptFile = tempFile.generate('ctf_check_all', 'sh');
    const outputFile = tempFile.generate('ctf_check_all_result', 'txt');

    // Write the check script via SFTP
    session.sftp.writeFile(scriptFile, script, (err) => {
      if (err) {
        console.error('[CTF] Failed to write check script:', err.message);
        this.socket.emit('ctf.checkAllToolsResult', {});
        return;
      }

      // Execute the script and capture output
      session.shellStream.write(`bash ${scriptFile} > ${outputFile} 2>&1\n`);

      // Read results after execution
      setTimeout(() => {
        session.sftp.readFile(outputFile, (err, data) => {
          const results = {};
          
          if (!err && data) {
            const output = data.toString();
            // Parse lines like "seclists:1" or "gobuster:0"
            const lines = output.split('\n');
            for (const line of lines) {
              const match = line.trim().match(/^([^:]+):([01])$/);
              if (match) {
                results[match[1]] = match[2] === '1';
              }
            }
          }
          
          this.socket.emit('ctf.checkAllToolsResult', results);
          
          // Cleanup temp files
          tempFile.cleanup(session.shellStream, scriptFile);
          tempFile.cleanup(session.shellStream, outputFile);
        });
      }, config.SFTP_COMMAND_TIMEOUT + 2000); // Extra time for multiple checks
    });
  }

  /**
   * Install a tool
   * @param {object} params - Install parameters
   */
  installTool({ toolId, installCmd }) {
    const session = this.getSession();
    if (!session?.shellStream) {
      this.socket.emit('ctf.installComplete', { toolId, success: false });
      return;
    }

    const sudoPrefix = session.passwordForSudo
      ? `printf '%s\\n' '${session.passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S `
      : 'sudo ';

    // Unique marker to detect completion
    const marker = `CTF_INSTALL_DONE_${toolId}_${Date.now()}`;
    let completed = false;

    // Listen for completion marker in shell output
    const completionListener = (data) => {
      const output = data.toString();
      if (output.includes(marker) && !completed) {
        completed = true;
        session.shellStream?.removeListener('data', completionListener);
        clearTimeout(timeout);
        
        // Give it a moment then signal completion (success determined by client check)
        setTimeout(() => {
          this.socket.emit('ctf.installComplete', { toolId, success: true });
        }, 500);
      }
    };

    session.shellStream.on('data', completionListener);

    // Run install command - output visible in terminal
    session.shellStream.write(`${sudoPrefix}${installCmd}; echo "${marker}"\n`);

    // Timeout fallback
    const timeout = setTimeout(() => {
      if (!completed) {
        completed = true;
        session.shellStream?.removeListener('data', completionListener);
        this.socket.emit('ctf.installComplete', { toolId, success: false, timeout: true });
      }
    }, config.CTF_INSTALL_TIMEOUT);
  }

  /**
   * Run a CTF tool command
   * @param {object} params - Run parameters
   */
  runCommand({ command }) {
    const session = this.getSession();
    if (!session?.shellStream) {
      this.socket.emit('ctf.commandOutput', { output: 'Error: No active session\n', done: true });
      return;
    }

    // Clear previous state
    this.commandBuffer = '';
    if (this.commandTimeout) {
      clearTimeout(this.commandTimeout);
    }
    if (this.outputInterval) {
      clearInterval(this.outputInterval);
    }

    const outputFile = tempFile.generate('ctf_output', 'txt');
    const marker = `CTF_CMD_DONE_${Date.now()}`;

    // Run command with output capture
    const fullCmd = `(${command}) > ${outputFile} 2>&1; echo "${marker}"\n`;
    session.shellStream.write(fullCmd);

    // Stream output periodically
    const checkOutput = () => {
      session.sftp.readFile(outputFile, (err, data) => {
        if (!err && data) {
          const newOutput = data.toString();
          if (newOutput.length > this.commandBuffer.length) {
            const delta = newOutput.substring(this.commandBuffer.length);
            this.commandBuffer = newOutput;
            this.socket.emit('ctf.commandOutput', { output: delta, done: false });
          }
        }
      });
    };

    this.outputInterval = setInterval(checkOutput, config.CTF_OUTPUT_POLL_INTERVAL);

    // Listen for completion marker
    const completionListener = (data) => {
      if (data.toString().includes(marker)) {
        if (this.outputInterval) {
          clearInterval(this.outputInterval);
          this.outputInterval = null;
        }
        if (this.commandTimeout) {
          clearTimeout(this.commandTimeout);
          this.commandTimeout = null;
        }
        session.shellStream?.removeListener('data', completionListener);

        // Final read
        setTimeout(() => {
          session.sftp.readFile(outputFile, (err, data) => {
            if (!err && data) {
              const finalOutput = data.toString();
              if (finalOutput.length > this.commandBuffer.length) {
                const delta = finalOutput.substring(this.commandBuffer.length);
                this.socket.emit('ctf.commandOutput', { output: delta, done: false });
              }
            }
            this.socket.emit('ctf.commandOutput', { output: '', done: true });
            tempFile.cleanup(session.shellStream, outputFile);
          });
        }, 500);
      }
    };

    session.shellStream?.on('data', completionListener);

    // Timeout after configured duration
    this.commandTimeout = setTimeout(() => {
      if (this.outputInterval) {
        clearInterval(this.outputInterval);
        this.outputInterval = null;
      }
      session.shellStream?.removeListener('data', completionListener);
      this.socket.emit('ctf.commandOutput', { output: '\n[Command timed out]\n', done: true });
      tempFile.cleanup(session.shellStream, outputFile);
    }, config.CTF_COMMAND_TIMEOUT);
  }

  /**
   * Stop running command
   */
  stopCommand() {
    const session = this.getSession();
    if (session?.shellStream) {
      session.shellStream.write('\x03'); // Ctrl+C
    }

    if (this.outputInterval) {
      clearInterval(this.outputInterval);
      this.outputInterval = null;
    }
    if (this.commandTimeout) {
      clearTimeout(this.commandTimeout);
      this.commandTimeout = null;
    }
  }

  /**
   * Register socket event handlers
   */
  register() {
    this.socket.on('ctf.checkTool', (params) => this.checkTool(params));
    this.socket.on('ctf.checkAllTools', (params) => this.checkAllTools(params));
    this.socket.on('ctf.installTool', (params) => this.installTool(params));
    this.socket.on('ctf.runCommand', (params) => this.runCommand(params));
    this.socket.on('ctf.stopCommand', () => this.stopCommand());
  }

  /**
   * Cleanup on disconnect
   */
  cleanup() {
    this.stopCommand();
    this.commandBuffer = '';
  }
}

module.exports = CTFHandler;

