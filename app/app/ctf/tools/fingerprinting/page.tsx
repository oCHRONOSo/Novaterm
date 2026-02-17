"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Crosshair, Terminal } from "lucide-react";
import Link from 'next/link';
import { useSocket } from '@/contexts/socket-context';
import { useToast } from '@/components/ui/use-toast';

type FingerprintPresetType = 'enum' | 'bruteforce';

type FingerprintPreset = {
  id: string;
  name: string;
  description: string;
  command: string;
  type: FingerprintPresetType;
};

type FingerprintService = {
  id: string;
  label: string;
  description: string;
  presets: FingerprintPreset[];
};

const fingerprintServices: FingerprintService[] = [
  {
    id: 'ftp',
    label: 'FTP',
    description: 'Enumerate FTP services and attempt basic password attacks.',
    presets: [
      {
        id: 'ftp-banner',
        name: 'Basic Banner Grab',
        description: 'Detect FTP service and version on port 21.',
        command: 'nmap -sV -p 21 {target}',
        type: 'enum',
      },
      {
        id: 'ftp-anon',
        name: 'Anonymous Login Check',
        description: 'Check for anonymous FTP access using Nmap script.',
        command: 'nmap -sV -p 21 --script ftp-anon {target}',
        type: 'enum',
      },
      {
        id: 'ftp-hydra',
        name: 'Hydra FTP Bruteforce',
        description: 'Brute-force FTP login with Hydra (requires username and wordlist).',
        command: 'hydra -l {user} -P {wordlist} {target} ftp',
        type: 'bruteforce',
      },
    ],
  },
  {
    id: 'smb',
    label: 'SMB',
    description: 'Enumerate SMB shares, users, and perform basic brute-force.',
    presets: [
      {
        id: 'smb-nmap-enum',
        name: 'Nmap SMB Enum',
        description: 'Enumerate SMB shares and users via Nmap scripts.',
        command: 'nmap -sV -p 445 --script smb-enum-shares,smb-enum-users {target}',
        type: 'enum',
      },
      {
        id: 'smb-enum4linux',
        name: 'enum4linux All',
        description: 'Run full enum4linux enumeration against target.',
        command: 'enum4linux -a {target}',
        type: 'enum',
      },
      {
        id: 'smb-hydra',
        name: 'Hydra SMB Bruteforce',
        description: 'Brute-force SMB credentials with Hydra.',
        command: 'hydra -l {user} -P {wordlist} {target} smb',
        type: 'bruteforce',
      },
    ],
  },
  {
    id: 'nfs',
    label: 'NFS',
    description: 'Discover NFS exports and misconfigurations.',
    presets: [
      {
        id: 'nfs-nmap',
        name: 'Nmap NFS Scripts',
        description: 'Scan RPC/NFS ports and run NFS-related scripts.',
        command: 'nmap -sV -p 111,2049 --script nfs-* {target}',
        type: 'enum',
      },
      {
        id: 'nfs-showmount',
        name: 'showmount Exports',
        description: 'List exported NFS shares from the target.',
        command: 'showmount -e {target}',
        type: 'enum',
      },
    ],
  },
  {
    id: 'dns',
    label: 'DNS',
    description: 'Fingerprint DNS servers and attempt zone transfers.',
    presets: [
      {
        id: 'dns-nmap',
        name: 'Nmap DNS Version',
        description: 'Detect DNS service and version on port 53.',
        command: 'nmap -sV -p 53 {target}',
        type: 'enum',
      },
      {
        id: 'dns-dig-axfr',
        name: 'dig Zone Transfer',
        description: 'Attempt a DNS zone transfer using dig.',
        command: 'dig @{target} {domain} AXFR',
        type: 'enum',
      },
      {
        id: 'dns-dnsenum',
        name: 'dnsenum Subdomains',
        description: 'Enumerate DNS information and subdomains.',
        command: 'dnsenum {domain}',
        type: 'enum',
      },
    ],
  },
  {
    id: 'smtp',
    label: 'SMTP',
    description: 'Enumerate SMTP servers and users; attempt simple bruteforce.',
    presets: [
      {
        id: 'smtp-nmap',
        name: 'Nmap SMTP Enum Users',
        description: 'Enumerate SMTP users via Nmap scripts.',
        command: 'nmap -sV -p 25,465,587 --script smtp-enum-users {target}',
        type: 'enum',
      },
      {
        id: 'smtp-user-enum',
        name: 'smtp-user-enum',
        description: 'Enumerate valid SMTP users from a user list.',
        command: 'smtp-user-enum -M VRFY -U {userlist} -t {target}',
        type: 'enum',
      },
      {
        id: 'smtp-hydra',
        name: 'Hydra SMTP Bruteforce',
        description: 'Brute-force SMTP authentication with Hydra.',
        command: 'hydra -l {user} -P {wordlist} {target} smtp',
        type: 'bruteforce',
      },
    ],
  },
  {
    id: 'imap-pop3',
    label: 'IMAP / POP3',
    description: 'Fingerprint and attack IMAP/POP3 mail services.',
    presets: [
      {
        id: 'imap-pop3-nmap',
        name: 'Nmap IMAP/POP3',
        description: 'Scan common IMAP/POP3 ports with service detection.',
        command: 'nmap -sV -p 110,143,993,995 --script imap* {target}',
        type: 'enum',
      },
      {
        id: 'imap-hydra',
        name: 'Hydra IMAP Bruteforce',
        description: 'Brute-force IMAP logins with Hydra.',
        command: 'hydra -l {user} -P {wordlist} {target} imap',
        type: 'bruteforce',
      },
      {
        id: 'pop3-hydra',
        name: 'Hydra POP3 Bruteforce',
        description: 'Brute-force POP3 logins with Hydra.',
        command: 'hydra -l {user} -P {wordlist} {target} pop3',
        type: 'bruteforce',
      },
    ],
  },
  {
    id: 'snmp',
    label: 'SNMP',
    description: 'Identify SNMP instances and enumerate via community strings.',
    presets: [
      {
        id: 'snmp-nmap',
        name: 'Nmap SNMP Info',
        description: 'Detect SNMP and basic info using Nmap.',
        command: 'nmap -sU -p 161 --script snmp-info {target}',
        type: 'enum',
      },
      {
        id: 'snmp-onesixtyone',
        name: 'onesixtyone Community Scan',
        description: 'Scan SNMP community strings using onesixtyone.',
        command: 'onesixtyone -c {communitylist} {target}',
        type: 'enum',
      },
      {
        id: 'snmp-walk',
        name: 'snmpwalk Full',
        description: 'Walk SNMP tree with a known community string.',
        command: 'snmpwalk -v2c -c {community} {target} 1',
        type: 'enum',
      },
    ],
  },
  {
    id: 'mysql',
    label: 'MySQL',
    description: 'Discover and attack MySQL services.',
    presets: [
      {
        id: 'mysql-nmap',
        name: 'Nmap MySQL Scripts',
        description: 'Run Nmap MySQL scripts against port 3306.',
        command: 'nmap -sV -p 3306 --script mysql-* {target}',
        type: 'enum',
      },
      {
        id: 'mysql-cli',
        name: 'MySQL CLI Connect',
        description: 'Connect to MySQL with the mysql client.',
        command: 'mysql -u {user} -p -h {target}',
        type: 'enum',
      },
      {
        id: 'mysql-hydra',
        name: 'Hydra MySQL Bruteforce',
        description: 'Brute-force MySQL credentials with Hydra.',
        command: 'hydra -l {user} -P {wordlist} {target} mysql',
        type: 'bruteforce',
      },
    ],
  },
  {
    id: 'mssql',
    label: 'MSSQL',
    description: 'Enumerate and brute-force Microsoft SQL Server.',
    presets: [
      {
        id: 'mssql-nmap',
        name: 'Nmap MSSQL Scripts',
        description: 'Scan MSSQL on port 1433 with Nmap scripts.',
        command: 'nmap -sV -p 1433 --script ms-sql-* {target}',
        type: 'enum',
      },
      {
        id: 'mssql-impacket',
        name: 'Impacket mssqlclient',
        description: 'Connect using impacket-mssqlclient.',
        command: 'impacket-mssqlclient {user}@{target} -windows-auth',
        type: 'enum',
      },
      {
        id: 'mssql-hydra',
        name: 'Hydra MSSQL Bruteforce',
        description: 'Brute-force MSSQL credentials with Hydra.',
        command: 'hydra -l {user} -P {wordlist} {target} mssql',
        type: 'bruteforce',
      },
    ],
  },
  {
    id: 'oracle',
    label: 'Oracle TNS',
    description: 'Fingerprint and enumerate Oracle databases.',
    presets: [
      {
        id: 'oracle-nmap',
        name: 'Nmap Oracle Scripts',
        description: 'Scan Oracle TNS listener on port 1521 with Nmap.',
        command: 'nmap -sV -p 1521 --script oracle-* {target}',
        type: 'enum',
      },
      {
        id: 'oracle-tnscmd',
        name: 'tnscmd10g Status',
        description: 'Query Oracle TNS listener status with tnscmd10g.',
        command: 'tnscmd10g status -h {target} -p 1521',
        type: 'enum',
      },
    ],
  },
  {
    id: 'ipmi',
    label: 'IPMI',
    description: 'Enumerate and attack out-of-band management (IPMI).',
    presets: [
      {
        id: 'ipmi-nmap',
        name: 'Nmap IPMI Scripts',
        description: 'Scan IPMI UDP port 623 and run IPMI NSE scripts.',
        command: 'nmap -sU -p 623 --script ipmi-* {target}',
        type: 'enum',
      },
      {
        id: 'ipmi-tool',
        name: 'ipmitool Probe',
        description: 'Probe IPMI with ipmitool (no password).',
        command: 'ipmitool -I lanplus -H {target} -U {user} chassis status',
        type: 'enum',
      },
    ],
  },
];

function FingerprintingSection() {
  const { socket, status } = useSocket();
  const { push } = useToast();
  const [activeService, setActiveService] = useState<string>('ftp');

  // Simple shared inputs used in command templates
  const [target, setTarget] = useState('');
  const [user, setUser] = useState('admin');
  const [wordlist, setWordlist] = useState('/usr/share/wordlists/rockyou.txt');
  const [domain, setDomain] = useState('example.com');
  const [community, setCommunity] = useState('public');
  const [communityList, setCommunityList] = useState('/usr/share/seclists/Discovery/SNMP/snmp.txt');
  const [userlist, setUserlist] = useState('/usr/share/seclists/Usernames/top-usernames-shortlist.txt');

  const buildCommand = (preset: FingerprintPreset) => {
    let cmd = preset.command;
    const replacements: Record<string, string> = {
      target,
      user,
      wordlist,
      domain,
      community,
      communitylist: communityList,
      userlist,
    };
    Object.entries(replacements).forEach(([key, value]) => {
      cmd = cmd.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    });
    // Clean up any remaining placeholders and whitespace
    cmd = cmd.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
    return cmd;
  };

  const runPreset = (preset: FingerprintPreset) => {
    if (!socket || status !== 'connected') {
      push({ title: 'Not connected', description: 'Connect via SSH first', variant: 'destructive' });
      return;
    }

    // Basic required target validation for all presets
    if (!target) {
      push({ title: 'Missing target', description: 'Please set the target host first', variant: 'destructive' });
      return;
    }

    // Additional lightweight validation for bruteforce presets
    if (preset.type === 'bruteforce' && !wordlist) {
      push({ title: 'Missing wordlist', description: 'Set a password wordlist path before running bruteforce commands', variant: 'destructive' });
      return;
    }

    const cmd = buildCommand(preset);
    if (!cmd) {
      push({ title: 'No command', description: 'Could not build command from preset', variant: 'destructive' });
      return;
    }

    socket.emit('ctf.runCommand', { command: cmd });
    push({ title: 'Command sent', description: `Executing: ${preset.name}. Check the Main terminal tab for output.` });
  };

  const copyPreset = (preset: FingerprintPreset) => {
    const cmd = buildCommand(preset);
    if (!cmd) {
      push({ title: 'No command', description: 'Could not build command from preset', variant: 'destructive' });
      return;
    }
    navigator.clipboard.writeText(cmd).then(() => {
      push({ title: 'Copied', description: 'Command copied to clipboard' });
    });
  };

  return (
    <div className="space-y-4">
      {/* Shared inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Target Host / IP</Label>
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="192.168.1.10"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Username (for auth tests)</Label>
          <Input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="admin"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Password Wordlist</Label>
          <Input
            value={wordlist}
            onChange={(e) => setWordlist(e.target.value)}
            placeholder="/usr/share/wordlists/rockyou.txt"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Domain (DNS / SMTP)</Label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">SNMP Community</Label>
          <Input
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
            placeholder="public"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">SNMP Community Wordlist</Label>
          <Input
            value={communityList}
            onChange={(e) => setCommunityList(e.target.value)}
            placeholder="/usr/share/seclists/Discovery/SNMP/snmp.txt"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">User List (SMTP / SMB)</Label>
          <Input
            value={userlist}
            onChange={(e) => setUserlist(e.target.value)}
            placeholder="/usr/share/seclists/Usernames/top-usernames-shortlist.txt"
            className="font-mono text-xs"
          />
        </div>
      </div>

      {/* Service tabs */}
      <Tabs value={activeService} onValueChange={setActiveService} className="mt-2">
        <TabsList className="flex flex-wrap gap-1">
          {fingerprintServices.map((svc) => (
            <TabsTrigger key={svc.id} value={svc.id} className="text-xs">
              {svc.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {fingerprintServices.map((svc) => (
          <TabsContent key={svc.id} value={svc.id} className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">{svc.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {svc.presets.map((preset) => (
                <Card key={preset.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm">{preset.name}</CardTitle>
                        <CardDescription className="text-xs">{preset.description}</CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          preset.type === 'enum'
                            ? 'bg-primary/10 text-primary border-primary/30 text-[10px]'
                            : 'bg-destructive/10 text-destructive border-destructive/30 text-[10px]'
                        }
                      >
                        {preset.type === 'enum' ? 'ENUM' : 'BRUTEFORCE'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2 flex-1 flex flex-col">
                    <div className="bg-muted/60 rounded-md p-2 font-mono text-[11px] break-all border">
                      <span className="text-primary">$</span> {buildCommand(preset) || preset.command}
                    </div>
                    <div className="mt-auto flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => copyPreset(preset)}
                      >
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        className={`flex-1 ${preset.type === 'bruteforce' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}`}
                        onClick={() => runPreset(preset)}
                        disabled={status !== 'connected'}
                      >
                        Run
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default function CTFFingerprintingPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-8 w-8">
            <Link href="/app/ctf/tools">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
              <Crosshair className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                Service Fingerprinting
                <Badge variant="outline" className="text-xs">
                  CTF
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground">
                Enumerate common services and launch targeted bruteforce attacks from a single panel.
              </p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs flex items-center gap-1">
          <Terminal className="h-3 w-3" />
          Output: Main terminal tab
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Service Fingerprinting & Attacks</CardTitle>
          <CardDescription className="text-xs">
            Set your target and optional parameters, then choose a service tab and preset to run. Commands execute in the shared SSH session and show output in the Main terminal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FingerprintingSection />
        </CardContent>
      </Card>
    </div>
  );
}



