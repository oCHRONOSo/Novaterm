"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Globe } from "lucide-react";
import Link from 'next/link';
import { ToolExecutor } from '../lib/tool-executor';
import { Tool } from '../lib/types';

const ffuf: Tool = {
  id: 'ffuf',
  name: 'ffuf',
  description: 'Fuzz Faster U Fool - Fast web fuzzer',
  longDescription: 'ffuf is a fast web fuzzer written in Go. It excels at directory discovery, parameter fuzzing, virtual host discovery, and more. Its speed and flexibility make it the preferred choice for modern web application testing.',
  installCmd: 'apt-get install -y ffuf || go install github.com/ffuf/ffuf/v2@latest',
  checkCmd: 'which ffuf',
  documentation: 'https://github.com/ffuf/ffuf',
  tips: [
    'Always do a vhost scan on HTB boxes - hidden subdomains are common!',
    'Run without filters first, note the default response size, then add -fs to filter',
    'Use -fc 403,404 to filter common error codes and find interesting responses',
    'Combine -e .php,.bak,.txt to catch backup files developers left behind',
    'Use -rate 100 to avoid rate limiting and detection',
    'SecLists wordlists are better than dirb - install with apt install seclists',
  ],
  presets: [
    {
      id: 'dir-basic',
      name: 'Directory Discovery',
      level: 'basic',
      description: 'Find hidden directories and files',
      command: 'ffuf -u {url}/FUZZ -w /usr/share/wordlists/dirb/common.txt -c',
      args: [
        { name: 'url', placeholder: 'http://target.com', description: 'Base URL without trailing slash', required: true, type: 'text' },
      ],
      notes: ['FUZZ keyword marks where wordlist entries are inserted', '-c enables colorized output'],
      tips: ['Use -mc 200,301,302 to filter by status codes', 'Try SecLists wordlists for better coverage'],
    },
    {
      id: 'dir-extensions',
      name: 'Directory + Extensions',
      level: 'intermediate',
      description: 'Fuzz directories with common file extensions',
      command: 'ffuf -u {url}/FUZZ -w /usr/share/wordlists/dirb/common.txt -e {extensions} -c',
      args: [
        { name: 'url', placeholder: 'http://target.com', description: 'Base URL', required: true, type: 'text' },
        { name: 'extensions', placeholder: '.php,.html,.txt', description: 'File extensions to append', required: true, type: 'select', options: [
          { value: '.php,.html,.txt', label: 'PHP Stack (.php,.html,.txt)' },
          { value: '.asp,.aspx,.html', label: 'ASP Stack (.asp,.aspx,.html)' },
          { value: '.js,.json,.xml', label: 'API Files (.js,.json,.xml)' },
          { value: '.bak,.old,.backup,.swp', label: 'Backup Files' },
          { value: '.php,.html,.txt,.bak,.old', label: 'Common + Backups' },
        ], default: '.php,.html,.txt' },
      ],
    },
    {
      id: 'vhost',
      name: 'Virtual Host Discovery',
      level: 'intermediate',
      description: 'Find virtual hosts on a web server',
      command: 'ffuf -u {url} -H "Host: FUZZ.{domain}" -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt -c -fs {filter_size}',
      args: [
        { name: 'url', placeholder: 'http://10.10.10.10', description: 'Target IP or URL', required: true, type: 'text' },
        { name: 'domain', placeholder: 'target.htb', description: 'Base domain for vhost fuzzing', required: true, type: 'text' },
        { name: 'filter_size', placeholder: '0', description: 'Filter responses by size (set after initial run)', required: true, type: 'text', default: '0' },
      ],
      notes: ['Run once without -fs to see default response size', 'Then filter out that size to find valid vhosts', 'Add target domain to /etc/hosts first'],
      tips: ['Essential for HTB! Many boxes have hidden vhosts', 'Also try -fl (filter lines) or -fw (filter words) instead of -fs', 'Add found vhosts to /etc/hosts immediately'],
    },
    {
      id: 'param-get',
      name: 'GET Parameter Fuzzing',
      level: 'intermediate',
      description: 'Discover hidden GET parameters',
      command: 'ffuf -u "{url}?FUZZ={value}" -w /usr/share/wordlists/seclists/Discovery/Web-Content/burp-parameter-names.txt -c -fs {filter_size}',
      args: [
        { name: 'url', placeholder: 'http://target.com/page', description: 'Target URL', required: true, type: 'text' },
        { name: 'value', placeholder: 'test', description: 'Value to send with parameter', required: true, type: 'text', default: 'test' },
        { name: 'filter_size', placeholder: '0', description: 'Filter by response size', required: false, type: 'text' },
      ],
    },
    {
      id: 'param-post',
      name: 'POST Parameter Fuzzing',
      level: 'advanced',
      description: 'Fuzz POST data parameters',
      command: 'ffuf -u {url} -X POST -d "FUZZ={value}" -w /usr/share/wordlists/seclists/Discovery/Web-Content/burp-parameter-names.txt -H "Content-Type: application/x-www-form-urlencoded" -c',
      args: [
        { name: 'url', placeholder: 'http://target.com/api', description: 'Target endpoint', required: true, type: 'text' },
        { name: 'value', placeholder: 'test', description: 'Value for fuzzing', required: true, type: 'text', default: 'test' },
      ],
    },
    {
      id: 'recursive',
      name: 'Recursive Scan',
      level: 'advanced',
      description: 'Recursively discover nested directories',
      command: 'ffuf -u {url}/FUZZ -w /usr/share/wordlists/dirb/common.txt -recursion -recursion-depth {depth} -e .php,.html -c -v',
      args: [
        { name: 'url', placeholder: 'http://target.com', description: 'Base URL', required: true, type: 'text' },
        { name: 'depth', placeholder: '2', description: 'Recursion depth', required: true, type: 'select', options: [
          { value: '1', label: 'Depth 1' },
          { value: '2', label: 'Depth 2' },
          { value: '3', label: 'Depth 3' },
        ], default: '2' },
      ],
      notes: ['Can generate many requests', 'Use -rate to limit speed if needed'],
    },
    {
      id: 'multi-fuzz',
      name: 'Multi-Position Fuzzing',
      level: 'expert',
      description: 'Fuzz multiple positions simultaneously (credential testing)',
      command: 'ffuf -u {url} -X POST -d "username=UNAME&password=PASS" -w {userlist}:UNAME -w {passlist}:PASS -H "Content-Type: application/x-www-form-urlencoded" -fc 401,403 -c',
      args: [
        { name: 'url', placeholder: 'http://target.com/login', description: 'Login endpoint', required: true, type: 'text' },
        { name: 'userlist', placeholder: '/usr/share/wordlists/seclists/Usernames/top-usernames-shortlist.txt', description: 'Username wordlist', required: true, type: 'text', default: '/usr/share/wordlists/seclists/Usernames/top-usernames-shortlist.txt' },
        { name: 'passlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password wordlist', required: true, type: 'text', default: '/usr/share/wordlists/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000.txt' },
      ],
      notes: ['Creates cartesian product of both lists', 'Can generate many requests quickly', 'Use -rate to limit if needed'],
      dangerous: true,
    },
  ],
};

const sqlmap: Tool = {
  id: 'sqlmap',
  name: 'SQLMap',
  description: 'Automatic SQL injection and database takeover tool',
  longDescription: 'SQLMap is an open source penetration testing tool that automates the detection and exploitation of SQL injection flaws. It supports multiple database management systems and provides full access to the underlying database.',
  installCmd: 'apt-get install -y sqlmap',
  checkCmd: 'which sqlmap',
  documentation: 'https://sqlmap.org/',
  tips: [
    'Save requests from Burp Suite and use -r file.txt for complex injections',
    'Use --technique=BEUST to try all injection techniques',
    'If WAF blocks you, try --tamper=space2comment,between,randomcase',
    'Always try --os-shell after finding injection - you might get RCE!',
    'Use --proxy=http://127.0.0.1:8080 to intercept in Burp',
    'Add --level=5 --risk=3 for thorough testing (but slower)',
  ],
  presets: [
    {
      id: 'basic-test',
      name: 'Basic Injection Test',
      level: 'basic',
      description: 'Test a URL parameter for SQL injection',
      command: 'sqlmap -u "{url}" --batch --random-agent',
      args: [
        { name: 'url', placeholder: 'http://target.com/page?id=1', description: 'URL with injectable parameter', required: true, type: 'text' },
      ],
      notes: ['--batch uses default answers', '--random-agent rotates user agents', 'Parameter must be in the URL'],
    },
    {
      id: 'post-data',
      name: 'POST Data Injection',
      level: 'intermediate',
      description: 'Test POST parameters for injection',
      command: 'sqlmap -u "{url}" --data "{data}" --batch --random-agent',
      args: [
        { name: 'url', placeholder: 'http://target.com/login', description: 'Target endpoint', required: true, type: 'text' },
        { name: 'data', placeholder: 'username=admin&password=test', description: 'POST data with injectable param', required: true, type: 'text' },
      ],
    },
    {
      id: 'list-dbs',
      name: 'Enumerate Databases',
      level: 'intermediate',
      description: 'List all databases after confirming injection',
      command: 'sqlmap -u "{url}" --dbs --batch --random-agent',
      args: [
        { name: 'url', placeholder: 'http://target.com/page?id=1', description: 'Injectable URL', required: true, type: 'text' },
      ],
    },
    {
      id: 'list-tables',
      name: 'Enumerate Tables',
      level: 'intermediate',
      description: 'List tables in a specific database',
      command: 'sqlmap -u "{url}" -D {database} --tables --batch --random-agent',
      args: [
        { name: 'url', placeholder: 'http://target.com/page?id=1', description: 'Injectable URL', required: true, type: 'text' },
        { name: 'database', placeholder: 'webapp_db', description: 'Target database name', required: true, type: 'text' },
      ],
    },
    {
      id: 'dump-table',
      name: 'Dump Table Data',
      level: 'advanced',
      description: 'Extract all data from a table',
      command: 'sqlmap -u "{url}" -D {database} -T {table} --dump --batch --random-agent',
      args: [
        { name: 'url', placeholder: 'http://target.com/page?id=1', description: 'Injectable URL', required: true, type: 'text' },
        { name: 'database', placeholder: 'webapp_db', description: 'Database name', required: true, type: 'text' },
        { name: 'table', placeholder: 'users', description: 'Table name', required: true, type: 'text' },
      ],
      notes: ['May take time for large tables', 'Data saved to ~/.local/share/sqlmap/output/'],
    },
    {
      id: 'os-shell',
      name: 'OS Shell',
      level: 'expert',
      description: 'Attempt to get an operating system shell',
      command: 'sqlmap -u "{url}" --os-shell --batch --random-agent',
      args: [
        { name: 'url', placeholder: 'http://target.com/page?id=1', description: 'Injectable URL', required: true, type: 'text' },
      ],
      notes: ['Requires DBA privileges', 'Attempts to upload a web shell', 'Only works on specific configurations'],
      dangerous: true,
    },
    {
      id: 'tamper',
      name: 'WAF Bypass with Tampers',
      level: 'expert',
      description: 'Use tamper scripts to evade WAF/IPS',
      command: 'sqlmap -u "{url}" --tamper={tamper} --random-agent --level 3 --risk 2 --batch',
      args: [
        { name: 'url', placeholder: 'http://target.com/page?id=1', description: 'Injectable URL', required: true, type: 'text' },
        { name: 'tamper', placeholder: 'space2comment', description: 'Tamper script(s)', required: true, type: 'select', options: [
          { value: 'space2comment', label: 'Space to Comment' },
          { value: 'between', label: 'Between (NOT BETWEEN 0 AND)' },
          { value: 'randomcase', label: 'Random Case' },
          { value: 'space2comment,randomcase', label: 'Space2Comment + RandomCase' },
          { value: 'charencode', label: 'URL Encode' },
          { value: 'base64encode', label: 'Base64 Encode' },
        ] },
      ],
      notes: ['--level 3 tests more injection points', '--risk 2 includes time-based tests', 'Multiple tampers can be combined'],
    },
  ],
};

const nikto: Tool = {
  id: 'nikto',
  name: 'Nikto',
  description: 'Web server vulnerability scanner',
  longDescription: 'Nikto is an open source web server scanner that performs comprehensive tests against web servers, including checking for dangerous files, outdated server versions, and server configuration issues.',
  installCmd: 'apt-get install -y nikto',
  checkCmd: 'which nikto',
  documentation: 'https://cirt.net/Nikto2',
  tips: [
    'Nikto is noisy! Use for initial recon, not stealth',
    'Run on both HTTP (80) and HTTPS (443) - configs often differ',
    'Check for /robots.txt and /sitemap.xml findings manually',
    'Use -Tuning x to skip specific test categories',
    'Combine findings with searchsploit for potential exploits',
  ],
  presets: [
    {
      id: 'basic',
      name: 'Basic Scan',
      level: 'basic',
      description: 'Standard vulnerability scan',
      command: 'nikto -h {url}',
      args: [
        { name: 'url', placeholder: 'http://target.com', description: 'Target URL or IP', required: true, type: 'text' },
      ],
    },
    {
      id: 'ssl',
      name: 'SSL/HTTPS Scan',
      level: 'basic',
      description: 'Scan HTTPS site with SSL checks',
      command: 'nikto -h {url} -ssl',
      args: [
        { name: 'url', placeholder: 'https://target.com', description: 'Target HTTPS URL', required: true, type: 'text' },
      ],
    },
    {
      id: 'tuning',
      name: 'Targeted Scan',
      level: 'intermediate',
      description: 'Focus on specific vulnerability types',
      command: 'nikto -h {url} -Tuning {tuning}',
      args: [
        { name: 'url', placeholder: 'http://target.com', description: 'Target URL', required: true, type: 'text' },
        { name: 'tuning', placeholder: '1234', description: 'Test types to include', required: true, type: 'select', options: [
          { value: '1', label: '1 - Interesting Files' },
          { value: '2', label: '2 - Misconfiguration' },
          { value: '3', label: '3 - Information Disclosure' },
          { value: '4', label: '4 - Injection (XSS/Script)' },
          { value: '5', label: '5 - Remote File Retrieval' },
          { value: '6', label: '6 - Denial of Service' },
          { value: '9', label: '9 - SQL Injection' },
          { value: '123', label: '1,2,3 - Common Tests' },
          { value: 'x', label: 'x - Reverse Tuning (exclude)' },
        ] },
      ],
    },
    {
      id: 'comprehensive',
      name: 'Comprehensive Scan',
      level: 'advanced',
      description: 'Full scan with all plugins and output',
      command: 'nikto -h {url} -C all -o {output} -Format htm',
      args: [
        { name: 'url', placeholder: 'http://target.com', description: 'Target URL', required: true, type: 'text' },
        { name: 'output', placeholder: '/tmp/nikto_report.html', description: 'Output file path', required: true, type: 'text', default: '/tmp/nikto_report.html' },
      ],
      notes: ['-C all runs all CGI checks', 'HTML format provides readable report', 'Can take significant time'],
    },
    {
      id: 'evasion',
      name: 'IDS Evasion Scan',
      level: 'expert',
      description: 'Use evasion techniques to avoid detection',
      command: 'nikto -h {url} -evasion {evasion} -Pause {pause}',
      args: [
        { name: 'url', placeholder: 'http://target.com', description: 'Target URL', required: true, type: 'text' },
        { name: 'evasion', placeholder: '1', description: 'Evasion technique', required: true, type: 'select', options: [
          { value: '1', label: '1 - Random URI encoding' },
          { value: '2', label: '2 - Directory self-reference (/./)' },
          { value: '3', label: '3 - Premature URL ending' },
          { value: '4', label: '4 - Prepend long random string' },
          { value: '5', label: '5 - Fake parameter' },
          { value: '6', label: '6 - TAB as request spacer' },
          { value: '7', label: '7 - Change URL case' },
          { value: '8', label: '8 - Use Windows directory separator' },
        ] },
        { name: 'pause', placeholder: '2', description: 'Seconds between requests', required: true, type: 'number', default: '2' },
      ],
      notes: ['Slower but harder to detect', 'Use -Pause to limit request rate'],
    },
  ],
};

export default function WebToolsPage() {
  const [selectedTool, setSelectedTool] = useState<string>('ffuf');

  const tools: Record<string, Tool> = { ffuf, sqlmap, nikto };

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
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Web Application Tools</h2>
            <p className="text-xs text-muted-foreground">Fuzzing, injection, and vulnerability scanning</p>
          </div>
        </div>
      </div>

      <Tabs value={selectedTool} onValueChange={setSelectedTool} className="flex-1">
        <TabsList>
          <TabsTrigger value="ffuf">ffuf</TabsTrigger>
          <TabsTrigger value="sqlmap">SQLMap</TabsTrigger>
          <TabsTrigger value="nikto">Nikto</TabsTrigger>
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

