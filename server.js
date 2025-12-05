/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');
const next = require('next');
const { Server } = require('socket.io');
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const os = require('os');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

function findScript(scriptName) {
  const candidate = path.join(process.cwd(), 'scripts', scriptName);
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

async function start() {
  await app.prepare();
  const server = http.createServer((req, res) => handle(req, res));
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    const conn = new Client();
    let shellStream = null;
    let sftp = null;
    let passwordForSudo = '';

    socket.on('disconnect', () => {
      try {
        shellStream?.end();
        conn.end();
      } catch (e) {
        console.error('disconnect error', e.message);
      }
    });

    socket.on('startSSHConnection', ({ ip, username, password, port, sshKeyContent, passphrase }) => {
      passwordForSudo = password || '';
      conn
        .on('ready', () => {
          socket.emit('ssh.status', 'SSH connected');
          conn.shell({ pty: true }, (err, stream) => {
            if (err) {
              socket.emit('ssh.error', err.message);
              return;
            }
       shellStream = stream;
       stream.on('data', (data) => {
         const output = data.toString();
         socket.emit('output', output);
         
         // Note: Search results are now read via SFTP file reading, not from terminal output
         // This avoids issues with command echoes and terminal noise
       });
      stream.on('close', () => socket.emit('ssh.status', 'Shell closed'));
          });

          conn.sftp((err, s) => {
            if (err) {
              socket.emit('ssh.error', 'SFTP unavailable');
              return;
            }
            sftp = s;
            socket.emit('sftp.ready');
          });
        })
        .on('error', (err) => {
          socket.emit('ssh.error', err.message);
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

    socket.on('input', (data) => {
      if (!shellStream) return;
      shellStream.write(data);
    });

    socket.on('resize', ({ rows, cols }) => {
      if (shellStream && shellStream.setWindow) {
        shellStream.setWindow(rows || 24, cols || 80, 600, 800);
      }
    });

    async function transferAndRun(scriptName, args = []) {
      if (!sftp || !shellStream) {
        socket.emit('ssh.error', 'No active SSH/SFTP session');
        return;
      }
      const scriptPath = findScript(scriptName);
      if (!scriptPath) {
        socket.emit('ssh.error', `Script not found: ${scriptName}`);
        return;
      }
      const remoteName = `/tmp/script_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.sh`;

      await new Promise((resolve, reject) => {
        sftp.fastPut(scriptPath, remoteName, {}, (err) =>
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
        passwordForSudo
          ? `printf '%s\\n' '${passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S ${remoteName} ${argList}`
          : `${remoteName} ${argList}`,
        `rm -f ${remoteName}`,
      ].join(' && ');

      shellStream.write(cmd + os.EOL);
    }

    socket.on('runScript', ({ scriptName, args }) => {
      transferAndRun(scriptName, args);
    });

     socket.on('searchPackages', async (query) => {
       if (!shellStream || !sftp) {
         socket.emit('package.search.error', 'No active SSH session');
         return;
       }
       
       // Use temporary file approach - read via SFTP for reliable results
       const tempFile = `/tmp/pkg_search_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.txt`;
       
       // Run search and save to temp file (no cat/echo, just write to file)
       const searchCmd = `if command -v apt >/dev/null 2>&1; then apt search "${query}" 2>/dev/null | head -20 > "${tempFile}" 2>&1; elif command -v dnf >/dev/null 2>&1; then dnf search "${query}" 2>/dev/null | head -20 > "${tempFile}" 2>&1; elif command -v yum >/dev/null 2>&1; then yum search "${query}" 2>/dev/null | head -20 > "${tempFile}" 2>&1; else echo "No supported package manager found" > "${tempFile}"; fi`;
       
       // Store temp file for this search
       socket.searchTempFile = tempFile;
       socket.searchStartTime = Date.now();
       
       // Execute search command
       shellStream.write(searchCmd + os.EOL);
       socket.emit('package.search.started');
       
       // Read file via SFTP after delays (file might not be ready immediately)
       const readAttempts = [2000, 3000, 5000]; // Try multiple times
       let success = false;
       
       readAttempts.forEach((delay, index) => {
         setTimeout(() => {
           if (success || !socket.searchTempFile || !sftp) return;
           
           sftp.readFile(tempFile, (err, data) => {
             if (success) return; // Already succeeded
             
             if (!err && data) {
               const output = data.toString().trim();
               if (output.length > 10) {
                 success = true;
                 socket.emit('package.search.results', output);
                 // Clean up file
                 shellStream.write(`rm -f "${tempFile}"\n`);
                 delete socket.searchTempFile;
                 delete socket.searchStartTime;
                 return;
               }
             }
             
             // If last attempt failed, emit error
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
      if (!shellStream) {
        socket.emit('ssh.error', 'No active SSH session');
        return;
      }
      
      // Detect package manager and install
      const installCmd = passwordForSudo
        ? `if command -v apt >/dev/null 2>&1; then printf '%s\\n' '${passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S apt-get install -y "${packageName}"; elif command -v dnf >/dev/null 2>&1; then printf '%s\\n' '${passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S dnf install -y "${packageName}"; elif command -v yum >/dev/null 2>&1; then printf '%s\\n' '${passwordForSudo.replace(/'/g, "'\\''")}' | sudo -S yum install -y "${packageName}"; else echo "No supported package manager found"; fi`
        : `if command -v apt >/dev/null 2>&1; then apt-get install -y "${packageName}"; elif command -v dnf >/dev/null 2>&1; then dnf install -y "${packageName}"; elif command -v yum >/dev/null 2>&1; then yum install -y "${packageName}"; else echo "No supported package manager found"; fi`;
      
      shellStream.write(installCmd + os.EOL);
      socket.emit('package.install.started', packageName);
    });

    // ========== SFTP File Browser Operations ==========

    socket.on('sftp.list', (remotePath) => {
      if (!sftp) {
        socket.emit('sftp.error', 'SFTP not available. Please reconnect.');
        return;
      }

      sftp.readdir(remotePath, (err, list) => {
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
      if (!sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      sftp.readFile(remotePath, (err, data) => {
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
      if (!sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      const buffer = encoding === 'base64' 
        ? Buffer.from(content, 'base64')
        : Buffer.from(content, 'utf8');

      sftp.writeFile(remotePath, buffer, (err) => {
        if (err) {
          socket.emit('sftp.error', `Cannot write file: ${err.message}`);
          return;
        }

        socket.emit('sftp.saved', remotePath);
        socket.emit('sftp.success', `File saved: ${remotePath.split('/').pop()}`);
      });
    });

    socket.on('sftp.mkdir', (remotePath) => {
      if (!sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      sftp.mkdir(remotePath, (err) => {
        if (err) {
          socket.emit('sftp.error', `Cannot create directory: ${err.message}`);
          return;
        }

        socket.emit('sftp.success', `Directory created: ${remotePath.split('/').pop()}`);
      });
    });

    socket.on('sftp.rmdir', (remotePath) => {
      if (!sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      // Use recursive delete for directories
      const deleteRecursive = (dirPath, callback) => {
        sftp.readdir(dirPath, (err, list) => {
          if (err) return callback(err);

          let pending = list.length;
          if (!pending) {
            return sftp.rmdir(dirPath, callback);
          }

          list.forEach((item) => {
            const itemPath = `${dirPath}/${item.filename}`;
            if (item.attrs.isDirectory()) {
              deleteRecursive(itemPath, (err) => {
                if (err) return callback(err);
                if (!--pending) sftp.rmdir(dirPath, callback);
              });
            } else {
              sftp.unlink(itemPath, (err) => {
                if (err) return callback(err);
                if (!--pending) sftp.rmdir(dirPath, callback);
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
      if (!sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      sftp.unlink(remotePath, (err) => {
        if (err) {
          socket.emit('sftp.error', `Cannot delete file: ${err.message}`);
          return;
        }

        socket.emit('sftp.success', `File deleted: ${remotePath.split('/').pop()}`);
      });
    });

    socket.on('sftp.rename', ({ oldPath, newPath }) => {
      if (!sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      sftp.rename(oldPath, newPath, (err) => {
        if (err) {
          socket.emit('sftp.error', `Cannot rename: ${err.message}`);
          return;
        }

        socket.emit('sftp.success', `Renamed to: ${newPath.split('/').pop()}`);
      });
    });

    socket.on('sftp.copy', ({ src, dest }) => {
      if (!sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      // Read source and write to destination
      sftp.readFile(src, (err, data) => {
        if (err) {
          socket.emit('sftp.error', `Cannot copy: ${err.message}`);
          return;
        }

        sftp.writeFile(dest, data, (err) => {
          if (err) {
            socket.emit('sftp.error', `Cannot copy: ${err.message}`);
            return;
          }

          socket.emit('sftp.success', `Copied to: ${dest.split('/').pop()}`);
        });
      });
    });

    socket.on('sftp.download', (remotePath) => {
      if (!sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      sftp.readFile(remotePath, (err, data) => {
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
      if (!sftp) {
        socket.emit('sftp.error', 'SFTP not available');
        return;
      }

      const buffer = encoding === 'base64' 
        ? Buffer.from(content, 'base64')
        : Buffer.from(content, 'utf8');

      sftp.writeFile(remotePath, buffer, (err) => {
        if (err) {
          socket.emit('sftp.error', `Cannot upload: ${err.message}`);
          return;
        }

        socket.emit('sftp.success', `Uploaded: ${remotePath.split('/').pop()}`);
      });
    });
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server ready on http://localhost:${port}`);
  });
}

start();

