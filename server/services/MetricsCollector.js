/**
 * System Metrics Collector
 * Collects CPU, memory, disk, and network metrics via SSH
 */
const tempFile = require('../utils/tempFile');
const config = require('../config');

class MetricsCollector {
  /**
   * Metrics collection script (bash)
   * Reads from /proc and /sys for reliable metrics
   */
  static METRICS_SCRIPT = `#!/bin/bash
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

  /**
   * Collect system metrics
   * @param {object} session - SSH session
   * @param {function} callback - Callback with metrics data
   */
  static collect(session, callback) {
    if (!session?.shellStream || !session?.sftp) return;

    const scriptFile = tempFile.generate('metrics_script', 'sh');
    const outputFile = tempFile.generate('metrics', 'json');

    // Write script to temp file
    session.sftp.writeFile(scriptFile, this.METRICS_SCRIPT, (err) => {
      if (err) {
        console.error('[MetricsCollector] Failed to write script:', err.message);
        return;
      }

      // Execute script
      session.shellStream.write(`bash ${scriptFile} > ${outputFile} 2>&1\n`);

      // Read output after delay
      setTimeout(() => {
        session.sftp.readFile(outputFile, (err, data) => {
          if (err) {
            console.error('[MetricsCollector] Failed to read output:', err.message);
          } else if (data) {
            try {
              const jsonStr = data.toString().trim();
              // Extract JSON from potential shell noise
              const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const metrics = JSON.parse(jsonMatch[0]);
                callback(metrics);
              } else {
                console.error('[MetricsCollector] No JSON found in output');
              }
            } catch (e) {
              console.error('[MetricsCollector] Parse error:', e.message);
            }
          }
          
          // Cleanup
          tempFile.cleanupMany(session.shellStream, [scriptFile, outputFile]);
        });
      }, config.SFTP_READ_TIMEOUT);
    });
  }

  /**
   * Collect process list
   * @param {object} session - SSH session
   * @param {function} callback - Callback with processes array
   */
  static collectProcesses(session, callback) {
    if (!session?.shellStream || !session?.sftp) return;

    const outputFile = tempFile.generate('procs', 'txt');
    const cmd = `ps aux --sort=-%cpu | head -51 > ${outputFile}\n`;

    session.shellStream.write(cmd);

    setTimeout(() => {
      session.sftp.readFile(outputFile, (err, data) => {
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
        
        tempFile.cleanup(session.shellStream, outputFile);
      });
    }, 500);
  }
}

module.exports = MetricsCollector;

