"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp } from "lucide-react";
import Link from 'next/link';
import { ToolExecutor } from '../lib/tool-executor';
import { Tool } from '../lib/types';

const linpeas: Tool = {
  id: 'linpeas',
  name: 'LinPEAS',
  description: 'Linux Privilege Escalation Awesome Script',
  longDescription: 'LinPEAS is a script that searches for possible paths to escalate privileges on Linux/Unix hosts. It checks misconfigurations, vulnerable software versions, SUID binaries, capabilities, cron jobs, and much more.',
  installCmd: 'curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh -o /tmp/linpeas.sh && chmod +x /tmp/linpeas.sh',
  checkCmd: 'test -f /tmp/linpeas.sh && echo "exists"',
  documentation: 'https://github.com/peass-ng/PEASS-ng/tree/master/linPEAS',
  presets: [
    {
      id: 'full',
      name: 'Full Scan',
      level: 'basic',
      description: 'Run complete privilege escalation check',
      command: '/tmp/linpeas.sh',
      args: [],
      notes: ['Takes 2-5 minutes', 'Color coded output (RED/YELLOW = interesting)', 'Run as the user you want to escalate FROM'],
    },
    {
      id: 'quiet',
      name: 'Quiet Scan',
      level: 'basic',
      description: 'Faster scan with less output',
      command: '/tmp/linpeas.sh -q',
      args: [],
      notes: ['Faster but less comprehensive', 'Good for initial quick check'],
    },
    {
      id: 'network',
      name: 'Network Only',
      level: 'intermediate',
      description: 'Focus on network-related privesc vectors',
      command: '/tmp/linpeas.sh -o network',
      args: [],
    },
    {
      id: 'procs_crons',
      name: 'Processes & Crons',
      level: 'intermediate',
      description: 'Check running processes and cron jobs',
      command: '/tmp/linpeas.sh -o procs_crons_timers_srvcs_stic',
      args: [],
      notes: ['Looks for cron jobs running as root', 'Identifies writable scripts in crons'],
    },
    {
      id: 'interesting-files',
      name: 'Interesting Files',
      level: 'intermediate',
      description: 'Search for passwords, keys, configs',
      command: '/tmp/linpeas.sh -o interesting_files',
      args: [],
      notes: ['Finds passwords in configs', 'Locates SSH keys', 'Database credentials'],
    },
    {
      id: 'save-output',
      name: 'Save to File',
      level: 'advanced',
      description: 'Run full scan and save output',
      command: '/tmp/linpeas.sh -a 2>&1 | tee /tmp/linpeas_output.txt',
      args: [],
      notes: ['-a for extra thorough scan', 'Output saved for later analysis', 'Useful for reporting'],
    },
  ],
};

const winpeas: Tool = {
  id: 'winpeas',
  name: 'WinPEAS',
  description: 'Windows Privilege Escalation Awesome Script',
  longDescription: 'WinPEAS is a script that searches for possible paths to escalate privileges on Windows hosts. It checks for misconfigurations, vulnerable software, unquoted service paths, token privileges, and more.',
  installCmd: 'curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/winPEASx64.exe -o /tmp/winpeas.exe',
  checkCmd: 'test -f /tmp/winpeas.exe && echo "exists"',
  documentation: 'https://github.com/peass-ng/PEASS-ng/tree/master/winPEAS',
  presets: [
    {
      id: 'download',
      name: 'Download WinPEAS',
      level: 'basic',
      description: 'Download WinPEAS executables',
      command: 'curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/winPEASx64.exe -o /tmp/winpeas64.exe && curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/winPEASx86.exe -o /tmp/winpeas32.exe',
      args: [],
      notes: ['Downloads both 32 and 64 bit versions', 'Transfer to Windows target via upload/SMB'],
    },
    {
      id: 'run-info',
      name: 'Windows Command',
      level: 'basic',
      description: 'Command to run on Windows target',
      command: 'echo "Transfer winpeas.exe to target, then run: .\\winpeas.exe"',
      args: [],
      notes: ['Run from Windows CMD or PowerShell', 'winpeas.exe for full scan', 'winpeas.exe quiet for quick scan'],
    },
  ],
};

const pspy: Tool = {
  id: 'pspy',
  name: 'pspy',
  description: 'Monitor processes without root',
  longDescription: 'pspy is a command line tool to snoop on processes without needing root permissions. It monitors processes, cron jobs, and file system events. Invaluable for detecting scheduled tasks that might be exploitable.',
  installCmd: 'curl -L https://github.com/DominicBreuker/pspy/releases/download/v1.2.1/pspy64 -o /tmp/pspy && chmod +x /tmp/pspy',
  checkCmd: 'test -f /tmp/pspy && echo "exists"',
  documentation: 'https://github.com/DominicBreuker/pspy',
  presets: [
    {
      id: 'basic',
      name: 'Monitor Processes',
      level: 'basic',
      description: 'Watch for new processes',
      command: '/tmp/pspy',
      args: [],
      notes: ['Shows processes as they start', 'Great for finding cron jobs', 'Run and wait 1-5 minutes'],
    },
    {
      id: 'filesystem',
      name: 'With File Events',
      level: 'intermediate',
      description: 'Monitor file system changes too',
      command: '/tmp/pspy -f',
      args: [],
      notes: ['-f enables file system events', 'Shows which files are accessed'],
    },
    {
      id: 'dirs',
      name: 'Watch Specific Dirs',
      level: 'advanced',
      description: 'Monitor specific directories',
      command: '/tmp/pspy -d {dirs}',
      args: [
        { name: 'dirs', placeholder: '/tmp,/opt,/var/www', description: 'Comma-separated directories', required: true, type: 'text', default: '/tmp,/opt,/home' },
      ],
    },
  ],
};

const gtfobins: Tool = {
  id: 'gtfobins',
  name: 'GTFOBins Finder',
  description: 'Find SUID/capability exploits',
  longDescription: 'GTFOBins is a curated list of Unix binaries that can be used to bypass local security restrictions. This tool helps identify SUID binaries and suggests exploitation methods.',
  installCmd: 'echo "Native commands - no installation needed"',
  checkCmd: 'which find',
  documentation: 'https://gtfobins.github.io/',
  presets: [
    {
      id: 'suid',
      name: 'Find SUID Binaries',
      level: 'basic',
      description: 'List all SUID binaries on system',
      command: 'find / -perm -4000 -type f 2>/dev/null',
      args: [],
      notes: ['SUID runs as owner (often root)', 'Check each against gtfobins.github.io', 'Common: pkexec, sudo, passwd'],
    },
    {
      id: 'sgid',
      name: 'Find SGID Binaries',
      level: 'basic',
      description: 'List all SGID binaries',
      command: 'find / -perm -2000 -type f 2>/dev/null',
      args: [],
      notes: ['SGID runs with group privileges', 'Less common but still useful'],
    },
    {
      id: 'capabilities',
      name: 'Find Capabilities',
      level: 'intermediate',
      description: 'List binaries with capabilities',
      command: 'getcap -r / 2>/dev/null',
      args: [],
      notes: ['Capabilities can grant root-like powers', 'cap_setuid is instant root', 'Check gtfobins for exploitation'],
    },
    {
      id: 'writable',
      name: 'World-Writable Files',
      level: 'intermediate',
      description: 'Find world-writable files/directories',
      command: 'find / -writable -type f 2>/dev/null | grep -v proc',
      args: [],
      notes: ['Look for config files, scripts', 'Especially in /etc, /opt, /var'],
    },
    {
      id: 'sudo',
      name: 'Sudo Rights',
      level: 'basic',
      description: 'Check sudo permissions',
      command: 'sudo -l',
      args: [],
      notes: ['Shows what you can run as root', 'NOPASSWD entries are gold', 'Check each binary on GTFOBins'],
    },
    {
      id: 'cron',
      name: 'Cron Jobs',
      level: 'intermediate',
      description: 'List scheduled tasks',
      command: 'cat /etc/crontab; ls -la /etc/cron.*; crontab -l 2>/dev/null',
      args: [],
      notes: ['Look for writable scripts', 'Scripts running as root', 'Wildcard injection possibilities'],
    },
    {
      id: 'path-hijack',
      name: 'PATH Hijack Check',
      level: 'advanced',
      description: 'Find PATH injection opportunities',
      command: 'echo $PATH | tr ":" "\\n" | xargs -I {} sh -c \'test -w {} && echo "Writable: {}"\'',
      args: [],
      notes: ['If PATH has writable dir before /usr/bin', 'Can place malicious binary to be executed'],
    },
  ],
};

const suggester: Tool = {
  id: 'suggester',
  name: 'Exploit Suggester',
  description: 'Kernel exploit suggestion tools',
  longDescription: 'Exploit suggesters analyze system information to recommend potential kernel exploits. Linux Exploit Suggester and Windows Exploit Suggester help identify vulnerable kernel versions.',
  installCmd: 'curl -L https://raw.githubusercontent.com/mzet-/linux-exploit-suggester/master/linux-exploit-suggester.sh -o /tmp/les.sh && chmod +x /tmp/les.sh',
  checkCmd: 'test -f /tmp/les.sh && echo "exists"',
  documentation: 'https://github.com/mzet-/linux-exploit-suggester',
  presets: [
    {
      id: 'linux',
      name: 'Linux Exploit Suggester',
      level: 'intermediate',
      description: 'Find kernel exploits for Linux',
      command: '/tmp/les.sh',
      args: [],
      notes: ['Checks kernel version for known exploits', 'Requires kernel version info', 'May need to compile suggested exploits'],
    },
    {
      id: 'kernel-info',
      name: 'Get Kernel Info',
      level: 'basic',
      description: 'Gather system info for analysis',
      command: 'uname -a; cat /etc/*release; cat /proc/version',
      args: [],
      notes: ['Kernel version is key for exploit matching', 'Distribution info helps narrow exploits'],
    },
    {
      id: 'dirty-checks',
      name: 'Check Famous Exploits',
      level: 'advanced',
      description: 'Quick check for famous Linux privesc',
      command: 'uname -r | grep -E "^(2\\.|3\\.[0-9]\\.|4\\.[0-4]\\.)" && echo "Potentially vulnerable to DirtyCow/DirtyPipe variants"',
      args: [],
      notes: ['DirtyCow: CVE-2016-5195 (kernel < 4.8.3)', 'DirtyPipe: CVE-2022-0847 (5.8 - 5.16.11)', 'PwnKit: CVE-2021-4034 (polkit)'],
    },
    {
      id: 'pwnkit',
      name: 'PwnKit Check',
      level: 'advanced',
      description: 'Check for PwnKit vulnerability',
      command: 'pkexec --version 2>/dev/null && ls -la /usr/bin/pkexec',
      args: [],
      notes: ['CVE-2021-4034 affects polkit < 0.120', 'Instant root on vulnerable systems', 'Very common on older systems'],
    },
  ],
};

export default function PrivescToolsPage() {
  const [selectedTool, setSelectedTool] = useState<string>('linpeas');

  const tools: Record<string, Tool> = { linpeas, winpeas, pspy, gtfobins, suggester };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/ctf/tools">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <TrendingUp className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Privilege Escalation</h2>
            <p className="text-xs text-muted-foreground">Linux & Windows privesc enumeration</p>
          </div>
        </div>
      </div>

      <Tabs value={selectedTool} onValueChange={setSelectedTool} className="flex-1">
        <TabsList>
          <TabsTrigger value="linpeas">LinPEAS</TabsTrigger>
          <TabsTrigger value="winpeas">WinPEAS</TabsTrigger>
          <TabsTrigger value="pspy">pspy</TabsTrigger>
          <TabsTrigger value="gtfobins">GTFOBins</TabsTrigger>
          <TabsTrigger value="suggester">Exploit Suggester</TabsTrigger>
        </TabsList>
        
        {Object.entries(tools).map(([id, tool]) => (
          <TabsContent key={id} value={id} className="mt-4">
            <ToolExecutor tool={tool} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

