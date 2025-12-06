/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');
const next = require('next');
const { Server } = require('socket.io');
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

// Session timeout in milliseconds (5 minutes)
const SESSION_TIMEOUT = 5 * 60 * 1000;
// Maximum output buffer size (keep last 50KB of terminal output)
const MAX_OUTPUT_BUFFER = 50 * 1024;

// Store SSH sessions independently of socket connections
const sessions = new Map();

function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

function findScript(scriptName) {
  const candidate = path.join(process.cwd(), 'scripts', scriptName);
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

// Create or get an SSH session
function createSession(sessionId, config) {
  const session = {
    id: sessionId,
    conn: new Client(),
    shellStream: null,
    sftp: null,
    passwordForSudo: config.password || '',
    config: config,
    sockets: new Set(), // Multiple sockets can attach to same session
    outputBuffer: '', // Buffer recent output for reconnecting clients
    lastActivity: Date.now(),
    cleanupTimer: null,
    isConnected: false,
    isConnecting: false,
  };

  sessions.set(sessionId, session);
  return session;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function destroySession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  console.log(`[Session ${sessionId.slice(0, 8)}] Destroying session`);
  
  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
  }
  
  try {
    session.shellStream?.end();
    session.conn.end();
  } catch (e) {
    console.error('Session destroy error:', e.message);
  }
  
  sessions.delete(sessionId);
}

function scheduleSessionCleanup(sessionId) {
  const session = getSession(sessionId);
  if (!session) return;
  
  // Clear existing timer
  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
  }
  
  // If no sockets attached, schedule cleanup
  if (session.sockets.size === 0) {
    console.log(`[Session ${sessionId.slice(0, 8)}] No clients attached, scheduling cleanup in ${SESSION_TIMEOUT / 1000}s`);
    session.cleanupTimer = setTimeout(() => {
      const s = getSession(sessionId);
      if (s && s.sockets.size === 0) {
        destroySession(sessionId);
      }
    }, SESSION_TIMEOUT);
  }
}

function cancelSessionCleanup(sessionId) {
  const session = getSession(sessionId);
  if (session && session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
    session.cleanupTimer = null;
  }
}

function appendToOutputBuffer(session, data) {
  session.outputBuffer += data;
  // Keep buffer under max size
  if (session.outputBuffer.length > MAX_OUTPUT_BUFFER) {
    session.outputBuffer = session.outputBuffer.slice(-MAX_OUTPUT_BUFFER);
  }
  session.lastActivity = Date.now();
}

function broadcastToSession(session, event, data) {
  session.sockets.forEach((socket) => {
    socket.emit(event, data);
  });
}

async function start() {
  await app.prepare();
  const server = http.createServer((req, res) => handle(req, res));
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    let currentSessionId = null;

    // Attach socket to a session
    function attachToSession(sessionId) {
      const session = getSession(sessionId);
      if (!session) return false;
      
      currentSessionId = sessionId;
      session.sockets.add(socket);
      cancelSessionCleanup(sessionId);
      
      console.log(`[Session ${sessionId.slice(0, 8)}] Client attached (${session.sockets.size} clients)`);
      return true;
    }

    // Detach socket from session (don't destroy session)
    function detachFromSession() {
      if (!currentSessionId) return;
      
      const session = getSession(currentSessionId);
      if (session) {
        session.sockets.delete(socket);
        console.log(`[Session ${currentSessionId.slice(0, 8)}] Client detached (${session.sockets.size} clients remaining)`);
        scheduleSessionCleanup(currentSessionId);
      }
      currentSessionId = null;
    }

    socket.on('disconnect', () => {
      detachFromSession();
    });

    // Start a new SSH connection and create a session
    socket.on('startSSHConnection', ({ ip, username, password, port, sshKeyContent, passphrase, sessionId: existingSessionId }) => {
      // If reconnecting to existing session
      if (existingSessionId) {
        const existingSession = getSession(existingSessionId);
        if (existingSession && existingSession.isConnected) {
          // Reattach to existing session
          if (attachToSession(existingSessionId)) {
          socket.emit('ssh.status', 'SSH connected');
            socket.emit('ssh.sessionId', existingSessionId);
            
            // Send buffered output to catch up
            if (existingSession.outputBuffer) {
              socket.emit('output', existingSession.outputBuffer);
            }
            
            if (existingSession.sftp) {
              socket.emit('sftp.ready');
            }
            return;
          }
        }
      }

      // Detach from any previous session
      detachFromSession();

      // Create new session
      const sessionId = generateSessionId();
      const session = createSession(sessionId, { ip, username, password, port, sshKeyContent, passphrase });
      
      attachToSession(sessionId);
      session.isConnecting = true;

      session.conn
        .on('ready', () => {
          session.isConnected = true;
          session.isConnecting = false;
          
          broadcastToSession(session, 'ssh.status', 'SSH connected');
          broadcastToSession(session, 'ssh.sessionId', sessionId);
          
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
              broadcastToSession(session, 'ssh.error', err.message);
              return;
            }
            
            session.shellStream = stream;
            
       stream.on('data', (data) => {
         const output = data.toString();
              appendToOutputBuffer(session, output);
              broadcastToSession(session, 'output', output);
            });
            
            stream.on('close', () => {
              broadcastToSession(session, 'ssh.status', 'Shell closed');
              session.isConnected = false;
              destroySession(sessionId);
          });
          });

          session.conn.sftp((err, s) => {
            if (err) {
              broadcastToSession(session, 'ssh.error', 'SFTP unavailable');
              return;
            }
            session.sftp = s;
            broadcastToSession(session, 'sftp.ready');
          });
        })
        .on('error', (err) => {
          session.isConnecting = false;
          broadcastToSession(session, 'ssh.error', err.message);
          destroySession(sessionId);
        })
        .on('close', () => {
          session.isConnected = false;
          broadcastToSession(session, 'ssh.status', 'Connection closed');
        })
        .connect({
          host: ip,
          port: port || 22,
          username,
          password: sshKeyContent ? undefined : password,
          privateKey: sshKeyContent || undefined,
          passphrase: passphrase || undefined,
          readyTimeout: 20000,
          tryKeyboard: true,
        });
    });

    // Explicitly reconnect to an existing session
    socket.on('reconnectSession', (sessionId) => {
      const session = getSession(sessionId);
      
      if (!session) {
        socket.emit('ssh.error', 'Session not found or expired');
        socket.emit('ssh.sessionExpired', sessionId);
        return;
      }
      
      if (!session.isConnected) {
        socket.emit('ssh.error', 'Session is not connected');
        socket.emit('ssh.sessionExpired', sessionId);
        return;
      }

      // Detach from current session if any
      detachFromSession();
      
      // Attach to requested session
      if (attachToSession(sessionId)) {
        socket.emit('ssh.status', 'SSH connected');
        socket.emit('ssh.sessionId', sessionId);
        socket.emit('ssh.reconnected', true);
        
        // Send buffered output
        if (session.outputBuffer) {
          socket.emit('output', session.outputBuffer);
        }
        
        if (session.sftp) {
          socket.emit('sftp.ready');
        }
      }
    });

    // Explicitly end a session
    socket.on('endSession', () => {
      if (currentSessionId) {
        destroySession(currentSessionId);
        currentSessionId = null;
      }
    });

    socket.on('input', (data) => {
      const session = getSession(currentSessionId);
      if (!session?.shellStream) return;
      session.shellStream.write(data);
      session.lastActivity = Date.now();
    });

    socket.on('resize', ({ rows, cols }) => {
      const session = getSession(currentSessionId);
      if (session?.shellStream?.setWindow) {
        session.shellStream.setWindow(rows || 24, cols || 80, 600, 800);
      }
    });

    async function transferAndRun(scriptName, args = []) {
      const session = getSession(currentSessionId);
      if (!session?.sftp || !session?.shellStream) {
        socket.emit('ssh.error', 'No active SSH/SFTP session');
        return;
      }
      
      const scriptPath = findScript(scriptName);
      if (!scriptPath) {
        socket.emit('ssh.error', `Script not found: ${scriptName}`);
        return;
      }
      
      const remoteName = `/tmp/script_${Date.now()}_${Math.random().toString(36).slice(2)}.sh`;

      await new Promise((resolve, reject) => {
        session.sftp.fastPut(scriptPath, remoteName, {}, (err) =>
          err ? reject(err) : resolve(),
        );
      }).catch((err) => {
        socket.emit('ssh.error', `Transfer failed: ${err.message}`);
      });

      const argList = (args || [])
        .map((a) => `'${String(a).replace(/'/g, "'\\''")}'`)
        .join(' ');

      const cmd = [
        `chmod +x ${remoteName}`,
        session.passwordForSudo
          ? `printf '%s\\n' '${session.passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S ${remoteName} ${argList}`
          : `${remoteName} ${argList}`,
        `rm -f ${remoteName}`,
      ].join(' && ');

      session.shellStream.write(cmd + os.EOL);
    }

    socket.on('runScript', ({ scriptName, args }) => {
      transferAndRun(scriptName, args);
    });

     socket.on('searchPackages', async (query) => {
      const session = getSession(currentSessionId);
      if (!session?.shellStream || !session?.sftp) {
         socket.emit('package.search.error', 'No active SSH session');
         return;
       }
       
       const tempFile = `/tmp/pkg_search_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.txt`;
       const searchCmd = `if command -v apt >/dev/null 2>&1; then apt search "${query}" 2>/dev/null | head -20 > "${tempFile}" 2>&1; elif command -v dnf >/dev/null 2>&1; then dnf search "${query}" 2>/dev/null | head -20 > "${tempFile}" 2>&1; elif command -v yum >/dev/null 2>&1; then yum search "${query}" 2>/dev/null | head -20 > "${tempFile}" 2>&1; else echo "No supported package manager found" > "${tempFile}"; fi`;
       
       socket.searchTempFile = tempFile;
       socket.searchStartTime = Date.now();
       
      session.shellStream.write(searchCmd + os.EOL);
       socket.emit('package.search.started');
       
      const readAttempts = [2000, 3000, 5000];
       let success = false;
       
       readAttempts.forEach((delay, index) => {
         setTimeout(() => {
          const s = getSession(currentSessionId);
          if (success || !socket.searchTempFile || !s?.sftp) return;
           
          s.sftp.readFile(tempFile, (err, data) => {
            if (success) return;
             
             if (!err && data) {
               const output = data.toString().trim();
               if (output.length > 10) {
                 success = true;
                 socket.emit('package.search.results', output);
                s.shellStream?.write(`rm -f "${tempFile}"\n`);
                 delete socket.searchTempFile;
                 delete socket.searchStartTime;
                 return;
               }
             }
             
             if (index === readAttempts.length - 1 && !success && socket.searchTempFile) {
               socket.emit('package.search.error', 'Could not read search results. Check terminal for output.');
               delete socket.searchTempFile;
               delete socket.searchStartTime;
             }
           });
         }, delay);
       });
     });

    socket.on('installPackage', (packageName) => {
      const session = getSession(currentSessionId);
      if (!session?.shellStream) {
        socket.emit('ssh.error', 'No active SSH session');
        return;
      }
      
      const installCmd = session.passwordForSudo
        ? `if command -v apt >/dev/null 2>&1; then printf '%s\\n' '${session.passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S apt-get install -y "${packageName}"; elif command -v dnf >/dev/null 2>&1; then printf '%s\\n' '${session.passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S dnf install -y "${packageName}"; elif command -v yum >/dev/null 2>&1; then printf '%s\\n' '${session.passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S yum install -y "${packageName}"; else echo "No supported package manager found"; fi`
        : `if command -v apt >/dev/null 2>&1; then apt-get install -y "${packageName}"; elif command -v dnf >/dev/null 2>&1; then dnf install -y "${packageName}"; elif command -v yum >/dev/null 2>&1; then yum install -y "${packageName}"; else echo "No supported package manager found"; fi`;
      
      session.shellStream.write(installCmd + os.EOL);
      socket.emit('package.install.started', packageName);
    });

    // ========== SFTP File Browser Operations ==========

    socket.on('sftp.list', (remotePath) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('sftp.error', 'SFTP not available. Please reconnect.');
        return;
      }

      session.sftp.readdir(remotePath, (err, list) => {
        if (err) {
          socket.emit('sftp.error', `Cannot read directory: ${err.message}`);
          return;
        }

        const files = list.map((item) => {
          const isDirectory = item.attrs.isDirectory();
          const isSymlink = item.attrs.isSymbolicLink();
          return {
            name: item.filename,
            path: `${remotePath}/${item.filename}`.replace(/\/+/g, '/'),
            type: isDirectory ? 'directory' : isSymlink ? 'symlink' : 'file',
            size: item.attrs.size || 0,
            modified: new Date(item.attrs.mtime * 1000).toISOString(),
            permissions: item.attrs.mode ? item.attrs.mode.toString(8).slice(-3) : '644',
          };
        });

        socket.emit('sftp.list', { path: remotePath, files });
      });
    });

    socket.on('sftp.readFile', (remotePath) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      session.sftp.readFile(remotePath, (err, data) => {
        if (err) {
          socket.emit('sftp.error', `Cannot read file: ${err.message}`);
          return;
        }

        socket.emit('sftp.fileContent', {
          path: remotePath,
          content: data.toString('utf8'),
        });
      });
    });

    socket.on('sftp.writeFile', ({ path: remotePath, content, encoding }) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      const buffer = encoding === 'base64' 
        ? Buffer.from(content, 'base64')
        : Buffer.from(content, 'utf8');

      session.sftp.writeFile(remotePath, buffer, (err) => {
        if (err) {
          socket.emit('sftp.error', `Cannot write file: ${err.message}`);
          return;
        }

        socket.emit('sftp.saved', remotePath);
        socket.emit('sftp.success', `File saved: ${remotePath.split('/').pop()}`);
      });
    });

    socket.on('sftp.mkdir', (remotePath) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      session.sftp.mkdir(remotePath, (err) => {
        if (err) {
          socket.emit('sftp.error', `Cannot create directory: ${err.message}`);
          return;
        }

        socket.emit('sftp.success', `Directory created: ${remotePath.split('/').pop()}`);
      });
    });

    socket.on('sftp.rmdir', (remotePath) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      const deleteRecursive = (dirPath, callback) => {
        session.sftp.readdir(dirPath, (err, list) => {
          if (err) return callback(err);

          let pending = list.length;
          if (!pending) {
            return session.sftp.rmdir(dirPath, callback);
          }

          list.forEach((item) => {
            const itemPath = `${dirPath}/${item.filename}`;
            if (item.attrs.isDirectory()) {
              deleteRecursive(itemPath, (err) => {
                if (err) return callback(err);
                if (!--pending) session.sftp.rmdir(dirPath, callback);
              });
            } else {
              session.sftp.unlink(itemPath, (err) => {
                if (err) return callback(err);
                if (!--pending) session.sftp.rmdir(dirPath, callback);
              });
            }
          });
        });
      };

      deleteRecursive(remotePath, (err) => {
        if (err) {
          socket.emit('sftp.error', `Cannot delete directory: ${err.message}`);
          return;
        }

        socket.emit('sftp.success', `Directory deleted: ${remotePath.split('/').pop()}`);
      });
    });

    socket.on('sftp.unlink', (remotePath) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      session.sftp.unlink(remotePath, (err) => {
        if (err) {
          socket.emit('sftp.error', `Cannot delete file: ${err.message}`);
          return;
        }

        socket.emit('sftp.success', `File deleted: ${remotePath.split('/').pop()}`);
      });
    });

    socket.on('sftp.rename', ({ oldPath, newPath }) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      session.sftp.rename(oldPath, newPath, (err) => {
        if (err) {
          socket.emit('sftp.error', `Cannot rename: ${err.message}`);
          return;
        }

        socket.emit('sftp.success', `Renamed to: ${newPath.split('/').pop()}`);
      });
    });

    socket.on('sftp.copy', ({ src, dest }) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      session.sftp.readFile(src, (err, data) => {
        if (err) {
          socket.emit('sftp.error', `Cannot copy: ${err.message}`);
          return;
        }

        session.sftp.writeFile(dest, data, (err) => {
          if (err) {
            socket.emit('sftp.error', `Cannot copy: ${err.message}`);
            return;
          }

          socket.emit('sftp.success', `Copied to: ${dest.split('/').pop()}`);
        });
      });
    });

    socket.on('sftp.download', (remotePath) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      session.sftp.readFile(remotePath, (err, data) => {
        if (err) {
          socket.emit('sftp.error', `Cannot download: ${err.message}`);
          return;
        }

        socket.emit('sftp.downloadData', {
          path: remotePath,
          filename: remotePath.split('/').pop(),
          content: data.toString('base64'),
        });
      });
    });

    socket.on('sftp.upload', ({ path: remotePath, content, encoding }) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      const buffer = encoding === 'base64' 
        ? Buffer.from(content, 'base64')
        : Buffer.from(content, 'utf8');

      session.sftp.writeFile(remotePath, buffer, (err) => {
        if (err) {
          socket.emit('sftp.error', `Cannot upload: ${err.message}`);
          return;
        }

        socket.emit('sftp.success', `Uploaded: ${remotePath.split('/').pop()}`);
      });
    });

    // ========== System Monitoring ==========
    let monitoringInterval = null;
    let isMonitoringActive = false;

    const collectSystemMetrics = (session, callback) => {
      if (!isMonitoringActive) return; // Don't run if monitoring stopped
      if (!session?.shellStream || !session?.sftp) return;

      const tempFile = `/tmp/metrics_${Date.now()}.json`;
      
      // Simpler, more reliable metrics collection script
      const metricsScript = `#!/bin/bash
# CPU metrics
cpu_idle=$(top -bn1 2>/dev/null | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" || echo "100")
cpu_usage=$(awk "BEGIN {printf \\"%.1f\\", 100 - $cpu_idle}")
cores=$(nproc 2>/dev/null || grep -c processor /proc/cpuinfo 2>/dev/null || echo "1")
model=$(grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | sed 's/^ *//' | sed 's/"/\\\\"/g' || echo "Unknown")
loadavg=$(cat /proc/loadavg 2>/dev/null | awk '{print $1","$2","$3}' || echo "0,0,0")

# Memory metrics
mem_total=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2 * 1024}' || echo "0")
mem_free=$(grep MemFree /proc/meminfo 2>/dev/null | awk '{print $2 * 1024}' || echo "0")
mem_available=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2 * 1024}' || echo "0")
mem_cached=$(grep "^Cached:" /proc/meminfo 2>/dev/null | awk '{print $2 * 1024}' || echo "0")
mem_used=$((mem_total - mem_available))
if [ "$mem_total" -gt 0 ]; then
  mem_pct=$(awk "BEGIN {printf \\"%.1f\\", $mem_used * 100 / $mem_total}")
else
  mem_pct="0"
fi

# Disk metrics
disk_info=$(df -B1 / 2>/dev/null | tail -1)
disk_total=$(echo "$disk_info" | awk '{print $2}')
disk_used=$(echo "$disk_info" | awk '{print $3}')
disk_free=$(echo "$disk_info" | awk '{print $4}')
disk_pct=$(echo "$disk_info" | awk '{gsub(/%/,""); print $5}')

# Network interfaces
net_json=""
for iface in $(ls /sys/class/net/ 2>/dev/null); do
  rx=$(cat /sys/class/net/$iface/statistics/rx_bytes 2>/dev/null || echo 0)
  tx=$(cat /sys/class/net/$iface/statistics/tx_bytes 2>/dev/null || echo 0)
  rxp=$(cat /sys/class/net/$iface/statistics/rx_packets 2>/dev/null || echo 0)
  txp=$(cat /sys/class/net/$iface/statistics/tx_packets 2>/dev/null || echo 0)
  if [ -n "$net_json" ]; then net_json="$net_json,"; fi
  net_json="$net_json{\\"name\\":\\"$iface\\",\\"rxBytes\\":$rx,\\"txBytes\\":$tx,\\"rxPackets\\":$rxp,\\"txPackets\\":$txp}"
done

# Disk partitions
part_json=""
while read -r line; do
  mount=$(echo "$line" | awk '{print $6}')
  size=$(echo "$line" | awk '{print $2}')
  used=$(echo "$line" | awk '{print $3}')
  pct=$(echo "$line" | awk '{gsub(/%/,""); print $5}')
  if [ -n "$part_json" ]; then part_json="$part_json,"; fi
  part_json="$part_json{\\"mount\\":\\"$mount\\",\\"size\\":$size,\\"used\\":$used,\\"percentage\\":$pct}"
done < <(df -B1 2>/dev/null | awk 'NR>1 && $1 ~ /^\\/dev/')

uptime_sec=$(cat /proc/uptime 2>/dev/null | awk '{print int($1)}' || echo "0")
timestamp=$(date +%s)000

cat << JSONEOF
{
  "cpu": {
    "usage": $cpu_usage,
    "cores": $cores,
    "model": "$model",
    "loadAvg": [$loadavg]
  },
  "memory": {
    "total": $mem_total,
    "used": $mem_used,
    "free": $mem_free,
    "cached": $mem_cached,
    "percentage": $mem_pct
  },
  "disk": {
    "total": $disk_total,
    "used": $disk_used,
    "free": $disk_free,
    "percentage": $disk_pct,
    "partitions": [$part_json]
  },
  "network": {
    "interfaces": [$net_json]
  },
  "uptime": $uptime_sec,
  "timestamp": $timestamp
}
JSONEOF
`;

      // Write script to temp file and execute
      const scriptFile = `/tmp/metrics_script_${Date.now()}.sh`;
      session.sftp.writeFile(scriptFile, metricsScript, (err) => {
        if (err) {
          console.error('[Metrics] Failed to write script:', err.message);
          return;
        }
        
        session.shellStream.write(`bash ${scriptFile} > ${tempFile} 2>&1\n`);
        
        // Read metrics via SFTP after a delay
        setTimeout(() => {
          session.sftp.readFile(tempFile, (err, data) => {
            if (err) {
              console.error('[Metrics] Failed to read output:', err.message);
            } else if (data) {
              try {
                const jsonStr = data.toString().trim();
                // Try to find JSON in the output (skip any shell noise)
                const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const metrics = JSON.parse(jsonMatch[0]);
                  callback(metrics);
                } else {
                  console.error('[Metrics] No JSON found in output:', jsonStr.substring(0, 200));
                }
              } catch (e) {
                console.error('[Metrics] Parse error:', e.message, 'Data:', data.toString().substring(0, 200));
              }
            }
            // Cleanup
            session.shellStream?.write(`rm -f ${tempFile} ${scriptFile} 2>/dev/null\n`);
          });
        }, 2000);
      });
    };

    const collectProcesses = (session, callback) => {
      if (!isMonitoringActive) return; // Don't run if monitoring stopped
      if (!session?.sftp) return;

      const tempFile = `/tmp/procs_${Date.now()}.txt`;
      const cmd = `ps aux --sort=-%cpu | head -51 > ${tempFile}\n`;
      
      session.shellStream?.write(cmd);
      
      setTimeout(() => {
        session.sftp.readFile(tempFile, (err, data) => {
          if (!err && data) {
            const lines = data.toString().split('\n').slice(1).filter(l => l.trim());
            const processes = lines.map(line => {
              const parts = line.trim().split(/\s+/);
              return {
                user: parts[0],
                pid: parseInt(parts[1]),
                cpu: parseFloat(parts[2]),
                mem: parseFloat(parts[3]),
                vsz: parseInt(parts[4]),
                rss: parseInt(parts[5]),
                stat: parts[7],
                start: parts[8],
                time: parts[9],
                command: parts.slice(10).join(' '),
              };
            }).filter(p => !isNaN(p.pid));
            callback(processes);
          }
          session.shellStream?.write(`rm -f ${tempFile}\n`);
        });
      }, 500);
    };

    socket.on('monitoring.start', ({ interval }) => {
      const session = getSession(currentSessionId);
      if (!session) {
        socket.emit('ssh.error', 'No active session');
        return;
      }

      // Stop any existing monitoring first
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
      }
      
      isMonitoringActive = true;

      // Ensure minimum interval of 5 seconds to avoid flooding
      const actualInterval = Math.max(interval || 5000, 5000);
      console.log(`[Monitoring] Starting with interval ${actualInterval}ms`);

      const collect = () => {
        if (!isMonitoringActive) return; // Double-check before collecting
        
        const currentSession = getSession(currentSessionId);
        if (!currentSession) {
          console.log('[Monitoring] Session lost, stopping');
          isMonitoringActive = false;
          if (monitoringInterval) clearInterval(monitoringInterval);
          return;
        }
        
        collectSystemMetrics(currentSession, (metrics) => {
          if (isMonitoringActive) {
            socket.emit('monitoring.metrics', metrics);
          }
        });
        collectProcesses(currentSession, (processes) => {
          if (isMonitoringActive) {
            socket.emit('monitoring.processes', processes);
          }
        });
      };

      collect(); // Immediate first collection
      monitoringInterval = setInterval(collect, actualInterval);
    });

    socket.on('monitoring.stop', () => {
      console.log('[Monitoring] Stopping');
      isMonitoringActive = false;
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
      }
    });

    socket.on('monitoring.refresh', () => {
      const session = getSession(currentSessionId);
      if (!session) return;

      // For refresh, temporarily enable monitoring flag
      const wasActive = isMonitoringActive;
      isMonitoringActive = true;
      
      collectSystemMetrics(session, (metrics) => {
        socket.emit('monitoring.metrics', metrics);
        if (!wasActive) isMonitoringActive = false;
      });
      collectProcesses(session, (processes) => {
        socket.emit('monitoring.processes', processes);
      });
    });

    socket.on('monitoring.kill', ({ pid, signal }) => {
      const session = getSession(currentSessionId);
      if (!session?.shellStream) return;

      session.shellStream.write(`kill -${signal || 'TERM'} ${pid}\n`);
    });

    // ========== Log Streaming ==========
    let logInterval = null;
    let logSources = [];
    let isLogStreamingActive = false;

    // Build command for fetching logs - handles both journald and traditional files
    const buildLogCommand = (source, linesToFetch, tempFile, password) => {
      // Check if this is a journald source (starts with "journald:")
      if (source.startsWith('journald:')) {
        const journalType = source.replace('journald:', '');
        let journalCmd;
        
        switch (journalType) {
          case 'system':
            journalCmd = `journalctl --no-pager -n ${linesToFetch}`;
            break;
          case 'kernel':
            journalCmd = `journalctl --no-pager -k -n ${linesToFetch}`;
            break;
          case 'auth':
            journalCmd = `journalctl --no-pager -u ssh -u sshd -u systemd-logind -n ${linesToFetch}`;
            break;
          case 'nginx':
            journalCmd = `journalctl --no-pager -u nginx -n ${linesToFetch}`;
            break;
          case 'apache':
            journalCmd = `journalctl --no-pager -u apache2 -u httpd -n ${linesToFetch}`;
            break;
          default:
            // Custom unit
            journalCmd = `journalctl --no-pager -u ${journalType} -n ${linesToFetch}`;
        }
        
        if (password) {
          return `printf '%s\\n' '${password.replace(/'/g, "'\\''")}' | sudo -S ${journalCmd} > ${tempFile} 2>/dev/null || ${journalCmd} > ${tempFile} 2>/dev/null`;
        }
        return `${journalCmd} > ${tempFile} 2>/dev/null`;
      }
      
      // Traditional file-based log
      if (password) {
        return `printf '%s\\n' '${password.replace(/'/g, "'\\''")}' | sudo -S tail -n ${linesToFetch} "${source}" > ${tempFile} 2>/dev/null || tail -n ${linesToFetch} "${source}" > ${tempFile} 2>/dev/null`;
      }
      return `tail -n ${linesToFetch} "${source}" > ${tempFile} 2>/dev/null`;
    };

    const fetchLogs = (session, sources, initialLines, isInitial) => {
      if (!session?.sftp || !isLogStreamingActive) return;

      sources.forEach(source => {
        const tempFile = `/tmp/logs_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`;
        const linesToFetch = isInitial ? (initialLines || 100) : 50;
        
        // Build the appropriate command
        const cmd = buildLogCommand(source, linesToFetch, tempFile, session.passwordForSudo);
        session.shellStream?.write(`${cmd}\n`);

        setTimeout(() => {
          if (!isLogStreamingActive && !isInitial) return;
          
          session.sftp.readFile(tempFile, (err, data) => {
            if (!err && data) {
              const content = data.toString();
              const logLines = content.split('\n').filter(l => l.trim());
              
              if (logLines.length > 0) {
                // For streaming, deduplicate by checking if we've seen these lines
                const sourceKey = source.replace(/[^a-z0-9]/gi, '_');
                if (!isInitial && socket[`lastLogs_${sourceKey}`]) {
                  const lastLines = socket[`lastLogs_${sourceKey}`];
                  // Only send lines we haven't seen
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
                
                // Store last lines for deduplication
                socket[`lastLogs_${sourceKey}`] = logLines.slice(-100);
              } else if (isInitial) {
                // File might not exist or is empty - notify user
                const isJournald = source.startsWith('journald:');
                const msg = isJournald 
                  ? `No data from ${source} - service may not exist or have no logs`
                  : `No data from ${source} - file may not exist or is empty`;
                socket.emit('logs.error', msg);
              }
            } else if (err && isInitial) {
              console.log(`[Logs] Could not read ${source}: ${err.message}`);
              socket.emit('logs.error', `Cannot read ${source}: check if file/service exists`);
            }
            session.shellStream?.write(`rm -f ${tempFile} 2>/dev/null\n`);
          });
        }, 2000);
      });
    };

    socket.on('logs.start', ({ sources, lines }) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('logs.error', 'No active session');
        return;
      }

      // Stop existing streaming
      if (logInterval) {
        clearInterval(logInterval);
        logInterval = null;
      }
      
      isLogStreamingActive = true;
      logSources = sources;
      
      // Clear cached last lines
      sources.forEach(source => {
        const sourceKey = source.replace(/[^a-z0-9]/gi, '_');
        delete socket[`lastLogs_${sourceKey}`];
      });

      console.log(`[Logs] Starting log stream for ${sources.length} sources: ${sources.join(', ')}`);

      // Initial fetch
      fetchLogs(session, sources, lines, true);

      // Start polling for new logs every 3 seconds
      logInterval = setInterval(() => {
        if (!isLogStreamingActive) return;
        const currentSession = getSession(currentSessionId);
        if (currentSession) {
          fetchLogs(currentSession, logSources, lines, false);
        }
      }, 3000);
    });

    socket.on('logs.stop', () => {
      console.log('[Logs] Stopping log stream');
      isLogStreamingActive = false;
      if (logInterval) {
        clearInterval(logInterval);
        logInterval = null;
      }
      logSources = [];
    });

    socket.on('logs.fetch', ({ sources, lines }) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('logs.error', 'No active session');
        return;
      }

      console.log(`[Logs] Fetching logs from ${sources.length} sources`);
      // Temporarily enable for one-time fetch
      const wasActive = isLogStreamingActive;
      isLogStreamingActive = true;
      fetchLogs(session, sources, lines, true);
      setTimeout(() => {
        if (!wasActive) isLogStreamingActive = false;
      }, 2000);
    });

    // ========== Network Monitoring ==========
    let networkInterval = null;
    let prevNetStats = {};

    const collectNetworkData = (session, callback) => {
      if (!session?.sftp) return;

      const tempFile = `/tmp/netdata_${Date.now()}.json`;
      const script = `
        echo "{"
        echo '"interfaces": ['
        
        for iface in $(ls /sys/class/net/); do
          ipv4=$(ip -4 addr show $iface 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1 | head -1)
          ipv6=$(ip -6 addr show $iface 2>/dev/null | grep 'inet6 ' | awk '{print $2}' | cut -d'/' -f1 | head -1)
          mac=$(cat /sys/class/net/$iface/address 2>/dev/null)
          state=$(cat /sys/class/net/$iface/operstate 2>/dev/null)
          mtu=$(cat /sys/class/net/$iface/mtu 2>/dev/null || echo 1500)
          rx=$(cat /sys/class/net/$iface/statistics/rx_bytes 2>/dev/null || echo 0)
          tx=$(cat /sys/class/net/$iface/statistics/tx_bytes 2>/dev/null || echo 0)
          rxp=$(cat /sys/class/net/$iface/statistics/rx_packets 2>/dev/null || echo 0)
          txp=$(cat /sys/class/net/$iface/statistics/tx_packets 2>/dev/null || echo 0)
          rxe=$(cat /sys/class/net/$iface/statistics/rx_errors 2>/dev/null || echo 0)
          txe=$(cat /sys/class/net/$iface/statistics/tx_errors 2>/dev/null || echo 0)
          speed=$(cat /sys/class/net/$iface/speed 2>/dev/null || echo 0)
          
          echo "{\\"name\\":\\"$iface\\",\\"ipv4\\":\\"$ipv4\\",\\"ipv6\\":\\"$ipv6\\",\\"mac\\":\\"$mac\\",\\"state\\":\\"$state\\",\\"mtu\\":$mtu,\\"rxBytes\\":$rx,\\"txBytes\\":$tx,\\"rxPackets\\":$rxp,\\"txPackets\\":$txp,\\"rxErrors\\":$rxe,\\"txErrors\\":$txe,\\"speed\\":$speed},"
        done | sed '$ s/,$//'
        
        echo '],'
        echo '"connections": ['
        
        ss -tunp 2>/dev/null | awk 'NR>1 {
          proto=$1
          state=$2
          local=$5
          remote=$6
          proc=$7
          gsub(/users:\\(\\("|",pid=|,fd=.*\\)\\)/, " ", proc)
          split(local, l, ":")
          split(remote, r, ":")
          lport=l[length(l)]
          rport=r[length(r)]
          lip=l[1]; for(i=2;i<length(l);i++) lip=lip":"l[i]
          rip=r[1]; for(i=2;i<length(r);i++) rip=rip":"r[i]
          gsub(/\\[|\\]/, "", lip)
          gsub(/\\[|\\]/, "", rip)
          split(proc, p, " ")
          printf "{\\"protocol\\":\\"%s\\",\\"state\\":\\"%s\\",\\"localAddress\\":\\"%s\\",\\"localPort\\":%s,\\"remoteAddress\\":\\"%s\\",\\"remotePort\\":%s,\\"pid\\":%s,\\"process\\":\\"%s\\"},", proto, state, lip, lport, rip, (rport ~ /^[0-9]+$/ ? rport : 0), (p[2] ~ /^[0-9]+$/ ? p[2] : 0), p[1]
        }' | sed 's/,$//'
        
        echo "]}"
      `;

      session.shellStream?.write(`bash -c '${script.replace(/'/g, "'\\''")}' > ${tempFile} 2>/dev/null\n`);

      setTimeout(() => {
        session.sftp.readFile(tempFile, (err, data) => {
          if (!err && data) {
            try {
              const netData = JSON.parse(data.toString());
              // Add unique IDs to connections
              netData.connections = (netData.connections || []).map((c, i) => ({
                ...c,
                id: `${c.protocol}-${c.localPort}-${c.remoteAddress}-${c.remotePort}-${i}`,
              }));
              callback(netData);
            } catch {
              // Parse error
            }
          }
          session.shellStream?.write(`rm -f ${tempFile}\n`);
        });
      }, 1000);
    };

    socket.on('network.start', ({ interval }) => {
      const session = getSession(currentSessionId);
      if (!session) {
        socket.emit('network.error', 'No active session');
        return;
      }

      if (networkInterval) clearInterval(networkInterval);

      const collect = () => {
        collectNetworkData(session, (data) => {
          socket.emit('network.interfaces', data.interfaces || []);
          socket.emit('network.connections', data.connections || []);

          // Calculate bandwidth
          data.interfaces?.forEach(iface => {
            const prev = prevNetStats[iface.name];
            if (prev) {
              const timeDiff = (Date.now() - prev.timestamp) / 1000;
              socket.emit('network.bandwidth', {
                timestamp: Date.now(),
                interface: iface.name,
                rxBytesPerSec: (iface.rxBytes - prev.rxBytes) / timeDiff,
                txBytesPerSec: (iface.txBytes - prev.txBytes) / timeDiff,
              });
            }
            prevNetStats[iface.name] = {
              rxBytes: iface.rxBytes,
              txBytes: iface.txBytes,
              timestamp: Date.now(),
            };
          });
        });
      };

      collect();
      networkInterval = setInterval(collect, interval || 5000);
    });

    socket.on('network.stop', () => {
      if (networkInterval) {
        clearInterval(networkInterval);
        networkInterval = null;
      }
    });

    socket.on('network.refresh', () => {
      const session = getSession(currentSessionId);
      if (!session) return;
      collectNetworkData(session, (data) => {
        socket.emit('network.interfaces', data.interfaces || []);
        socket.emit('network.connections', data.connections || []);
      });
    });

    socket.on('network.scan', ({ target, ports }) => {
      const session = getSession(currentSessionId);
      if (!session?.shellStream) {
        socket.emit('network.error', 'No active session');
        return;
      }

      // Parse port range
      let portList = [];
      ports.split(',').forEach(part => {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          for (let i = start; i <= end && i <= 65535; i++) {
            portList.push(i);
          }
        } else {
          portList.push(parseInt(part));
        }
      });
      portList = portList.filter(p => !isNaN(p) && p > 0 && p <= 65535);

      const total = portList.length;
      let scanned = 0;

      // Simple port scan using bash
      const scanPort = (port) => {
        const tempFile = `/tmp/scan_${port}_${Date.now()}.txt`;
        const cmd = `timeout 1 bash -c "echo >/dev/tcp/${target}/${port}" 2>/dev/null && echo "open" > ${tempFile} || echo "closed" > ${tempFile}\n`;
        session.shellStream.write(cmd);

        setTimeout(() => {
          session.sftp.readFile(tempFile, (err, data) => {
            scanned++;
            socket.emit('network.scan.progress', Math.round((scanned / total) * 100));

            if (!err && data) {
              const state = data.toString().trim() === 'open' ? 'open' : 'closed';
              if (state === 'open') {
                socket.emit('network.scan.result', { port, state, service: '' });
              }
            }

            session.shellStream?.write(`rm -f ${tempFile}\n`);

            if (scanned >= total) {
              socket.emit('network.scan.complete');
            }
          });
        }, 1500);
      };

      // Scan in batches
      let idx = 0;
      const batchSize = 10;
      const scanBatch = () => {
        const batch = portList.slice(idx, idx + batchSize);
        batch.forEach(port => scanPort(port));
        idx += batchSize;
        if (idx < portList.length) {
          setTimeout(scanBatch, 2000);
        }
      };
      scanBatch();
    });

    socket.on('network.discover', () => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('network.error', 'No active session');
        return;
      }

      const tempFile = `/tmp/discovery_${Date.now()}.json`;
      const script = `
        echo "["
        # Get ARP table entries
        arp -n 2>/dev/null | awk 'NR>1 && $1 !~ /incomplete/ {
          printf "{\\"ip\\":\\"%s\\",\\"mac\\":\\"%s\\",\\"type\\":\\"unknown\\",\\"status\\":\\"online\\"},", $1, $3
        }' | sed 's/,$//'
        echo "]"
      `;

      session.shellStream?.write(`bash -c '${script}' > ${tempFile} 2>/dev/null\n`);

      setTimeout(() => {
        session.sftp.readFile(tempFile, (err, data) => {
          if (!err && data) {
            try {
              let nodes = JSON.parse(data.toString());
              nodes = nodes.map((n, i) => ({
                ...n,
                id: `node-${i}`,
                hostname: null,
              }));
              socket.emit('network.discovery', nodes);
            } catch {
              socket.emit('network.error', 'Failed to parse discovery results');
            }
          }
          session.shellStream?.write(`rm -f ${tempFile}\n`);
        });
      }, 1000);
    });

    // ========================================
    // CTF TOOLS HANDLERS
    // ========================================

    // Check if a tool is installed
    socket.on('ctf.checkTool', ({ toolId, checkCmd }) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('ctf.toolStatus', { toolId, installed: false });
        return;
      }

      const tempFile = `/tmp/ctf_check_${toolId}_${Date.now()}.txt`;
      session.shellStream?.write(`${checkCmd} > ${tempFile} 2>&1 && echo "FOUND" >> ${tempFile} || echo "NOTFOUND" >> ${tempFile}\n`);

      setTimeout(() => {
        session.sftp.readFile(tempFile, (err, data) => {
          let installed = false;
          if (!err && data) {
            const result = data.toString();
            installed = result.includes('FOUND') && !result.includes('NOTFOUND');
          }
          socket.emit('ctf.toolStatus', { toolId, installed });
          session.shellStream?.write(`rm -f ${tempFile}\n`);
        });
      }, 1000);
    });

    // Install a tool
    socket.on('ctf.installTool', ({ toolId, installCmd }) => {
      const session = getSession(currentSessionId);
      if (!session?.sftp) {
        socket.emit('ctf.installComplete', { toolId, success: false });
        return;
      }

      const tempFile = `/tmp/ctf_install_${toolId}_${Date.now()}.txt`;
      const sudoPrefix = session.passwordForSudo ? `echo '${session.passwordForSudo}' | sudo -S ` : 'sudo ';
      
      // Run install command
      session.shellStream?.write(`${sudoPrefix}${installCmd} > ${tempFile} 2>&1 && echo "SUCCESS" >> ${tempFile} || echo "FAILED" >> ${tempFile}\n`);

      // Check result after install completes (give it more time)
      setTimeout(() => {
        session.sftp.readFile(tempFile, (err, data) => {
          let success = false;
          if (!err && data) {
            const result = data.toString();
            success = result.includes('SUCCESS');
          }
          socket.emit('ctf.installComplete', { toolId, success });
          session.shellStream?.write(`rm -f ${tempFile}\n`);
        });
      }, 15000); // 15 seconds for install
    });

    // Run a CTF tool command
    let ctfCommandBuffer = '';
    let ctfCommandTimeout = null;

    socket.on('ctf.runCommand', ({ command }) => {
      const session = getSession(currentSessionId);
      if (!session?.shellStream) {
        socket.emit('ctf.commandOutput', { output: 'Error: No active session\n', done: true });
        return;
      }

      ctfCommandBuffer = '';
      const tempFile = `/tmp/ctf_output_${Date.now()}.txt`;
      const marker = `CTF_CMD_DONE_${Date.now()}`;

      // Run command with output capture
      const fullCmd = `(${command}) > ${tempFile} 2>&1; echo "${marker}"\n`;
      session.shellStream?.write(fullCmd);

      // Stream output
      const checkOutput = () => {
        session.sftp.readFile(tempFile, (err, data) => {
          if (!err && data) {
            const newOutput = data.toString();
            if (newOutput.length > ctfCommandBuffer.length) {
              const delta = newOutput.substring(ctfCommandBuffer.length);
              ctfCommandBuffer = newOutput;
              socket.emit('ctf.commandOutput', { output: delta, done: false });
            }
          }
        });
      };

      // Check periodically for new output
      const outputInterval = setInterval(checkOutput, 500);

      // Look for completion marker in shell output
      const completionListener = (data) => {
        if (data.toString().includes(marker)) {
          clearInterval(outputInterval);
          clearTimeout(ctfCommandTimeout);
          session.shellStream?.removeListener('data', completionListener);
          
          // Final read
          setTimeout(() => {
            session.sftp.readFile(tempFile, (err, data) => {
              if (!err && data) {
                const finalOutput = data.toString();
                if (finalOutput.length > ctfCommandBuffer.length) {
                  const delta = finalOutput.substring(ctfCommandBuffer.length);
                  socket.emit('ctf.commandOutput', { output: delta, done: false });
                }
              }
              socket.emit('ctf.commandOutput', { output: '', done: true });
              session.shellStream?.write(`rm -f ${tempFile}\n`);
            });
          }, 500);
        }
      };
      
      session.shellStream?.on('data', completionListener);

      // Timeout after 5 minutes
      ctfCommandTimeout = setTimeout(() => {
        clearInterval(outputInterval);
        session.shellStream?.removeListener('data', completionListener);
        socket.emit('ctf.commandOutput', { output: '\n[Command timed out after 5 minutes]\n', done: true });
        session.shellStream?.write(`rm -f ${tempFile}\n`);
      }, 300000);
    });

    // Stop running command
    socket.on('ctf.stopCommand', () => {
      const session = getSession(currentSessionId);
      if (session?.shellStream) {
        session.shellStream.write('\x03'); // Ctrl+C
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      isMonitoringActive = false;
      isLogStreamingActive = false;
      if (monitoringInterval) clearInterval(monitoringInterval);
      if (networkInterval) clearInterval(networkInterval);
      if (logInterval) clearInterval(logInterval);
      detachFromSession();
    });
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server ready on http://localhost:${port}`);
  });
}

start();
