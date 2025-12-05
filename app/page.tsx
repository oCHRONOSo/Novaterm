import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal, 
  Server, 
  Brain, 
  Shield, 
  Package, 
  Code, 
  Database,
  Network,
  Zap,
  CheckCircle2
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12">
        {/* Hero Section */}
        <header className="flex flex-col gap-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-sm">Novaterm AI</Badge>
          </div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Remote Server Management
            <br />
            <span className="text-primary">Made Simple</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            A powerful web-based platform for managing remote servers via SSH. Configure services, 
            run scripts, and get AI-powered assistance—all from your browser.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Button size="lg" asChild>
              <Link href="/app">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/register">Create Account</Link>
            </Button>
          </div>
        </header>

        {/* Features Grid */}
        <section>
          <h2 className="mb-6 text-3xl font-bold text-center">Key Features</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-primary" />
                  <CardTitle>Interactive Terminal</CardTitle>
                </div>
                <CardDescription>Full-featured terminal with drag, resize, and search</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Real-time SSH connection with xterm.js</p>
                <p>• Draggable and resizable terminal window</p>
                <p>• Terminal search and fullscreen mode</p>
                <p>• Automatic window resizing</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  <CardTitle>SSH Management</CardTitle>
                </div>
                <CardDescription>Secure connections with password or SSH key support</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Password and SSH key authentication</p>
                <p>• Recent connections with auto-fill</p>
                <p>• Encrypted password storage (AES-256-GCM)</p>
                <p>• One-click connection from history</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <CardTitle>AI Assistant</CardTitle>
                </div>
                <CardDescription>Ollama-powered AI for instant help and guidance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Multiple model support (Llama, Mistral, etc.)</p>
                <p>• Streaming responses word-by-word</p>
                <p>• Model installation from UI</p>
                <p>• Configurable token limits</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <CardTitle>Package Manager</CardTitle>
                </div>
                <CardDescription>Smart package search and installation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Search repositories (apt, dnf, yum)</p>
                <p>• One-click package installation</p>
                <p>• Legacy script-based installs</p>
                <p>• Real-time search results</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  <CardTitle>Script Automation</CardTitle>
                </div>
                <CardDescription>Pre-built scripts for common server tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Web server configuration (Apache, Nginx)</p>
                <p>• Database setup (MariaDB)</p>
                <p>• DNS and DHCP configuration</p>
                <p>• Secure script execution with cleanup</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>Security Tools</CardTitle>
                </div>
                <CardDescription>Firewall and security configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• iptables rule generator</p>
                <p>• Firewall configuration wizard</p>
                <p>• Secure credential storage</p>
                <p>• HTTPS-only cookies</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Quick Start Guide */}
        <section className="rounded-lg border bg-card p-8">
          <h2 className="mb-6 text-3xl font-bold text-center">Quick Start Guide</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  1
                </div>
                <div>
                  <h3 className="font-semibold">Create an Account</h3>
                  <p className="text-sm text-muted-foreground">
                    Register a new account or log in with existing credentials. Your data is securely stored 
                    with encrypted passwords.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  2
                </div>
                <div>
                  <h3 className="font-semibold">Connect to Your Server</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your server's IP address, port, username, and password. You can also use SSH keys 
                    for key-based authentication.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  3
                </div>
                <div>
                  <h3 className="font-semibold">Start Managing</h3>
                  <p className="text-sm text-muted-foreground">
                    Use the interactive terminal, install packages, run configuration scripts, or ask the AI 
                    assistant for help with any task.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  4
                </div>
                <div>
                  <h3 className="font-semibold">Use Recent Connections</h3>
                  <p className="text-sm text-muted-foreground">
                    Your connection history is saved. Click "Connect" on any recent connection to instantly 
                    reconnect with stored credentials.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  5
                </div>
                <div>
                  <h3 className="font-semibold">Install Packages</h3>
                  <p className="text-sm text-muted-foreground">
                    Search for packages using your system's package manager or use pre-built installation 
                    scripts for common software.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  6
                </div>
                <div>
                  <h3 className="font-semibold">Get AI Help</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask the AI assistant questions about server configuration, troubleshooting, or commands. 
                    Install different models as needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Technology Stack */}
        <section>
          <h2 className="mb-6 text-3xl font-bold text-center">Built With Modern Technology</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Frontend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>• Next.js 16</p>
                <p>• React 19</p>
                <p>• TypeScript</p>
                <p>• Tailwind CSS</p>
                <p>• shadcn/ui</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Backend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>• Next.js API Routes</p>
                <p>• Prisma ORM</p>
                <p>• MySQL Database</p>
                <p>• Socket.IO</p>
                <p>• JWT Authentication</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">SSH & Terminal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>• ssh2 Library</p>
                <p>• xterm.js</p>
                <p>• SFTP Support</p>
                <p>• Real-time Streaming</p>
                <p>• PTY Support</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">AI Integration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>• Ollama API</p>
                <p>• Multiple Models</p>
                <p>• Streaming Responses</p>
                <p>• Model Management</p>
                <p>• Token Control</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="rounded-lg border bg-primary/5 p-8 text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to Get Started?</h2>
          <p className="mb-6 text-muted-foreground">
            Start managing your servers more efficiently today. No installation required—everything runs in your browser.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/register">Create Free Account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
        </div>
        </section>
        </div>
    </div>
  );
}
