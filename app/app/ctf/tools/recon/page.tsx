"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Crosshair } from "lucide-react";
import Link from 'next/link';
import { ToolExecutor } from '../lib/tool-executor';
import { Tool } from '../lib/types';

const nmap: Tool = {
  id: 'nmap',
  name: 'Nmap',
  description: 'Network Mapper - The industry standard for network discovery',
  longDescription: 'Nmap is a free and open-source network scanner used for network discovery and security auditing. It uses raw IP packets to determine available hosts, services, operating systems, packet filters/firewalls, and dozens of other characteristics.',
  installCmd: 'apt-get install -y nmap',
  checkCmd: 'which nmap',
  documentation: 'https://nmap.org/book/man.html',
  tips: [
    'Always start with a quick scan (-F), then run full scan (-p-) in background',
    'Use -oA to save all output formats at once (.nmap, .xml, .gnmap)',
    'If host seems down, try -Pn to skip ping and scan anyway',
    'Source port 53 (-g 53) can bypass firewalls that allow DNS traffic',
    'Chain with grep: nmap ... -oG - | grep open',
    'For HTB: Always check UDP ports too - SNMP (161) is often misconfigured',
  ],
  presets: [
    // Basic
    {
      id: 'quick-scan',
      name: 'Quick Scan',
      level: 'basic',
      description: 'Fast scan of the top 100 most common ports',
      command: 'nmap -F {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.1 or domain.com', description: 'Target IP address, hostname, or CIDR range', required: true, type: 'text' },
      ],
      notes: ['Scans top 100 ports', 'Fast but limited coverage'],
      tips: ['Add -v for verbose output to see progress', 'Combine with -oN output.txt to save results'],
    },
    {
      id: 'ping-sweep',
      name: 'Ping Sweep',
      level: 'basic',
      description: 'Discover live hosts in a network range',
      command: 'nmap -sn {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.0/24', description: 'Network range in CIDR notation', required: true, type: 'text' },
      ],
      notes: ['No port scan, just host discovery', 'Uses ICMP echo, TCP SYN to 443, TCP ACK to 80, and ICMP timestamp'],
      tips: ['If hosts don\'t respond, try -Pn to skip ping', 'Use --reason to see why hosts are marked up/down'],
    },
    // Intermediate
    {
      id: 'service-version',
      name: 'Service & Version Detection',
      level: 'intermediate',
      description: 'Detect services and their versions on open ports',
      command: 'nmap -sV -sC {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target IP or hostname', required: true, type: 'text' },
      ],
      notes: ['-sV probes open ports for service/version info', '-sC runs default NSE scripts', 'Good for initial enumeration'],
      tips: ['Use --version-intensity 5 for thorough version detection', 'Check for hidden services with -sV --version-all'],
    },
    {
      id: 'top-ports',
      name: 'Top Ports Scan',
      level: 'intermediate',
      description: 'Scan the most common N ports with service detection',
      command: 'nmap --top-ports {count} -sV {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target IP or hostname', required: true, type: 'text' },
        { name: 'count', placeholder: '1000', description: 'Number of top ports to scan', required: true, type: 'select', options: [
          { value: '100', label: 'Top 100' },
          { value: '500', label: 'Top 500' },
          { value: '1000', label: 'Top 1000' },
          { value: '2000', label: 'Top 2000' },
        ], default: '1000' },
      ],
      tips: ['Top 1000 covers ~93% of open ports in the wild', 'Use -p- for complete coverage if you have time'],
    },
    {
      id: 'os-detection',
      name: 'OS Detection',
      level: 'intermediate',
      description: 'Attempt to identify the operating system',
      command: 'nmap -O --osscan-guess {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target IP or hostname', required: true, type: 'text' },
      ],
      notes: ['Requires root/sudo privileges', 'Uses TCP/IP stack fingerprinting', '--osscan-guess provides aggressive guessing'],
      tips: ['Need at least one open and one closed port for OS detection', 'Combine with -sV for better accuracy'],
    },
    // Advanced
    {
      id: 'full-tcp',
      name: 'Full TCP Scan',
      level: 'advanced',
      description: 'Scan all 65535 TCP ports with version detection',
      command: 'nmap -p- -sV -sC -T{speed} -oN {output} {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target IP or hostname', required: true, type: 'text' },
        { name: 'speed', placeholder: '4', description: 'Timing template (0=paranoid, 5=insane)', required: true, type: 'select', options: [
          { value: '2', label: 'T2 - Polite (slow, less detection)' },
          { value: '3', label: 'T3 - Normal (default)' },
          { value: '4', label: 'T4 - Aggressive (faster)' },
          { value: '5', label: 'T5 - Insane (fastest, may miss)' },
        ], default: '4' },
        { name: 'output', placeholder: '/tmp/nmap_full.txt', description: 'Output file path', required: true, type: 'text', default: '/tmp/nmap_full.txt' },
      ],
      notes: ['Takes significant time', 'Save output for later analysis', 'T4 is a good balance of speed and accuracy'],
      tips: ['Run quick scan first, then full scan in background', 'Use --min-rate 1000 to speed up (may miss ports)'],
    },
    {
      id: 'udp-scan',
      name: 'UDP Port Scan',
      level: 'advanced',
      description: 'Scan common UDP ports (slower than TCP)',
      command: 'nmap -sU --top-ports {count} -sV {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target IP or hostname', required: true, type: 'text' },
        { name: 'count', placeholder: '100', description: 'Number of top UDP ports', required: true, type: 'select', options: [
          { value: '20', label: 'Top 20 UDP' },
          { value: '50', label: 'Top 50 UDP' },
          { value: '100', label: 'Top 100 UDP' },
          { value: '200', label: 'Top 200 UDP' },
        ], default: '100' },
      ],
      notes: ['Requires root/sudo', 'UDP scans are inherently slower', 'Common UDP services: DNS(53), SNMP(161), NTP(123)'],
      tips: ['Don\'t skip UDP! SNMP and TFTP often have misconfigs', 'Use --version-intensity 0 to speed up UDP scans'],
    },
    {
      id: 'vuln-scan',
      name: 'Vulnerability Scan',
      level: 'advanced',
      description: 'Run NSE vulnerability detection scripts',
      command: 'nmap --script vuln {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target IP or hostname', required: true, type: 'text' },
      ],
      notes: ['Runs all scripts in the "vuln" category', 'May trigger IDS/IPS alerts', 'Can take significant time'],
      tips: ['Run specific scripts like --script=smb-vuln* for targeted vuln checks', 'Check searchsploit after finding service versions'],
      dangerous: true,
    },
    // Expert
    {
      id: 'stealth-syn',
      name: 'Stealth SYN Scan',
      level: 'expert',
      description: 'Half-open scan that is harder to detect',
      command: 'nmap -sS -Pn -f --data-length {padding} -T{speed} {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target IP or hostname', required: true, type: 'text' },
        { name: 'speed', placeholder: '2', description: 'Timing (slower = stealthier)', required: true, type: 'select', options: [
          { value: '1', label: 'T1 - Sneaky' },
          { value: '2', label: 'T2 - Polite' },
          { value: '3', label: 'T3 - Normal' },
        ], default: '2' },
        { name: 'padding', placeholder: '24', description: 'Random data padding for evasion', required: true, type: 'number', default: '24' },
      ],
      notes: ['-sS: Half-open SYN scan', '-Pn: Skip host discovery', '-f: Fragment packets', '--data-length: Add random padding', 'Requires root/sudo'],
      tips: [
        'To bypass firewall: use -g 53 (source port 53) to make requests look like DNS',
        'Use --mtu 24 to fragment packets into smaller chunks',
        'Add -D RND:10 to generate decoy scans from random IPs',
        'Combine with --spoof-mac 0 to randomize your MAC address',
      ],
    },
    {
      id: 'aggressive-full',
      name: 'Aggressive Full Scan',
      level: 'expert',
      description: 'Comprehensive scan with all enumeration options',
      command: 'nmap -A -p- -T4 --script "default,vuln,discovery" -oA {output} {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target IP or hostname', required: true, type: 'text' },
        { name: 'output', placeholder: '/tmp/nmap_aggressive', description: 'Output file prefix (creates .nmap, .xml, .gnmap)', required: true, type: 'text', default: '/tmp/nmap_aggressive' },
      ],
      notes: ['-A enables OS detection, version detection, script scanning, and traceroute', 'Creates three output formats', 'Very thorough but noisy and time-consuming'],
      tips: ['Parse XML output with tools like nmaptocsv or nmap-parse-output', 'Import .xml to Metasploit with db_import'],
      dangerous: true,
    },
    {
      id: 'specific-scripts',
      name: 'Specific Script Scan',
      level: 'expert',
      description: 'Run specific NSE scripts for targeted enumeration',
      command: 'nmap -p {ports} --script {scripts} {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target IP or hostname', required: true, type: 'text' },
        { name: 'ports', placeholder: '21,22,80,443', description: 'Comma-separated ports or ranges', required: true, type: 'text' },
        { name: 'scripts', placeholder: 'http-enum,ssh-auth-methods', description: 'Script names or categories', required: true, type: 'select', options: [
          { value: 'http-enum,http-headers,http-methods', label: 'HTTP Enumeration' },
          { value: 'ssh-auth-methods,ssh-hostkey', label: 'SSH Analysis' },
          { value: 'smb-enum-shares,smb-enum-users,smb-os-discovery', label: 'SMB Enumeration' },
          { value: 'ftp-anon,ftp-bounce,ftp-syst', label: 'FTP Analysis' },
          { value: 'dns-zone-transfer,dns-srv-enum', label: 'DNS Enumeration' },
          { value: 'mysql-info,mysql-enum,mysql-empty-password', label: 'MySQL Analysis' },
          { value: 'ssl-cert,ssl-enum-ciphers,ssl-heartbleed', label: 'SSL/TLS Analysis' },
        ] },
      ],
      notes: ['Use appropriate scripts for the services found', 'Scripts can be combined with commas', 'Check /usr/share/nmap/scripts/ for all available scripts'],
      tips: ['Use --script-args to pass arguments to scripts', 'Run "locate *.nse | xargs grep categories" to find scripts by category'],
    },
    {
      id: 'firewall-evasion',
      name: 'Firewall Evasion Scan',
      level: 'expert',
      description: 'Bypass firewalls using various evasion techniques',
      command: 'nmap -sS -Pn -g 53 --mtu {mtu} -f --data-length {padding} -D RND:{decoys} -T{speed} {target}',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target IP or hostname', required: true, type: 'text' },
        { name: 'mtu', placeholder: '24', description: 'MTU size for fragmentation', required: true, type: 'select', options: [
          { value: '16', label: '16 bytes (max fragmentation)' },
          { value: '24', label: '24 bytes (recommended)' },
          { value: '32', label: '32 bytes' },
        ], default: '24' },
        { name: 'padding', placeholder: '32', description: 'Random data padding', required: true, type: 'number', default: '32' },
        { name: 'decoys', placeholder: '5', description: 'Number of decoy IPs', required: true, type: 'select', options: [
          { value: '3', label: '3 decoys' },
          { value: '5', label: '5 decoys' },
          { value: '10', label: '10 decoys' },
        ], default: '5' },
        { name: 'speed', placeholder: '2', description: 'Timing (slower = stealthier)', required: true, type: 'select', options: [
          { value: '1', label: 'T1 - Sneaky' },
          { value: '2', label: 'T2 - Polite' },
        ], default: '2' },
      ],
      notes: ['-g 53: Source port 53 (DNS) to bypass firewall rules', '--mtu: Fragment packets', '-D: Generate decoy traffic', '-f: Additional fragmentation'],
      tips: [
        'Source port 53 (DNS) or 80 (HTTP) often allowed through firewalls',
        'Decoys hide your real IP among fake scanning IPs',
        'Fragment packets to bypass simple packet inspection',
        'Add --badsum to detect stateless firewalls (drops packets silently)',
        'Try -sA (ACK scan) if SYN is blocked - maps firewall rules',
      ],
      dangerous: true,
    },
  ],
};

export default function ReconToolsPage() {
  const [selectedTool] = useState<Tool>(nmap);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/ctf/tools">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
            <Crosshair className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Reconnaissance Tools</h2>
            <p className="text-xs text-muted-foreground">Network discovery and enumeration</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="nmap" className="flex-1">
        <TabsList>
          <TabsTrigger value="nmap">Nmap</TabsTrigger>
        </TabsList>
        
        <TabsContent value="nmap" className="mt-4">
          <ToolExecutor tool={selectedTool} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

