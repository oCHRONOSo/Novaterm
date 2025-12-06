"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Network,
  Wifi,
  Globe,
  Activity,
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
  Search,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Server,
  Laptop,
  Router,
  Database,
  Shield,
  Zap,
} from "lucide-react";
import { useSocket } from '@/contexts/socket-context';
import { useToast } from '@/components/ui/use-toast';

type NetworkInterface = {
  name: string;
  ipv4: string;
  ipv6: string;
  mac: string;
  state: 'up' | 'down';
  mtu: number;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  speed: number;
};

type Connection = {
  id: string;
  protocol: string;
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
  state: string;
  pid: number;
  process: string;
};

type PortScanResult = {
  port: number;
  state: 'open' | 'closed' | 'filtered';
  service: string;
  version?: string;
};

type NetworkNode = {
  id: string;
  ip: string;
  hostname?: string;
  mac?: string;
  type: 'server' | 'client' | 'router' | 'database' | 'unknown';
  status: 'online' | 'offline';
};

type BandwidthData = {
  timestamp: number;
  interface: string;
  rxBytesPerSec: number;
  txBytesPerSec: number;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatBytesPerSec = (bytes: number) => {
  return formatBytes(bytes) + '/s';
};

const commonPorts: { [key: number]: string } = {
  20: 'FTP Data',
  21: 'FTP Control',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  443: 'HTTPS',
  445: 'SMB',
  993: 'IMAPS',
  995: 'POP3S',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  6379: 'Redis',
  8080: 'HTTP Alt',
  27017: 'MongoDB',
};

const connectionStates: { [key: string]: { color: string; label: string } } = {
  ESTABLISHED: { color: 'text-green-500', label: 'Established' },
  LISTEN: { color: 'text-blue-500', label: 'Listening' },
  TIME_WAIT: { color: 'text-yellow-500', label: 'Time Wait' },
  CLOSE_WAIT: { color: 'text-orange-500', label: 'Close Wait' },
  SYN_SENT: { color: 'text-cyan-500', label: 'SYN Sent' },
  SYN_RECV: { color: 'text-cyan-500', label: 'SYN Received' },
  FIN_WAIT1: { color: 'text-purple-500', label: 'FIN Wait 1' },
  FIN_WAIT2: { color: 'text-purple-500', label: 'FIN Wait 2' },
  CLOSED: { color: 'text-gray-500', label: 'Closed' },
};

export default function NetworkMonitoringPage() {
  const { socket, status } = useSocket();
  const { push } = useToast();
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [bandwidthHistory, setBandwidthHistory] = useState<BandwidthData[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);

  // Port scanner state
  const [scanTarget, setScanTarget] = useState('127.0.0.1');
  const [scanPorts, setScanPorts] = useState('1-1000');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<PortScanResult[]>([]);
  const [scanProgress, setScanProgress] = useState(0);

  // Network topology
  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Filters
  const [connectionFilter, setConnectionFilter] = useState('');
  const [connectionProtocol, setConnectionProtocol] = useState<'all' | 'tcp' | 'udp'>('all');
  const [connectionState, setConnectionState] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'local' | 'remote' | 'state'>('state');

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('network.interfaces', (data: NetworkInterface[]) => {
      setInterfaces(data);
    });

    socket.on('network.connections', (data: Connection[]) => {
      setConnections(data);
    });

    socket.on('network.bandwidth', (data: BandwidthData) => {
      setBandwidthHistory(prev => {
        const updated = [...prev, data];
        return updated.slice(-1000);
      });
    });

    socket.on('network.scan.progress', (progress: number) => {
      setScanProgress(progress);
    });

    socket.on('network.scan.result', (result: PortScanResult) => {
      setScanResults(prev => [...prev, result].sort((a, b) => a.port - b.port));
    });

    socket.on('network.scan.complete', () => {
      setIsScanning(false);
      push({ title: 'Port scan complete', variant: 'success' });
    });

    socket.on('network.discovery', (nodes: NetworkNode[]) => {
      setNetworkNodes(nodes);
      setIsDiscovering(false);
    });

    socket.on('network.error', (error: string) => {
      push({ title: 'Network Error', description: error, variant: 'destructive' });
      setIsScanning(false);
      setIsDiscovering(false);
    });

    return () => {
      socket.off('network.interfaces');
      socket.off('network.connections');
      socket.off('network.bandwidth');
      socket.off('network.scan.progress');
      socket.off('network.scan.result');
      socket.off('network.scan.complete');
      socket.off('network.discovery');
      socket.off('network.error');
    };
  }, [socket, push]);

  const startMonitoring = () => {
    if (!socket || status !== 'connected') {
      push({ title: 'Not connected', description: 'Please connect via SSH first', variant: 'destructive' });
      return;
    }
    socket.emit('network.start', { interval: refreshInterval * 1000 });
    setIsMonitoring(true);
    push({ title: 'Network monitoring started', variant: 'success' });
  };

  const stopMonitoring = () => {
    if (!socket) return;
    socket.emit('network.stop');
    setIsMonitoring(false);
    push({ title: 'Network monitoring stopped' });
  };

  const refreshNow = () => {
    if (!socket || status !== 'connected') return;
    socket.emit('network.refresh');
  };

  const startPortScan = () => {
    if (!socket || status !== 'connected') {
      push({ title: 'Not connected', description: 'Please connect via SSH first', variant: 'destructive' });
      return;
    }
    setScanResults([]);
    setScanProgress(0);
    setIsScanning(true);
    socket.emit('network.scan', { target: scanTarget, ports: scanPorts });
    push({ title: 'Port scan started', description: `Scanning ${scanTarget}` });
  };

  const stopPortScan = () => {
    if (!socket) return;
    socket.emit('network.scan.stop');
    setIsScanning(false);
  };

  const discoverNetwork = () => {
    if (!socket || status !== 'connected') {
      push({ title: 'Not connected', description: 'Please connect via SSH first', variant: 'destructive' });
      return;
    }
    setIsDiscovering(true);
    socket.emit('network.discover');
    push({ title: 'Network discovery started' });
  };

  // Filter connections
  const filteredConnections = connections.filter(conn => {
    if (connectionProtocol !== 'all' && conn.protocol.toLowerCase() !== connectionProtocol) return false;
    if (connectionState !== 'all' && conn.state !== connectionState) return false;
    if (connectionFilter) {
      const filter = connectionFilter.toLowerCase();
      return (
        conn.localAddress.includes(filter) ||
        conn.remoteAddress.includes(filter) ||
        conn.process.toLowerCase().includes(filter) ||
        conn.localPort.toString().includes(filter) ||
        conn.remotePort.toString().includes(filter)
      );
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'local') return a.localPort - b.localPort;
    if (sortBy === 'remote') return a.remotePort - b.remotePort;
    return a.state.localeCompare(b.state);
  });

  // Get unique states for filter
  const uniqueStates = [...new Set(connections.map(c => c.state))];

  // Get node icon
  const getNodeIcon = (type: NetworkNode['type']) => {
    switch (type) {
      case 'server': return Server;
      case 'router': return Router;
      case 'database': return Database;
      case 'client': return Laptop;
      default: return Globe;
    }
  };

  // Bandwidth chart component
  const BandwidthChart = ({ ifaceName }: { ifaceName: string }) => {
    const data = bandwidthHistory.filter(d => d.interface === ifaceName).slice(-60);
    if (data.length < 2) return null;

    const maxRx = Math.max(...data.map(d => d.rxBytesPerSec), 1);
    const maxTx = Math.max(...data.map(d => d.txBytesPerSec), 1);
    const max = Math.max(maxRx, maxTx);

    const rxPoints = data.map((d, i) => 
      `${(i / (data.length - 1)) * 100},${100 - (d.rxBytesPerSec / max) * 100}`
    ).join(' ');
    const txPoints = data.map((d, i) => 
      `${(i / (data.length - 1)) * 100},${100 - (d.txBytesPerSec / max) * 100}`
    ).join(' ');

    return (
      <svg viewBox="0 0 100 100" className="w-full h-16" preserveAspectRatio="none">
        <polyline points={rxPoints} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <polyline points={txPoints} fill="none" stroke="hsl(142 76% 36%)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Network Monitor</h2>
          <p className="text-sm text-muted-foreground">Bandwidth, connections, and port scanning</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={refreshInterval.toString()} onValueChange={(v) => setRefreshInterval(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 second</SelectItem>
              <SelectItem value="2">2 seconds</SelectItem>
              <SelectItem value="5">5 seconds</SelectItem>
              <SelectItem value="10">10 seconds</SelectItem>
            </SelectContent>
          </Select>
          {isMonitoring ? (
            <Button variant="outline" onClick={stopMonitoring} className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
              <Pause className="h-4 w-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button onClick={startMonitoring} disabled={status !== 'connected'}>
              <Play className="h-4 w-4 mr-2" />
              Start Monitoring
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={refreshNow} disabled={status !== 'connected'}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {status !== 'connected' && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <p className="text-sm">Connect to a server via SSH to start network monitoring</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="interfaces" className="w-full">
        <TabsList>
          <TabsTrigger value="interfaces">
            <Wifi className="h-4 w-4 mr-2" />
            Interfaces
          </TabsTrigger>
          <TabsTrigger value="connections">
            <Activity className="h-4 w-4 mr-2" />
            Connections
            <Badge variant="secondary" className="ml-2">{connections.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="scanner">
            <Search className="h-4 w-4 mr-2" />
            Port Scanner
          </TabsTrigger>
          <TabsTrigger value="topology">
            <Network className="h-4 w-4 mr-2" />
            Topology
          </TabsTrigger>
        </TabsList>

        <TabsContent value="interfaces" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interfaces.map((iface) => (
              <Card key={iface.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Wifi className={`h-5 w-5 ${iface.state === 'up' ? 'text-green-500' : 'text-gray-500'}`} />
                      {iface.name}
                    </span>
                    <Badge variant={iface.state === 'up' ? 'default' : 'secondary'}>
                      {iface.state}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {iface.ipv4 || 'No IPv4'} | MAC: {iface.mac || 'N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <ArrowDown className="h-3 w-3 text-primary" />
                        Download
                      </div>
                      <p className="font-medium">{formatBytes(iface.rxBytes)}</p>
                      <p className="text-xs text-muted-foreground">{iface.rxPackets} packets</p>
                      {iface.rxErrors > 0 && (
                        <p className="text-xs text-red-500">{iface.rxErrors} errors</p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <ArrowUp className="h-3 w-3 text-green-500" />
                        Upload
                      </div>
                      <p className="font-medium">{formatBytes(iface.txBytes)}</p>
                      <p className="text-xs text-muted-foreground">{iface.txPackets} packets</p>
                      {iface.txErrors > 0 && (
                        <p className="text-xs text-red-500">{iface.txErrors} errors</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary" /> RX
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" /> TX
                      </span>
                    </div>
                    <BandwidthChart ifaceName={iface.name} />
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>MTU: {iface.mtu}</span>
                    {iface.speed > 0 && <span>Speed: {iface.speed} Mbps</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {interfaces.length === 0 && (
              <Card className="col-span-2">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Wifi className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No network interfaces found</p>
                  <p className="text-xs text-muted-foreground">Start monitoring to see network data</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Connections</CardTitle>
              <CardDescription>TCP and UDP connections</CardDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter by IP, port, or process..."
                    value={connectionFilter}
                    onChange={(e) => setConnectionFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={connectionProtocol} onValueChange={(v) => setConnectionProtocol(v as 'all' | 'tcp' | 'udp')}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={connectionState} onValueChange={setConnectionState}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {uniqueStates.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'local' | 'remote' | 'state')}>
                  <SelectTrigger className="w-[140px]">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local Port</SelectItem>
                    <SelectItem value="remote">Remote Port</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Protocol</th>
                      <th className="text-left py-2 px-2">Local</th>
                      <th className="text-left py-2 px-2">Remote</th>
                      <th className="text-left py-2 px-2">State</th>
                      <th className="text-left py-2 px-2">Process</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConnections.map((conn) => {
                      const stateInfo = connectionStates[conn.state] || { color: 'text-gray-500', label: conn.state };
                      return (
                        <tr key={conn.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2">
                            <Badge variant="outline">{conn.protocol}</Badge>
                          </td>
                          <td className="py-2 px-2 font-mono text-xs">
                            {conn.localAddress}:{conn.localPort}
                          </td>
                          <td className="py-2 px-2 font-mono text-xs">
                            {conn.remoteAddress}:{conn.remotePort}
                          </td>
                          <td className={`py-2 px-2 ${stateInfo.color}`}>
                            {stateInfo.label}
                          </td>
                          <td className="py-2 px-2 max-w-[200px] truncate">
                            <span className="text-muted-foreground text-xs">[{conn.pid}]</span>{' '}
                            {conn.process}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredConnections.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No connections found</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scanner" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Port Scanner
                </CardTitle>
                <CardDescription>Scan ports on a target host</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Target IP / Hostname</Label>
                  <Input
                    value={scanTarget}
                    onChange={(e) => setScanTarget(e.target.value)}
                    placeholder="127.0.0.1 or hostname"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port Range</Label>
                  <Input
                    value={scanPorts}
                    onChange={(e) => setScanPorts(e.target.value)}
                    placeholder="1-1000 or 22,80,443"
                  />
                  <p className="text-xs text-muted-foreground">
                    Examples: 1-1000, 22,80,443, 1-100,443,8080
                  </p>
                </div>

                {isScanning ? (
                  <>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                    <Button variant="outline" onClick={stopPortScan} className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                      <Pause className="h-4 w-4 mr-2" />
                      Stop Scan
                    </Button>
                  </>
                ) : (
                  <Button onClick={startPortScan} disabled={status !== 'connected'} className="w-full">
                    <Zap className="h-4 w-4 mr-2" />
                    Start Scan
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Scan Results</CardTitle>
                <CardDescription>
                  {scanResults.length} ports found ({scanResults.filter(r => r.state === 'open').length} open)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        <th className="text-left py-2 px-2">Port</th>
                        <th className="text-left py-2 px-2">State</th>
                        <th className="text-left py-2 px-2">Service</th>
                        <th className="text-left py-2 px-2">Version</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanResults.filter(r => r.state === 'open').map((result) => (
                        <tr key={result.port} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-mono">{result.port}</td>
                          <td className="py-2 px-2">
                            <Badge variant="default" className="bg-green-500">
                              {result.state}
                            </Badge>
                          </td>
                          <td className="py-2 px-2">
                            {result.service || commonPorts[result.port] || 'Unknown'}
                          </td>
                          <td className="py-2 px-2 text-muted-foreground">
                            {result.version || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {scanResults.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Search className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No scan results yet</p>
                      <p className="text-xs text-muted-foreground">Start a scan to see open ports</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="topology" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Network Topology
                  </CardTitle>
                  <CardDescription>Discovered devices on the network</CardDescription>
                </div>
                <Button onClick={discoverNetwork} disabled={status !== 'connected' || isDiscovering}>
                  {isDiscovering ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Discovering...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Discover Network
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {networkNodes.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {networkNodes.map((node) => {
                    const Icon = getNodeIcon(node.type);
                    return (
                      <Card key={node.id} className={`${node.status === 'online' ? 'border-green-500/30' : 'border-gray-500/30'}`}>
                        <CardContent className="flex flex-col items-center py-4">
                          <div className={`relative p-3 rounded-full ${node.status === 'online' ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
                            <Icon className={`h-8 w-8 ${node.status === 'online' ? 'text-green-500' : 'text-gray-500'}`} />
                            <div className={`absolute top-0 right-0 w-3 h-3 rounded-full ${node.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`} />
                          </div>
                          <p className="font-medium mt-2 text-center text-sm">
                            {node.hostname || node.ip}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">{node.ip}</p>
                          {node.mac && (
                            <p className="font-mono text-xs text-muted-foreground">{node.mac}</p>
                          )}
                          <Badge variant="outline" className="mt-2 capitalize">
                            {node.type}
                          </Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Network className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No network devices discovered</p>
                  <p className="text-xs text-muted-foreground">Click &quot;Discover Network&quot; to scan for devices</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

