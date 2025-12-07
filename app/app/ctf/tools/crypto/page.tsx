"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Key } from "lucide-react";
import Link from 'next/link';
import { ToolExecutor } from '../lib/tool-executor';
import { Tool } from '../lib/types';

const john: Tool = {
  id: 'john',
  name: 'John the Ripper',
  description: 'Versatile password cracker',
  longDescription: 'John the Ripper is a free and open source password security auditing tool. It combines several cracking modes and supports hundreds of hash and cipher types, including Unix passwords, Windows LM hashes, and many more.',
  installCmd: 'apt-get install -y john',
  checkCmd: 'which john',
  documentation: 'https://www.openwall.com/john/doc/',
  tips: [
    'Use hash-identifier or hashid to identify unknown hash types',
    'john2john scripts convert files: ssh2john, zip2john, pdf2john, etc.',
    'Always run --show after cracking to display results',
    'Add --rules to apply transformations to wordlist (l33t speak, etc.)',
    'For SSH keys: ssh2john id_rsa > hash.txt, then crack',
    'Check ~/.john/john.pot for all previously cracked passwords',
  ],
  presets: [
    {
      id: 'wordlist',
      name: 'Wordlist Attack',
      level: 'basic',
      description: 'Crack hashes using a wordlist',
      command: 'john --wordlist={wordlist} {hashfile}',
      args: [
        { name: 'hashfile', placeholder: '/tmp/hashes.txt', description: 'File containing hashes (one per line)', required: true, type: 'text' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password wordlist', required: true, type: 'select', options: [
          { value: '/usr/share/wordlists/rockyou.txt', label: 'RockYou (14M passwords)' },
          { value: '/usr/share/wordlists/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000.txt', label: 'Top 1000 Passwords' },
          { value: '/usr/share/wordlists/seclists/Passwords/Common-Credentials/10-million-password-list-top-10000.txt', label: 'Top 10000 Passwords' },
        ], default: '/usr/share/wordlists/rockyou.txt' },
      ],
      notes: ['John auto-detects hash format', 'Cracked passwords saved in ~/.john/john.pot'],
    },
    {
      id: 'show',
      name: 'Show Cracked',
      level: 'basic',
      description: 'Display previously cracked passwords',
      command: 'john --show {hashfile}',
      args: [
        { name: 'hashfile', placeholder: '/tmp/hashes.txt', description: 'Original hash file', required: true, type: 'text' },
      ],
    },
    {
      id: 'format',
      name: 'Specific Format',
      level: 'intermediate',
      description: 'Crack hashes with explicit format',
      command: 'john --format={format} --wordlist={wordlist} {hashfile}',
      args: [
        { name: 'hashfile', placeholder: '/tmp/hashes.txt', description: 'Hash file', required: true, type: 'text' },
        { name: 'format', placeholder: 'raw-md5', description: 'Hash format', required: true, type: 'select', options: [
          { value: 'raw-md5', label: 'MD5 (raw)' },
          { value: 'raw-sha1', label: 'SHA1 (raw)' },
          { value: 'raw-sha256', label: 'SHA256 (raw)' },
          { value: 'raw-sha512', label: 'SHA512 (raw)' },
          { value: 'bcrypt', label: 'bcrypt' },
          { value: 'md5crypt', label: 'MD5 Crypt ($1$)' },
          { value: 'sha256crypt', label: 'SHA256 Crypt ($5$)' },
          { value: 'sha512crypt', label: 'SHA512 Crypt ($6$)' },
          { value: 'NTLM', label: 'Windows NTLM' },
          { value: 'LM', label: 'Windows LM' },
          { value: 'mysql-sha1', label: 'MySQL 4.1+' },
          { value: 'krb5tgs', label: 'Kerberos TGS' },
          { value: 'krb5asrep', label: 'Kerberos AS-REP' },
        ] },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Wordlist path', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
      ],
      notes: ['Use john --list=formats to see all supported formats', 'Some formats require specific build (jumbo)'],
    },
    {
      id: 'rules',
      name: 'Rules-Based Attack',
      level: 'advanced',
      description: 'Apply word mangling rules',
      command: 'john --wordlist={wordlist} --rules={rules} {hashfile}',
      args: [
        { name: 'hashfile', placeholder: '/tmp/hashes.txt', description: 'Hash file', required: true, type: 'text' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Base wordlist', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
        { name: 'rules', placeholder: 'best64', description: 'Rule set to apply', required: true, type: 'select', options: [
          { value: 'best64', label: 'Best64 (efficient)' },
          { value: 'wordlist', label: 'Wordlist (default)' },
          { value: 'jumbo', label: 'Jumbo (comprehensive)' },
          { value: 'korelogic', label: 'KoreLogic (extensive)' },
          { value: 'all', label: 'All Rules (slow)' },
        ], default: 'best64' },
      ],
      notes: ['Rules mutate wordlist entries (l33t, caps, numbers)', 'best64 is a good balance of speed and coverage'],
    },
    {
      id: 'incremental',
      name: 'Incremental Mode',
      level: 'advanced',
      description: 'Brute-force character combinations',
      command: 'john --incremental={mode} --max-length={length} {hashfile}',
      args: [
        { name: 'hashfile', placeholder: '/tmp/hashes.txt', description: 'Hash file', required: true, type: 'text' },
        { name: 'mode', placeholder: 'ASCII', description: 'Character set mode', required: true, type: 'select', options: [
          { value: 'lower', label: 'Lowercase (a-z)' },
          { value: 'upper', label: 'Uppercase (A-Z)' },
          { value: 'digits', label: 'Digits (0-9)' },
          { value: 'alnum', label: 'Alphanumeric' },
          { value: 'ASCII', label: 'Full ASCII' },
        ], default: 'alnum' },
        { name: 'length', placeholder: '8', description: 'Maximum password length', required: true, type: 'number', default: '8' },
      ],
      notes: ['Pure brute-force, very slow for long passwords', 'Use for short or simple passwords only'],
    },
    {
      id: 'ssh2john',
      name: 'Extract SSH Key Hash',
      level: 'expert',
      description: 'Extract hash from encrypted SSH private key',
      command: 'ssh2john {keyfile} > /tmp/ssh_hash.txt && john --wordlist={wordlist} /tmp/ssh_hash.txt',
      args: [
        { name: 'keyfile', placeholder: '/tmp/id_rsa', description: 'Encrypted SSH private key', required: true, type: 'text' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Wordlist', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
      ],
      notes: ['Works on password-protected SSH keys', 'Similar tools: zip2john, rar2john, keepass2john'],
    },
  ],
};

const hashcat: Tool = {
  id: 'hashcat',
  name: 'Hashcat',
  description: 'Advanced GPU-accelerated password recovery',
  longDescription: 'Hashcat is the world\'s fastest and most advanced password recovery utility, supporting GPU acceleration and hundreds of hash types. It offers multiple attack modes including dictionary, combinator, brute-force, and rule-based attacks.',
  installCmd: 'apt-get install -y hashcat',
  checkCmd: 'which hashcat',
  documentation: 'https://hashcat.net/wiki/',
  tips: [
    'Use hashcat.net/wiki/doku.php?id=example_hashes to find -m mode numbers',
    'GPU is much faster than CPU - use --force only for testing on VMs',
    'Rule files multiply wordlist effectiveness: -r /usr/share/hashcat/rules/best64.rule',
    'For unknown hash type, use hashid -m hash.txt to get hashcat mode',
    'Potfile stores cracked hashes: --show displays results, --potfile-disable to ignore',
    'Use -O for optimized kernels (faster but password length limited)',
  ],
  presets: [
    {
      id: 'dict-md5',
      name: 'MD5 Dictionary Attack',
      level: 'basic',
      description: 'Crack MD5 hashes with wordlist',
      command: 'hashcat -m 0 -a 0 {hashfile} {wordlist} --force',
      args: [
        { name: 'hashfile', placeholder: '/tmp/hashes.txt', description: 'File with MD5 hashes', required: true, type: 'text' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Wordlist', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
      ],
      notes: ['-m 0 is MD5 mode', '-a 0 is dictionary attack', '--force for CPU-only mode'],
    },
    {
      id: 'identify',
      name: 'Identify Hash Type',
      level: 'basic',
      description: 'Auto-detect hash mode',
      command: 'hashcat --identify {hashfile}',
      args: [
        { name: 'hashfile', placeholder: '/tmp/hashes.txt', description: 'Hash file to identify', required: true, type: 'text' },
      ],
      notes: ['Shows possible hash modes (-m values)', 'Check hashcat.net/wiki for mode reference'],
    },
    {
      id: 'dict-modes',
      name: 'Dictionary Attack',
      level: 'intermediate',
      description: 'Crack various hash types',
      command: 'hashcat -m {mode} -a 0 {hashfile} {wordlist} --force',
      args: [
        { name: 'hashfile', placeholder: '/tmp/hashes.txt', description: 'Hash file', required: true, type: 'text' },
        { name: 'mode', placeholder: '0', description: 'Hash mode', required: true, type: 'select', options: [
          { value: '0', label: '0 - MD5' },
          { value: '100', label: '100 - SHA1' },
          { value: '1400', label: '1400 - SHA256' },
          { value: '1700', label: '1700 - SHA512' },
          { value: '3200', label: '3200 - bcrypt' },
          { value: '1000', label: '1000 - NTLM' },
          { value: '1800', label: '1800 - SHA512crypt ($6$)' },
          { value: '500', label: '500 - MD5crypt ($1$)' },
          { value: '13100', label: '13100 - Kerberos TGS' },
          { value: '18200', label: '18200 - Kerberos AS-REP' },
          { value: '5600', label: '5600 - NetNTLMv2' },
        ] },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Wordlist', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
      ],
    },
    {
      id: 'rules',
      name: 'Rules Attack',
      level: 'advanced',
      description: 'Apply transformation rules',
      command: 'hashcat -m {mode} -a 0 {hashfile} {wordlist} -r {rules} --force',
      args: [
        { name: 'hashfile', placeholder: '/tmp/hashes.txt', description: 'Hash file', required: true, type: 'text' },
        { name: 'mode', placeholder: '0', description: 'Hash mode', required: true, type: 'text', default: '0' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Wordlist', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
        { name: 'rules', placeholder: '/usr/share/hashcat/rules/best64.rule', description: 'Rules file', required: true, type: 'select', options: [
          { value: '/usr/share/hashcat/rules/best64.rule', label: 'Best64 (fast, effective)' },
          { value: '/usr/share/hashcat/rules/rockyou-30000.rule', label: 'RockYou 30K' },
          { value: '/usr/share/hashcat/rules/d3ad0ne.rule', label: 'D3ad0ne' },
          { value: '/usr/share/hashcat/rules/dive.rule', label: 'Dive (extensive)' },
          { value: '/usr/share/hashcat/rules/OneRuleToRuleThemAll.rule', label: 'OneRule (comprehensive)' },
        ], default: '/usr/share/hashcat/rules/best64.rule' },
      ],
    },
    {
      id: 'mask',
      name: 'Mask Attack',
      level: 'advanced',
      description: 'Pattern-based brute-force',
      command: 'hashcat -m {mode} -a 3 {hashfile} {mask} --force',
      args: [
        { name: 'hashfile', placeholder: '/tmp/hashes.txt', description: 'Hash file', required: true, type: 'text' },
        { name: 'mode', placeholder: '0', description: 'Hash mode', required: true, type: 'text', default: '0' },
        { name: 'mask', placeholder: '?l?l?l?l?d?d', description: 'Mask pattern', required: true, type: 'select', options: [
          { value: '?l?l?l?l?l?l', label: '6 lowercase letters' },
          { value: '?u?l?l?l?l?l', label: 'Capitalized 6 letters' },
          { value: '?l?l?l?l?d?d', label: '4 letters + 2 digits' },
          { value: '?d?d?d?d?d?d', label: '6 digits (PIN)' },
          { value: '?a?a?a?a?a?a', label: '6 any chars (slow)' },
          { value: 'Company?d?d?d?d', label: 'Company + 4 digits' },
        ] },
      ],
      notes: ['?l=lowercase, ?u=uppercase, ?d=digit, ?s=special, ?a=all', 'Effective for known password patterns'],
    },
    {
      id: 'combinator',
      name: 'Combinator Attack',
      level: 'expert',
      description: 'Combine two wordlists',
      command: 'hashcat -m {mode} -a 1 {hashfile} {wordlist1} {wordlist2} --force',
      args: [
        { name: 'hashfile', placeholder: '/tmp/hashes.txt', description: 'Hash file', required: true, type: 'text' },
        { name: 'mode', placeholder: '0', description: 'Hash mode', required: true, type: 'text', default: '0' },
        { name: 'wordlist1', placeholder: '/tmp/words1.txt', description: 'First wordlist', required: true, type: 'text' },
        { name: 'wordlist2', placeholder: '/tmp/words2.txt', description: 'Second wordlist', required: true, type: 'text' },
      ],
      notes: ['Concatenates each word from list1 with each from list2', 'Useful for compound passwords'],
    },
  ],
};

const hydra: Tool = {
  id: 'hydra',
  name: 'Hydra',
  description: 'Fast network login cracker',
  longDescription: 'Hydra is a parallelized login cracker supporting numerous protocols. It is fast and flexible, supporting many attack vectors including SSH, FTP, HTTP, HTTPS, SMB, MySQL, and more.',
  installCmd: 'apt-get install -y hydra',
  checkCmd: 'which hydra',
  documentation: 'https://github.com/vanhauser-thc/thc-hydra',
  tips: [
    'Use -t 4 for SSH (more threads = account lockouts)',
    'For web forms, analyze login with Burp first to get the POST format',
    'Add -V for verbose output to see each attempt',
    'Use -e nsr to test: n=null password, s=username as password, r=reverse',
    'Try common usernames: admin, root, user, guest, test',
    'For HTTP: ^USER^ and ^PASS^ are placeholders in the request string',
  ],
  presets: [
    {
      id: 'ssh-single',
      name: 'SSH Single User',
      level: 'basic',
      description: 'Brute-force SSH with known username',
      command: 'hydra -l {user} -P {wordlist} {target} ssh -t 4',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target IP or hostname', required: true, type: 'text' },
        { name: 'user', placeholder: 'admin', description: 'Username to attack', required: true, type: 'text' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password wordlist', required: true, type: 'text', default: '/usr/share/wordlists/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000.txt' },
      ],
      notes: ['-t 4 limits parallel connections (SSH often limits)', 'Increase -t for faster attacks if server allows'],
    },
    {
      id: 'ssh-users',
      name: 'SSH User Enumeration',
      level: 'intermediate',
      description: 'Brute-force multiple usernames',
      command: 'hydra -L {userlist} -P {wordlist} {target} ssh -t 4',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target', required: true, type: 'text' },
        { name: 'userlist', placeholder: '/usr/share/wordlists/seclists/Usernames/top-usernames-shortlist.txt', description: 'Username list', required: true, type: 'text', default: '/usr/share/wordlists/seclists/Usernames/top-usernames-shortlist.txt' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password list', required: true, type: 'text', default: '/usr/share/wordlists/seclists/Passwords/Common-Credentials/10-million-password-list-top-100.txt' },
      ],
    },
    {
      id: 'ftp',
      name: 'FTP Attack',
      level: 'basic',
      description: 'Brute-force FTP login',
      command: 'hydra -l {user} -P {wordlist} {target} ftp',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target', required: true, type: 'text' },
        { name: 'user', placeholder: 'anonymous', description: 'Username', required: true, type: 'text' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password list', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
      ],
    },
    {
      id: 'http-get',
      name: 'HTTP Basic Auth',
      level: 'intermediate',
      description: 'Brute-force HTTP Basic Authentication',
      command: 'hydra -l {user} -P {wordlist} {target} http-get {path}',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target', required: true, type: 'text' },
        { name: 'path', placeholder: '/admin', description: 'Protected path', required: true, type: 'text', default: '/' },
        { name: 'user', placeholder: 'admin', description: 'Username', required: true, type: 'text' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password list', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
      ],
    },
    {
      id: 'http-post',
      name: 'HTTP POST Form',
      level: 'advanced',
      description: 'Brute-force web login form',
      command: 'hydra -l {user} -P {wordlist} {target} http-post-form "{path}:{params}:{failure}"',
      args: [
        { name: 'target', placeholder: 'target.com', description: 'Target hostname', required: true, type: 'text' },
        { name: 'path', placeholder: '/login.php', description: 'Login form path', required: true, type: 'text' },
        { name: 'user', placeholder: 'admin', description: 'Username', required: true, type: 'text' },
        { name: 'params', placeholder: 'user=^USER^&pass=^PASS^', description: 'POST parameters (^USER^ and ^PASS^ are placeholders)', required: true, type: 'text' },
        { name: 'failure', placeholder: 'Invalid', description: 'String that appears on failed login', required: true, type: 'text' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password list', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
      ],
      notes: ['Examine the login form to get correct parameter names', '^USER^ and ^PASS^ are replaced by Hydra', 'failure string identifies bad login responses'],
    },
    {
      id: 'smb',
      name: 'SMB/Windows Attack',
      level: 'advanced',
      description: 'Brute-force Windows SMB login',
      command: 'hydra -l {user} -P {wordlist} {target} smb',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Windows target', required: true, type: 'text' },
        { name: 'user', placeholder: 'Administrator', description: 'Username', required: true, type: 'text' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password list', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
      ],
      notes: ['May trigger account lockout policies', 'Use -W to set wait time between attempts'],
      dangerous: true,
    },
    {
      id: 'custom',
      name: 'Custom Protocol',
      level: 'expert',
      description: 'Attack any supported service',
      command: 'hydra -l {user} -P {wordlist} -s {port} {target} {protocol} -V',
      args: [
        { name: 'target', placeholder: '192.168.1.1', description: 'Target', required: true, type: 'text' },
        { name: 'protocol', placeholder: 'ssh', description: 'Protocol to attack', required: true, type: 'select', options: [
          { value: 'ssh', label: 'SSH' },
          { value: 'ftp', label: 'FTP' },
          { value: 'telnet', label: 'Telnet' },
          { value: 'mysql', label: 'MySQL' },
          { value: 'postgres', label: 'PostgreSQL' },
          { value: 'mssql', label: 'MS SQL' },
          { value: 'rdp', label: 'RDP' },
          { value: 'vnc', label: 'VNC' },
          { value: 'ldap2', label: 'LDAP' },
          { value: 'smtp', label: 'SMTP' },
          { value: 'pop3', label: 'POP3' },
          { value: 'imap', label: 'IMAP' },
        ] },
        { name: 'port', placeholder: '22', description: 'Custom port', required: true, type: 'number' },
        { name: 'user', placeholder: 'admin', description: 'Username', required: true, type: 'text' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password list', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
      ],
      notes: ['-V enables verbose output', '-s specifies custom port', 'Run hydra --help for all protocols'],
    },
  ],
};

export default function CryptoToolsPage() {
  const [selectedTool, setSelectedTool] = useState<string>('john');

  const tools: Record<string, Tool> = { john, hashcat, hydra };

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
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Password & Crypto Tools</h2>
            <p className="text-xs text-muted-foreground">Hash cracking and brute-force attacks</p>
          </div>
        </div>
      </div>

      <Tabs value={selectedTool} onValueChange={setSelectedTool} className="flex-1">
        <TabsList>
          <TabsTrigger value="john">John the Ripper</TabsTrigger>
          <TabsTrigger value="hashcat">Hashcat</TabsTrigger>
          <TabsTrigger value="hydra">Hydra</TabsTrigger>
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

