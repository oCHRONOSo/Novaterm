/**
 * SFTP File Operations Handler
 * Handles file browser operations
 */

class SFTPHandler {
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
   * Check if SFTP is available
   * @returns {boolean}
   */
  isSFTPAvailable() {
    const session = this.getSession();
    if (!session?.sftp) {
      this.socket.emit('sftp.error', 'SFTP not available. Please reconnect.');
      return false;
    }
    return true;
  }

  /**
   * List directory contents
   * @param {string} remotePath - Directory path
   */
  list(remotePath) {
    if (!this.isSFTPAvailable()) return;
    const session = this.getSession();

    session.sftp.readdir(remotePath, (err, list) => {
      if (err) {
        this.socket.emit('sftp.error', `Cannot read directory: ${err.message}`);
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

      this.socket.emit('sftp.list', { path: remotePath, files });
    });
  }

  /**
   * Read file contents
   * @param {string} remotePath - File path
   */
  readFile(remotePath) {
    if (!this.isSFTPAvailable()) return;
    const session = this.getSession();

    session.sftp.readFile(remotePath, (err, data) => {
      if (err) {
        this.socket.emit('sftp.error', `Cannot read file: ${err.message}`);
        return;
      }

      this.socket.emit('sftp.fileContent', {
        path: remotePath,
        content: data.toString('utf8'),
      });
    });
  }

  /**
   * Write file contents
   * @param {object} params - Write parameters
   */
  writeFile({ path: remotePath, content, encoding }) {
    if (!this.isSFTPAvailable()) return;
    const session = this.getSession();

    const buffer = encoding === 'base64'
      ? Buffer.from(content, 'base64')
      : Buffer.from(content, 'utf8');

    session.sftp.writeFile(remotePath, buffer, (err) => {
      if (err) {
        this.socket.emit('sftp.error', `Cannot write file: ${err.message}`);
        return;
      }

      this.socket.emit('sftp.saved', remotePath);
      this.socket.emit('sftp.success', `File saved: ${remotePath.split('/').pop()}`);
    });
  }

  /**
   * Create directory
   * @param {string} remotePath - Directory path
   */
  mkdir(remotePath) {
    if (!this.isSFTPAvailable()) return;
    const session = this.getSession();

    session.sftp.mkdir(remotePath, (err) => {
      if (err) {
        this.socket.emit('sftp.error', `Cannot create directory: ${err.message}`);
        return;
      }

      this.socket.emit('sftp.success', `Directory created: ${remotePath.split('/').pop()}`);
    });
  }

  /**
   * Remove directory recursively
   * @param {string} remotePath - Directory path
   */
  rmdir(remotePath) {
    if (!this.isSFTPAvailable()) return;
    const session = this.getSession();

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
        this.socket.emit('sftp.error', `Cannot delete directory: ${err.message}`);
        return;
      }

      this.socket.emit('sftp.success', `Directory deleted: ${remotePath.split('/').pop()}`);
    });
  }

  /**
   * Delete file
   * @param {string} remotePath - File path
   */
  unlink(remotePath) {
    if (!this.isSFTPAvailable()) return;
    const session = this.getSession();

    session.sftp.unlink(remotePath, (err) => {
      if (err) {
        this.socket.emit('sftp.error', `Cannot delete file: ${err.message}`);
        return;
      }

      this.socket.emit('sftp.success', `File deleted: ${remotePath.split('/').pop()}`);
    });
  }

  /**
   * Rename file or directory
   * @param {object} params - Rename parameters
   */
  rename({ oldPath, newPath }) {
    if (!this.isSFTPAvailable()) return;
    const session = this.getSession();

    session.sftp.rename(oldPath, newPath, (err) => {
      if (err) {
        this.socket.emit('sftp.error', `Cannot rename: ${err.message}`);
        return;
      }

      this.socket.emit('sftp.success', `Renamed to: ${newPath.split('/').pop()}`);
    });
  }

  /**
   * Copy file
   * @param {object} params - Copy parameters
   */
  copy({ src, dest }) {
    if (!this.isSFTPAvailable()) return;
    const session = this.getSession();

    session.sftp.readFile(src, (err, data) => {
      if (err) {
        this.socket.emit('sftp.error', `Cannot copy: ${err.message}`);
        return;
      }

      session.sftp.writeFile(dest, data, (err) => {
        if (err) {
          this.socket.emit('sftp.error', `Cannot copy: ${err.message}`);
          return;
        }

        this.socket.emit('sftp.success', `Copied to: ${dest.split('/').pop()}`);
      });
    });
  }

  /**
   * Download file (send as base64)
   * @param {string} remotePath - File path
   */
  download(remotePath) {
    if (!this.isSFTPAvailable()) return;
    const session = this.getSession();

    session.sftp.readFile(remotePath, (err, data) => {
      if (err) {
        this.socket.emit('sftp.error', `Cannot download: ${err.message}`);
        return;
      }

      this.socket.emit('sftp.downloadData', {
        path: remotePath,
        filename: remotePath.split('/').pop(),
        content: data.toString('base64'),
      });
    });
  }

  /**
   * Upload file
   * @param {object} params - Upload parameters
   */
  upload({ path: remotePath, content, encoding }) {
    if (!this.isSFTPAvailable()) return;
    const session = this.getSession();

    const buffer = encoding === 'base64'
      ? Buffer.from(content, 'base64')
      : Buffer.from(content, 'utf8');

    session.sftp.writeFile(remotePath, buffer, (err) => {
      if (err) {
        this.socket.emit('sftp.error', `Cannot upload: ${err.message}`);
        return;
      }

      this.socket.emit('sftp.success', `Uploaded: ${remotePath.split('/').pop()}`);
    });
  }

  /**
   * Register socket event handlers
   */
  register() {
    this.socket.on('sftp.list', (path) => this.list(path));
    this.socket.on('sftp.readFile', (path) => this.readFile(path));
    this.socket.on('sftp.writeFile', (params) => this.writeFile(params));
    this.socket.on('sftp.mkdir', (path) => this.mkdir(path));
    this.socket.on('sftp.rmdir', (path) => this.rmdir(path));
    this.socket.on('sftp.unlink', (path) => this.unlink(path));
    this.socket.on('sftp.rename', (params) => this.rename(params));
    this.socket.on('sftp.copy', (params) => this.copy(params));
    this.socket.on('sftp.download', (path) => this.download(path));
    this.socket.on('sftp.upload', (params) => this.upload(params));
  }

  cleanup() {
    // Nothing to clean up
  }
}

module.exports = SFTPHandler;

