"use client";

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Globe,
  Key,
  Eye,
  Terminal,
  Shield,
  ArrowRight,
  Crosshair,
  AlertTriangle,
  TrendingUp,
  Users,
  Download,
  Loader2,
  CheckCircle,
  Package,
} from "lucide-react";
import Link from 'next/link';
import { useSocket } from '@/contexts/socket-context';
import { useToast } from '@/components/ui/use-toast';

const categories = [
  {
    id: 'recon',
    name: 'Reconnaissance',
    description: 'Network discovery, port scanning, and service enumeration',
    icon: Crosshair,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    href: '/app/ctf/tools/recon',
    tools: ['Nmap'],
    highlights: [
      'Advanced port scanning techniques',
      'Service & version detection',
      'NSE script automation',
      'OS fingerprinting',
    ],
  },
  {
    id: 'web',
    name: 'Web Application',
    description: 'Web vulnerability scanning, fuzzing, and exploitation',
    icon: Globe,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    href: '/app/ctf/tools/web',
    tools: ['ffuf', 'SQLMap', 'Nikto'],
    highlights: [
      'Directory & parameter fuzzing',
      'SQL injection automation',
      'Web server vulnerability scanning',
      'Custom wordlist support',
    ],
  },
  {
    id: 'crypto',
    name: 'Password & Crypto',
    description: 'Password cracking, hash analysis, and brute-force attacks',
    icon: Key,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    href: '/app/ctf/tools/crypto',
    tools: ['John the Ripper', 'Hashcat', 'Hydra'],
    highlights: [
      'Multi-format hash cracking',
      'Rule-based attacks',
      'Protocol brute-forcing',
      'Custom mask generation',
    ],
  },
  {
    id: 'privesc',
    name: 'Privilege Escalation',
    description: 'Linux & Windows privilege escalation enumeration',
    icon: TrendingUp,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    href: '/app/ctf/tools/privesc',
    tools: ['LinPEAS', 'WinPEAS', 'pspy', 'GTFOBins'],
    highlights: [
      'SUID/capability detection',
      'Cron job analysis',
      'Kernel exploit suggestions',
      'Process monitoring',
    ],
  },
  {
    id: 'activedir',
    name: 'Active Directory',
    description: 'Domain enumeration and exploitation tools',
    icon: Users,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    href: '/app/ctf/tools/activedir',
    tools: ['Impacket', 'CrackMapExec', 'Evil-WinRM', 'BloodHound'],
    highlights: [
      'Kerberoasting & AS-REP roasting',
      'Pass-the-Hash attacks',
      'SMB enumeration',
      'Attack path visualization',
    ],
  },
  {
    id: 'forensics',
    name: 'Forensics & Stego',
    description: 'Digital forensics, steganography, and file analysis',
    icon: Eye,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    href: '/app/ctf/tools/forensics',
    tools: ['Binwalk', 'Steghide', 'ExifTool', 'Volatility'],
    highlights: [
      'Firmware extraction',
      'Hidden data detection',
      'Metadata analysis',
      'Memory forensics',
    ],
  },
  {
    id: 'exploit',
    name: 'Exploitation',
    description: 'Network utilities, shells, and exploitation frameworks',
    icon: Shield,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    href: '/app/ctf/tools/exploit',
    tools: ['Netcat', 'Metasploit', 'Searchsploit'],
    highlights: [
      'Reverse shell handling',
      'Exploit database search',
      'Payload generation',
      'Post-exploitation',
    ],
  },
];

type InstallItem = {
  id: string;
  name: string;
  description: string;
  command: string;
  checkCommand: string;
  category: 'wordlist' | 'tool';
  needsSudo: boolean;
};

const installItems: InstallItem[] = [
  {
    id: 'seclists',
    name: 'SecLists',
    description: 'Comprehensive collection of security testing wordlists',
    command: 'bash -c "if apt-get install -y seclists 2>/dev/null; then echo OK; elif command -v git >/dev/null; then git clone --depth 1 https://github.com/danielmiessler/SecLists.git /usr/share/seclists; else apt-get install -y wget unzip && cd /tmp && wget -q https://github.com/danielmiessler/SecLists/archive/refs/heads/master.zip && unzip -q master.zip && mv SecLists-master /usr/share/seclists && rm master.zip; fi"',
    checkCommand: '[ -d /usr/share/seclists ] && echo INSTALLED || echo MISSING',
    category: 'wordlist',
    needsSudo: true,
  },
  {
    id: 'rockyou',
    name: 'RockYou Wordlist',
    description: '14 million password wordlist',
    command: 'bash -c "mkdir -p /usr/share/wordlists && cd /usr/share/wordlists && ([ -f rockyou.txt ] || ([ -f rockyou.txt.gz ] && gunzip -k rockyou.txt.gz) || curl -sL https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt -o rockyou.txt)"',
    checkCommand: '[ -f /usr/share/wordlists/rockyou.txt ] && echo INSTALLED || echo MISSING',
    category: 'wordlist',
    needsSudo: true,
  },
  {
    id: 'dirb',
    name: 'Dirb Wordlists',
    description: 'Directory brute-forcing wordlists',
    command: 'bash -c "apt-get update && apt-get install -y dirb"',
    checkCommand: '[ -d /usr/share/dirb ] && echo INSTALLED || echo MISSING',
    category: 'wordlist',
    needsSudo: true,
  },
  {
    id: 'wordlists-dir',
    name: 'Wordlists Directory',
    description: 'Ensure /usr/share/wordlists exists',
    command: 'bash -c "mkdir -p /usr/share/wordlists && chmod 755 /usr/share/wordlists"',
    checkCommand: '[ -d /usr/share/wordlists ] && echo INSTALLED || echo MISSING',
    category: 'wordlist',
    needsSudo: true,
  },
  {
    id: 'gobuster',
    name: 'Gobuster',
    description: 'Fast directory/file brute-forcer',
    command: 'bash -c "apt-get install -y gobuster 2>/dev/null || (apt-get install -y golang-go && go install github.com/OJ/gobuster/v3@latest && cp ~/go/bin/gobuster /usr/local/bin/)"',
    checkCommand: 'command -v gobuster >/dev/null 2>&1 && echo INSTALLED || echo MISSING',
    category: 'tool',
    needsSudo: true,
  },
  {
    id: 'enum4linux',
    name: 'Enum4linux',
    description: 'SMB enumeration tool',
    command: 'bash -c "apt-get install -y enum4linux 2>/dev/null || (apt-get install -y smbclient python3 && curl -sL https://raw.githubusercontent.com/CiscoCXSecurity/enum4linux/master/enum4linux.pl -o /usr/local/bin/enum4linux && chmod +x /usr/local/bin/enum4linux)"',
    checkCommand: '(command -v enum4linux >/dev/null 2>&1 || [ -f /usr/local/bin/enum4linux ]) && echo INSTALLED || echo MISSING',
    category: 'tool',
    needsSudo: true,
  },
  {
    id: 'smbclient',
    name: 'SMB Client',
    description: 'SMB/CIFS client utilities',
    command: 'bash -c "apt-get install -y smbclient"',
    checkCommand: 'command -v smbclient >/dev/null 2>&1 && echo INSTALLED || echo MISSING',
    category: 'tool',
    needsSudo: true,
  },
  {
    id: 'stegseek',
    name: 'Stegseek',
    description: 'Fast steghide cracker',
    command: 'bash -c "apt-get install -y stegseek 2>/dev/null || (cd /tmp && curl -sLO https://github.com/RickdeJager/stegseek/releases/latest/download/stegseek_0.6-1.deb && dpkg -i stegseek_0.6-1.deb; apt-get install -f -y; rm -f stegseek_0.6-1.deb)"',
    checkCommand: 'command -v stegseek >/dev/null 2>&1 && echo INSTALLED || echo MISSING',
    category: 'tool',
    needsSudo: true,
  },
  {
    id: 'zsteg',
    name: 'Zsteg',
    description: 'PNG/BMP steganography detection',
    command: 'bash -c "apt-get install -y ruby ruby-dev && gem install zsteg"',
    checkCommand: 'command -v zsteg >/dev/null 2>&1 && echo INSTALLED || echo MISSING',
    category: 'tool',
    needsSudo: true,
  },
  {
    id: 'stegcracker',
    name: 'Stegcracker',
    description: 'Steghide brute-force tool',
    command: 'bash -c "apt-get install -y steghide python3-pip && pip3 install stegcracker --break-system-packages"',
    checkCommand: 'command -v stegcracker >/dev/null 2>&1 && echo INSTALLED || echo MISSING',
    category: 'tool',
    needsSudo: true,
  },
];

function InstallUtilities() {
  const { socket, status } = useSocket();
  const { push } = useToast();
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);

  // Check all items using a unified bash script via SFTP
  const checkStatus = useCallback(() => {
    if (!socket || status !== 'connected') {
      push({ title: 'Not connected', description: 'Connect via SSH first', variant: 'destructive' });
      return;
    }
    
    setChecking(true);
    
    // Build a bash script that checks all items and outputs JSON
    const checks = installItems.map(item => {
      // Extract the actual check (remove the echo parts, just keep the condition)
      const checkPart = item.checkCommand.replace(/&& echo INSTALLED \|\| echo MISSING/g, '').trim();
      return `if ${checkPart}; then echo "${item.id}:1"; else echo "${item.id}:0"; fi`;
    }).join('\n');
    
    const script = `#!/bin/bash
${checks}
`;
    
    // Emit to server to run the check script
    socket.emit('ctf.checkAllTools', { script });
    
  }, [socket, status, push]);
  
  // Listen for check results
  useEffect(() => {
    if (!socket) return;
    
    const handleCheckResults = (results: Record<string, boolean>) => {
      const newInstalled = new Set<string>();
      for (const [id, isInstalled] of Object.entries(results)) {
        if (isInstalled) {
          newInstalled.add(id);
        }
      }
      setInstalled(newInstalled);
      setChecking(false);
      push({ title: 'Check complete', description: `${newInstalled.size}/${installItems.length} items installed` });
    };
    
    socket.on('ctf.checkAllToolsResult', handleCheckResults);
    return () => {
      socket.off('ctf.checkAllToolsResult', handleCheckResults);
    };
  }, [socket, push]);

  const installItem = (item: InstallItem) => {
    if (!socket || status !== 'connected') {
      push({ title: 'Not connected', description: 'Connect via SSH first', variant: 'destructive' });
      return;
    }

    setInstalling(prev => new Set(prev).add(item.id));
    push({ 
      title: 'Installing', 
      description: `Installing ${item.name}... Check terminal for progress.` 
    });
    
    // Use server's ctf.installTool which handles sudo password automatically
    const handleComplete = ({ toolId }: { toolId: string }) => {
      if (toolId !== item.id) return;
      
      socket.off('ctf.installComplete', handleComplete);
      
      setInstalling(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      
      // Always re-check status after install
      push({ title: 'Install complete', description: `Verifying ${item.name}...` });
      setTimeout(() => checkStatus(), 1000);
    };
    
    socket.on('ctf.installComplete', handleComplete);
    
    // Use server's ctf.installTool event - server adds sudo with stored password
    socket.emit('ctf.installTool', { 
      toolId: item.id, 
      installCmd: item.command 
    });
    
    // Timeout fallback
    setTimeout(() => {
      socket.off('ctf.installComplete', handleComplete);
      if (installing.has(item.id)) {
        setInstalling(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        push({ title: 'Timeout', description: `${item.name} may still be installing. Click Check Status.`, variant: 'destructive' });
      }
    }, 120000); // 2 minute timeout
  };

  const wordlists = installItems.filter(item => item.category === 'wordlist');
  const tools = installItems.filter(item => item.category === 'tool');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-muted-foreground">
          {installed.size > 0 ? (
            <span className="text-green-500 font-medium">{installed.size}/{installItems.length} installed</span>
          ) : (
            'Click install to set up wordlists and tools on your remote server'
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={checkStatus} 
          disabled={status !== 'connected' || checking}
        >
          {checking ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Checking...
            </>
          ) : (
            <>
              <Download className="h-3 w-3 mr-1" /> Check Status
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Wordlists */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Key className="h-4 w-4" /> Wordlists
          </h4>
          <div className="space-y-2">
            {wordlists.map((item) => {
              const isInstalling = installing.has(item.id);
              const isInstalled = installed.has(item.id);
              return (
                <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg border bg-background ${checking ? 'opacity-70' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {checking && (
                      <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                    )}
                    {!checking && isInstalled && (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                    <Button
                      size="sm"
                      variant={isInstalled ? "outline" : "default"}
                      onClick={() => installItem(item)}
                      disabled={status !== 'connected' || isInstalling || checking}
                      className="flex-shrink-0"
                    >
                      {isInstalling ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isInstalled ? (
                        'Reinstall'
                      ) : (
                        'Install'
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tools */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Terminal className="h-4 w-4" /> Additional Tools
          </h4>
          <div className="space-y-2">
            {tools.map((item) => {
              const isInstalling = installing.has(item.id);
              const isInstalled = installed.has(item.id);
              return (
                <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg border bg-background ${checking ? 'opacity-70' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {checking && (
                      <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                    )}
                    {!checking && isInstalled && (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                    <Button
                      size="sm"
                      variant={isInstalled ? "outline" : "default"}
                      onClick={() => installItem(item)}
                      disabled={status !== 'connected' || isInstalling || checking}
                      className="flex-shrink-0"
                    >
                      {isInstalling ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isInstalled ? (
                        'Reinstall'
                      ) : (
                        'Install'
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CTFToolsHub() {
  const { status } = useSocket();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">CTF Tools</h2>
          <p className="text-sm text-muted-foreground">Professional penetration testing toolkit with advanced command options</p>
        </div>
        {status !== 'connected' && (
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Connect via SSH first
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Card key={category.id} className="group hover:border-primary/50 transition-colors flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${category.bgColor} ${category.borderColor} border`}>
                    <Icon className={`h-5 w-5 ${category.color}`} />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {category.tools.length} tool{category.tools.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{category.name}</CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col space-y-4 flex-1">
                <div className="flex flex-wrap gap-1">
                  {category.tools.map((tool) => (
                    <Badge key={tool} variant="secondary" className="text-xs font-mono">
                      {tool}
                    </Badge>
                  ))}
                </div>
                
                <ul className="space-y-1">
                  {category.highlights.map((highlight, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className={`h-1 w-1 rounded-full ${category.bgColor.replace('/10', '')}`} />
                      {highlight}
                    </li>
                  ))}
                </ul>

                <Button asChild variant="outline" className="w-full mt-auto group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Link href={category.href}>
                    <Terminal className="h-4 w-4 mr-2" />
                    Open Tools
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Installation Utilities */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" /> Installation Utilities
          </CardTitle>
          <CardDescription>Install essential wordlists and CTF tools</CardDescription>
        </CardHeader>
        <CardContent>
          <InstallUtilities />
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Quick Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
            <div className="space-y-1">
              <div className="font-medium text-foreground">Skill Levels</div>
              <div><Badge variant="outline" className="bg-green-500/10 text-green-500 text-xs mr-1">Basic</Badge> Simple, safe commands</div>
              <div><Badge variant="outline" className="bg-blue-500/10 text-blue-500 text-xs mr-1">Intermediate</Badge> More options, deeper scans</div>
              <div><Badge variant="outline" className="bg-orange-500/10 text-orange-500 text-xs mr-1">Advanced</Badge> Complex operations</div>
              <div><Badge variant="outline" className="bg-red-500/10 text-red-500 text-xs mr-1">Expert</Badge> Full control, use carefully</div>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Best Practices</p>
              <p>• Always have permission before testing</p>
              <p>• Start with basic scans, then escalate</p>
              <p>• Save output for documentation</p>
              <p>• Use responsible disclosure</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Wordlists Location</p>
              <p className="font-mono">/usr/share/wordlists/</p>
              <p>• rockyou.txt - Common passwords</p>
              <p>• dirb/common.txt - Web directories</p>
              <p>• seclists/* - Comprehensive lists</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
