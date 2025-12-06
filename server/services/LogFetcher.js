/**
 * Log Fetcher Service
 * Fetches logs from files or journald
 */
const tempFile = require('../utils/tempFile');
const shell = require('../utils/shell');
const config = require('../config');

class LogFetcher {
  /**
   * Build command for fetching logs
   * @param {string} source - Log source (file path or journald:type)
   * @param {number} lines - Number of lines to fetch
   * @param {string} outputFile - Output file path
   * @param {string} password - Sudo password (optional)
   * @returns {string} Shell command
   */
  static buildCommand(source, lines, outputFile, password) {
    // Check if this is a journald source
    if (source.startsWith('journald:')) {
      return this.buildJournalCommand(source, lines, outputFile, password);
    }
    
    // Traditional file-based log
    return this.buildFileCommand(source, lines, outputFile, password);
  }

  /**
   * Build journalctl command
   * @private
   */
  static buildJournalCommand(source, lines, outputFile, password) {
    const journalType = source.replace('journald:', '');
    let journalCmd;

    switch (journalType) {
      case 'system':
        journalCmd = `journalctl --no-pager -n ${lines}`;
        break;
      case 'kernel':
        journalCmd = `journalctl --no-pager -k -n ${lines}`;
        break;
      case 'auth':
        journalCmd = `journalctl --no-pager -u ssh -u sshd -u systemd-logind -n ${lines}`;
        break;
      case 'nginx':
        journalCmd = `journalctl --no-pager -u nginx -n ${lines}`;
        break;
      case 'apache':
        journalCmd = `journalctl --no-pager -u apache2 -u httpd -n ${lines}`;
        break;
      default:
        // Custom unit
        journalCmd = `journalctl --no-pager -u ${journalType} -n ${lines}`;
    }

    if (password) {
      const escaped = shell.escapeArg(password);
      return `printf '%s\\n' ${escaped} | sudo -S ${journalCmd} > ${outputFile} 2>/dev/null || ${journalCmd} > ${outputFile} 2>/dev/null`;
    }
    return `${journalCmd} > ${outputFile} 2>/dev/null`;
  }

  /**
   * Build file tail command
   * @private
   */
  static buildFileCommand(source, lines, outputFile, password) {
    if (password) {
      const escaped = shell.escapeArg(password);
      return `printf '%s\\n' ${escaped} | sudo -S tail -n ${lines} "${source}" > ${outputFile} 2>/dev/null || tail -n ${lines} "${source}" > ${outputFile} 2>/dev/null`;
    }
    return `tail -n ${lines} "${source}" > ${outputFile} 2>/dev/null`;
  }

  /**
   * Fetch logs from multiple sources
   * @param {object} session - SSH session
   * @param {string[]} sources - Array of log sources
   * @param {number} lines - Number of lines to fetch
   * @param {boolean} isInitial - Is this the initial fetch?
   * @param {object} socket - Socket.IO socket for emitting results
   * @param {object} lastLogsCache - Cache object for deduplication
   */
  static fetch(session, sources, lines, isInitial, socket, lastLogsCache) {
    if (!session?.sftp) return;

    const linesToFetch = isInitial ? (lines || config.LOG_INITIAL_LINES) : config.LOG_STREAM_LINES;

    sources.forEach(source => {
      const outputFile = tempFile.generate('logs', 'txt');
      const cmd = this.buildCommand(source, linesToFetch, outputFile, session.passwordForSudo);

      session.shellStream?.write(`${cmd}\n`);

      setTimeout(() => {
        session.sftp.readFile(outputFile, (err, data) => {
          if (!err && data) {
            const content = data.toString();
            const logLines = content.split('\n').filter(l => l.trim());

            if (logLines.length > 0) {
              const sourceKey = source.replace(/[^a-z0-9]/gi, '_');
              
              if (!isInitial && lastLogsCache[sourceKey]) {
                // Stream mode - only send new lines
                const lastLines = lastLogsCache[sourceKey];
                const newLines = logLines.filter(line => !lastLines.includes(line));
                
                if (newLines.length > 0) {
                  const entries = newLines.map(line => ({
                    source,
                    line,
                    timestamp: Date.now(),
                  }));
                  socket.emit('logs.batch', entries);
                }
              } else {
                // Initial fetch - send all
                const entries = logLines.map(line => ({
                  source,
                  line,
                  timestamp: Date.now(),
                }));
                socket.emit('logs.batch', entries);
              }

              // Update cache
              lastLogsCache[sourceKey] = logLines.slice(-config.LOG_CACHE_SIZE);
            } else if (isInitial) {
              const isJournald = source.startsWith('journald:');
              const msg = isJournald
                ? `No data from ${source} - service may not exist or have no logs`
                : `No data from ${source} - file may not exist or is empty`;
              socket.emit('logs.error', msg);
            }
          } else if (err && isInitial) {
            console.log(`[LogFetcher] Could not read ${source}: ${err.message}`);
            socket.emit('logs.error', `Cannot read ${source}: check if file/service exists`);
          }

          tempFile.cleanup(session.shellStream, outputFile);
        });
      }, config.SFTP_READ_TIMEOUT);
    });
  }
}

module.exports = LogFetcher;

