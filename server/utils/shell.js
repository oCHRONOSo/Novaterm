/**
 * Shell command utilities
 */
const os = require('os');

/**
 * Escape a string for safe shell usage
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeArg(str) {
  return `'${String(str).replace(/'/g, "'\\''")}'`;
}

/**
 * Build sudo command with password
 * @param {string} cmd - Command to run
 * @param {string} password - Sudo password
 * @returns {string} Command with sudo
 */
function withSudo(cmd, password) {
  if (password) {
    return `printf '%s\\n' ${escapeArg(password)} | sudo -S ${cmd}`;
  }
  return `sudo ${cmd}`;
}

/**
 * Write command to shell stream with newline
 * @param {object} shellStream - SSH shell stream
 * @param {string} cmd - Command to execute
 */
function exec(shellStream, cmd) {
  if (shellStream) {
    shellStream.write(cmd + os.EOL);
  }
}

/**
 * Build arguments list for shell command
 * @param {string[]} args - Arguments array
 * @returns {string} Escaped arguments string
 */
function buildArgs(args = []) {
  return args.map(a => escapeArg(a)).join(' ');
}

module.exports = {
  escapeArg,
  withSudo,
  exec,
  buildArgs,
};

