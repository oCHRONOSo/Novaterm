/**
 * Package Management Handler
 * Handles package search and installation
 */
const os = require('os');
const tempFile = require('../utils/tempFile');
const config = require('../config');

class PackageHandler {
  constructor(socket, sessionManager, sshHandler) {
    this.socket = socket;
    this.sessionManager = sessionManager;
    this.sshHandler = sshHandler;
    this.searchTempFile = null;
    this.searchStartTime = null;
  }

  /**
   * Get current session
   * @returns {object|null}
   */
  getSession() {
    return this.sshHandler.getSession();
  }

  /**
   * Search for packages
   * @param {string} query - Search query
   */
  search(query) {
    const session = this.getSession();
    if (!session?.shellStream || !session?.sftp) {
      this.socket.emit('package.search.error', 'No active SSH session');
      return;
    }

    const outputFile = tempFile.generate('pkg_search', 'txt');
    
    // Multi-distro search command
    const searchCmd = `if command -v apt >/dev/null 2>&1; then apt search "${query}" 2>/dev/null > "${outputFile}" 2>&1; elif command -v dnf >/dev/null 2>&1; then dnf search "${query}" 2>/dev/null > "${outputFile}" 2>&1; elif command -v yum >/dev/null 2>&1; then yum search "${query}" 2>/dev/null > "${outputFile}" 2>&1; else echo "No supported package manager found" > "${outputFile}"; fi`;

    this.searchTempFile = outputFile;
    this.searchStartTime = Date.now();

    session.shellStream.write(searchCmd + os.EOL);
    this.socket.emit('package.search.started');

    // Try reading at multiple intervals
    let success = false;

    config.PACKAGE_SEARCH_TIMEOUTS.forEach((delay, index) => {
      setTimeout(() => {
        const s = this.getSession();
        if (success || !this.searchTempFile || !s?.sftp) return;

        s.sftp.readFile(outputFile, (err, data) => {
          if (success) return;

          if (!err && data) {
            const output = data.toString().trim();
            if (output.length > 10) {
              success = true;
              this.socket.emit('package.search.results', output);
              tempFile.cleanup(s.shellStream, outputFile);
              this.searchTempFile = null;
              this.searchStartTime = null;
              return;
            }
          }

          // Last attempt failed
          if (index === config.PACKAGE_SEARCH_TIMEOUTS.length - 1 && !success && this.searchTempFile) {
            this.socket.emit('package.search.error', 'Could not read search results. Check terminal for output.');
            this.searchTempFile = null;
            this.searchStartTime = null;
          }
        });
      }, delay);
    });
  }

  /**
   * Install a package
   * @param {string} packageName - Package to install
   */
  install(packageName) {
    const session = this.getSession();
    if (!session?.shellStream) {
      this.socket.emit('ssh.error', 'No active SSH session');
      return;
    }

    // Multi-distro install command
    const installCmd = session.passwordForSudo
      ? `if command -v apt >/dev/null 2>&1; then printf '%s\\n' '${session.passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S apt-get install -y "${packageName}"; elif command -v dnf >/dev/null 2>&1; then printf '%s\\n' '${session.passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S dnf install -y "${packageName}"; elif command -v yum >/dev/null 2>&1; then printf '%s\\n' '${session.passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S yum install -y "${packageName}"; else echo "No supported package manager found"; fi`
      : `if command -v apt >/dev/null 2>&1; then apt-get install -y "${packageName}"; elif command -v dnf >/dev/null 2>&1; then dnf install -y "${packageName}"; elif command -v yum >/dev/null 2>&1; then yum install -y "${packageName}"; else echo "No supported package manager found"; fi`;

    session.shellStream.write(installCmd + os.EOL);
    this.socket.emit('package.install.started', packageName);
  }

  /**
   * Register socket event handlers
   */
  register() {
    this.socket.on('searchPackages', (query) => this.search(query));
    this.socket.on('installPackage', (packageName) => this.install(packageName));
  }

  /**
   * Cleanup on disconnect
   */
  cleanup() {
    this.searchTempFile = null;
    this.searchStartTime = null;
  }
}

module.exports = PackageHandler;

