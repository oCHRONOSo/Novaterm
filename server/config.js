/**
 * Server configuration constants
 */
module.exports = {
  // Session management
  SESSION_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  MAX_OUTPUT_BUFFER: 50 * 1024,   // 50KB

  // Monitoring
  MONITORING_MIN_INTERVAL: 5000,  // 5 seconds minimum
  MONITORING_DEFAULT_INTERVAL: 5000,
  
  // Log streaming
  LOG_POLL_INTERVAL: 3000,        // 3 seconds
  LOG_INITIAL_LINES: 100,
  LOG_STREAM_LINES: 50,
  LOG_CACHE_SIZE: 100,
  
  // Network scanning
  PORT_SCAN_BATCH_SIZE: 10,
  PORT_SCAN_TIMEOUT: 1500,        // 1.5 seconds per port
  PORT_SCAN_BATCH_DELAY: 2000,    // 2 seconds between batches
  
  // SFTP operations
  SFTP_READ_TIMEOUT: 2000,        // 2 seconds
  SFTP_COMMAND_TIMEOUT: 1000,     // 1 second
  
  // Package management
  PACKAGE_SEARCH_TIMEOUTS: [2000, 3000, 5000],
  
  // CTF tools
  CTF_INSTALL_TIMEOUT: 300000,    // 5 minutes for large downloads
  CTF_COMMAND_TIMEOUT: 300000,    // 5 minutes
  CTF_OUTPUT_POLL_INTERVAL: 500,  // 500ms
  
  // SSH
  SSH_READY_TIMEOUT: 20000,       // 20 seconds
};

