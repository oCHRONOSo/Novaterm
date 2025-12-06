/**
 * Port Scanner Service
 * Scans ports using bash /dev/tcp
 */
const tempFile = require('../utils/tempFile');
const config = require('../config');

class PortScanner {
  /**
   * Parse port range string into array
   * @param {string} portsStr - Port string (e.g., "22,80,443,8000-8100")
   * @returns {number[]} Array of port numbers
   */
  static parsePorts(portsStr) {
    const portList = [];

    portsStr.split(',').forEach(part => {
      part = part.trim();
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        for (let i = start; i <= end && i <= 65535; i++) {
          portList.push(i);
        }
      } else {
        portList.push(parseInt(part));
      }
    });

    return portList.filter(p => !isNaN(p) && p > 0 && p <= 65535);
  }

  /**
   * Scan ports on a target
   * @param {object} session - SSH session
   * @param {string} target - Target host/IP
   * @param {string} portsStr - Ports to scan
   * @param {object} socket - Socket.IO socket for results
   */
  static scan(session, target, portsStr, socket) {
    if (!session?.shellStream || !session?.sftp) {
      socket.emit('network.error', 'No active session');
      return;
    }

    const portList = this.parsePorts(portsStr);
    const total = portList.length;
    let scanned = 0;

    /**
     * Scan a single port
     * @param {number} port - Port to scan
     */
    const scanPort = (port) => {
      const outputFile = tempFile.generate(`scan_${port}`, 'txt');
      const cmd = `timeout 1 bash -c "echo >/dev/tcp/${target}/${port}" 2>/dev/null && echo "open" > ${outputFile} || echo "closed" > ${outputFile}\n`;
      
      session.shellStream.write(cmd);

      setTimeout(() => {
        session.sftp.readFile(outputFile, (err, data) => {
          scanned++;
          socket.emit('network.scan.progress', Math.round((scanned / total) * 100));

          if (!err && data) {
            const state = data.toString().trim() === 'open' ? 'open' : 'closed';
            if (state === 'open') {
              socket.emit('network.scan.result', {
                port,
                state,
                service: this.getServiceName(port),
              });
            }
          }

          tempFile.cleanup(session.shellStream, outputFile);

          if (scanned >= total) {
            socket.emit('network.scan.complete');
          }
        });
      }, config.PORT_SCAN_TIMEOUT);
    };

    // Scan in batches to avoid flooding
    let idx = 0;
    const scanBatch = () => {
      const batch = portList.slice(idx, idx + config.PORT_SCAN_BATCH_SIZE);
      batch.forEach(port => scanPort(port));
      idx += config.PORT_SCAN_BATCH_SIZE;
      
      if (idx < portList.length) {
        setTimeout(scanBatch, config.PORT_SCAN_BATCH_DELAY);
      }
    };

    scanBatch();
  }

  /**
   * Get common service name for port
   * @param {number} port - Port number
   * @returns {string} Service name
   */
  static getServiceName(port) {
    const services = {
      21: 'ftp',
      22: 'ssh',
      23: 'telnet',
      25: 'smtp',
      53: 'dns',
      80: 'http',
      110: 'pop3',
      143: 'imap',
      443: 'https',
      445: 'smb',
      993: 'imaps',
      995: 'pop3s',
      1433: 'mssql',
      3306: 'mysql',
      3389: 'rdp',
      5432: 'postgresql',
      5900: 'vnc',
      6379: 'redis',
      8080: 'http-alt',
      8443: 'https-alt',
      27017: 'mongodb',
    };
    return services[port] || '';
  }
}

module.exports = PortScanner;

