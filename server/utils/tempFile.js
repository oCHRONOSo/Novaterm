/**
 * Temporary file management utilities
 */

/**
 * Generate a unique temp file path
 * @param {string} prefix - File name prefix
 * @param {string} extension - File extension (default: txt)
 * @returns {string} Temp file path
 */
function generate(prefix = 'tmp', extension = 'txt') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 9);
  return `/tmp/${prefix}_${timestamp}_${random}.${extension}`;
}

/**
 * Clean up a temp file via shell stream
 * @param {object} shellStream - SSH shell stream
 * @param {string} filePath - Path to clean up
 */
function cleanup(shellStream, filePath) {
  if (shellStream && filePath) {
    shellStream.write(`rm -f ${filePath} 2>/dev/null\n`);
  }
}

/**
 * Clean up multiple temp files
 * @param {object} shellStream - SSH shell stream
 * @param {string[]} filePaths - Paths to clean up
 */
function cleanupMany(shellStream, filePaths) {
  if (shellStream && filePaths?.length) {
    shellStream.write(`rm -f ${filePaths.join(' ')} 2>/dev/null\n`);
  }
}

module.exports = {
  generate,
  cleanup,
  cleanupMany,
};

