/**
 * Network Data Collector
 * Collects network interface and connection data
 */
const tempFile = require('../utils/tempFile');
const config = require('../config');

class NetworkCollector {
  /**
   * Network data collection script
   */
  static NETWORK_SCRIPT = `#!/bin/bash
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

  /**
   * Collect network data
   * @param {object} session - SSH session
   * @param {function} callback - Callback with network data
   */
  static collect(session, callback) {
    if (!session?.shellStream || !session?.sftp) return;

    const scriptFile = tempFile.generate('net_script', 'sh');
    const outputFile = tempFile.generate('netdata', 'json');

    // Write script to temp file
    session.sftp.writeFile(scriptFile, this.NETWORK_SCRIPT, (err) => {
      if (err) {
        console.error('[NetworkCollector] Failed to write script:', err.message);
        return;
      }

      // Execute script
      session.shellStream.write(`bash ${scriptFile} > ${outputFile} 2>&1\n`);

      // Read output after delay
      setTimeout(() => {
        session.sftp.readFile(outputFile, (err, data) => {
          if (err) {
            console.error('[NetworkCollector] Failed to read output:', err.message);
          } else if (data) {
            try {
              const jsonStr = data.toString().trim();
              // Extract JSON from potential shell noise
              const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const netData = JSON.parse(jsonMatch[0]);
                
                // Add unique IDs to connections
                netData.connections = (netData.connections || []).map((c, i) => ({
                  ...c,
                  id: `${c.protocol}-${c.localPort}-${c.remoteAddress}-${c.remotePort}-${i}`,
                }));
                
                callback(netData);
              } else {
                console.error('[NetworkCollector] No JSON found in output');
              }
            } catch (e) {
              console.error('[NetworkCollector] Parse error:', e.message);
            }
          }
          
          // Cleanup
          tempFile.cleanupMany(session.shellStream, [scriptFile, outputFile]);
        });
      }, config.SFTP_READ_TIMEOUT);
    });
  }

  /**
   * Discover network devices via ARP
   * @param {object} session - SSH session
   * @param {function} callback - Callback with discovered nodes
   */
  static discover(session, callback) {
    if (!session?.shellStream || !session?.sftp) return;

    const scriptFile = tempFile.generate('discovery_script', 'sh');
    const outputFile = tempFile.generate('discovery', 'json');
    const script = `#!/bin/bash
echo "["
arp -n 2>/dev/null | awk 'NR>1 && $1 !~ /incomplete/ {
  printf "{\\"ip\\":\\"%s\\",\\"mac\\":\\"%s\\",\\"type\\":\\"unknown\\",\\"status\\":\\"online\\"},", $1, $3
}' | sed 's/,$//'
echo "]"
`;

    // Write script to temp file
    session.sftp.writeFile(scriptFile, script, (err) => {
      if (err) {
        console.error('[NetworkCollector] Failed to write discovery script:', err.message);
        callback('Failed to write discovery script', null);
        return;
      }

      // Execute script
      session.shellStream.write(`bash ${scriptFile} > ${outputFile} 2>&1\n`);

      // Read output after delay
      setTimeout(() => {
        session.sftp.readFile(outputFile, (err, data) => {
          if (err) {
            console.error('[NetworkCollector] Failed to read discovery output:', err.message);
            callback('Failed to read discovery results', null);
          } else if (data) {
            try {
              const jsonStr = data.toString().trim();
              // Extract JSON from potential shell noise
              const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                let nodes = JSON.parse(jsonMatch[0]);
                nodes = nodes.map((n, i) => ({
                  ...n,
                  id: `node-${i}`,
                  hostname: null,
                }));
                callback(null, nodes);
              } else {
                callback('No JSON found in discovery output', null);
              }
            } catch (err) {
              console.error('[NetworkCollector] Discovery parse error:', err.message);
              callback('Failed to parse discovery results', null);
            }
          }
          
          // Cleanup
          tempFile.cleanupMany(session.shellStream, [scriptFile, outputFile]);
        });
      }, config.SFTP_READ_TIMEOUT);
    });
  }
}

module.exports = NetworkCollector;

