"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Activity,
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
  Trash2,
  Clock,
  Zap,
} from "lucide-react";
import { useSocket } from '@/contexts/socket-context';
import { useToast } from '@/components/ui/use-toast';

type SystemMetrics = {
  cpu: {
    usage: number;
    cores: number;
    model: string;
    loadAvg: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    cached: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    partitions: Array<{
      mount: string;
      size: number;
      used: number;
      percentage: number;
    }>;
  };
  network: {
    interfaces: Array<{
      name: string;
      rxBytes: number;
      txBytes: number;
      rxPackets: number;
      txPackets: number;
    }>;
  };
  uptime: number;
  timestamp: number;
};

type ProcessInfo = {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  stat: string;
  start: string;
  time: string;
  command: string;
};

type Alert = {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'network';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
};

type HistoricalData = {
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
  networkRx: number;
  networkTx: number;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
};

const getUsageColor = (percentage: number) => {
  if (percentage >= 90) return 'text-red-500';
  if (percentage >= 70) return 'text-yellow-500';
  return 'text-green-500';
};

const getUsageBg = (percentage: number) => {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
};

export default function MonitoringPage() {
  const { socket, status } = useSocket();
  const { push } = useToast();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [processFilter, setProcessFilter] = useState('');
  const [processSortBy, setProcessSortBy] = useState<'cpu' | 'mem' | 'pid'>('cpu');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('1h');

  // Alert thresholds
  const [cpuWarning, setCpuWarning] = useState(70);
  const [cpuCritical, setCpuCritical] = useState(90);
  const [memWarning, setMemWarning] = useState(70);
  const [memCritical, setMemCritical] = useState(90);
  const [diskWarning, setDiskWarning] = useState(80);
  const [diskCritical, setDiskCritical] = useState(95);

  const checkAlerts = useCallback((data: SystemMetrics) => {
    const newAlerts: Alert[] = [];
    const now = new Date();

    // CPU alerts
    if (data.cpu.usage >= cpuCritical) {
      newAlerts.push({
        id: `cpu-critical-${now.getTime()}`,
        type: 'cpu',
        severity: 'critical',
        message: `CPU usage critical: ${data.cpu.usage.toFixed(1)}%`,
        timestamp: now,
      });
    } else if (data.cpu.usage >= cpuWarning) {
      newAlerts.push({
        id: `cpu-warning-${now.getTime()}`,
        type: 'cpu',
        severity: 'warning',
        message: `CPU usage high: ${data.cpu.usage.toFixed(1)}%`,
        timestamp: now,
      });
    }

    // Memory alerts
    if (data.memory.percentage >= memCritical) {
      newAlerts.push({
        id: `mem-critical-${now.getTime()}`,
        type: 'memory',
        severity: 'critical',
        message: `Memory usage critical: ${data.memory.percentage.toFixed(1)}%`,
        timestamp: now,
      });
    } else if (data.memory.percentage >= memWarning) {
      newAlerts.push({
        id: `mem-warning-${now.getTime()}`,
        type: 'memory',
        severity: 'warning',
        message: `Memory usage high: ${data.memory.percentage.toFixed(1)}%`,
        timestamp: now,
      });
    }

    // Disk alerts
    if (data.disk.percentage >= diskCritical) {
      newAlerts.push({
        id: `disk-critical-${now.getTime()}`,
        type: 'disk',
        severity: 'critical',
        message: `Disk usage critical: ${data.disk.percentage.toFixed(1)}%`,
        timestamp: now,
      });
    } else if (data.disk.percentage >= diskWarning) {
      newAlerts.push({
        id: `disk-warning-${now.getTime()}`,
        type: 'disk',
        severity: 'warning',
        message: `Disk usage high: ${data.disk.percentage.toFixed(1)}%`,
        timestamp: now,
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
    }
  }, [cpuCritical, cpuWarning, memCritical, memWarning, diskCritical, diskWarning]);

  useEffect(() => {
    if (!socket) return;

    socket.on('monitoring.metrics', (data: SystemMetrics) => {
      setMetrics(data);
      checkAlerts(data);
      
      // Add to historical data
      setHistoricalData(prev => {
        const newEntry: HistoricalData = {
          timestamp: data.timestamp,
          cpu: data.cpu.usage,
          memory: data.memory.percentage,
          disk: data.disk.percentage,
          networkRx: data.network.interfaces.reduce((acc, i) => acc + i.rxBytes, 0),
          networkTx: data.network.interfaces.reduce((acc, i) => acc + i.txBytes, 0),
        };
        const updated = [...prev, newEntry];
        // Keep last 1000 data points
        return updated.slice(-1000);
      });
    });

    socket.on('monitoring.processes', (data: ProcessInfo[]) => {
      setProcesses(data);
    });

    return () => {
      socket.off('monitoring.metrics');
      socket.off('monitoring.processes');
    };
  }, [socket, checkAlerts]);

  const startMonitoring = () => {
    if (!socket || status !== 'connected') {
      push({ title: 'Not connected', description: 'Please connect via SSH first', variant: 'destructive' });
      return;
    }
    socket.emit('monitoring.start', { interval: refreshInterval * 1000 });
    setIsMonitoring(true);
    push({ title: 'Monitoring started', variant: 'success' });
  };

  const stopMonitoring = () => {
    if (!socket) return;
    socket.emit('monitoring.stop');
    setIsMonitoring(false);
    push({ title: 'Monitoring stopped' });
  };

  const refreshNow = () => {
    if (!socket || status !== 'connected') return;
    socket.emit('monitoring.refresh');
  };

  const killProcess = (pid: number) => {
    if (!socket || status !== 'connected') return;
    socket.emit('monitoring.kill', { pid, signal: 'SIGTERM' });
    push({ title: 'Kill signal sent', description: `Sending SIGTERM to PID ${pid}` });
  };

  const sortedProcesses = [...processes]
    .filter(p => processFilter === '' || p.command.toLowerCase().includes(processFilter.toLowerCase()) || p.user.toLowerCase().includes(processFilter.toLowerCase()))
    .sort((a, b) => {
      if (processSortBy === 'cpu') return b.cpu - a.cpu;
      if (processSortBy === 'mem') return b.mem - a.mem;
      return b.pid - a.pid;
    })
    .slice(0, 50);

  const ProgressBar = ({ value, className }: { value: number; className?: string }) => (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all duration-300 ${getUsageBg(value)} ${className}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );

  const MiniChart = ({ data, dataKey, color }: { data: HistoricalData[]; dataKey: keyof HistoricalData; color: string }) => {
    const values = data.slice(-60).map(d => d[dataKey] as number);
    const max = Math.max(...values, 1);
    const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ');
    
    return (
      <svg viewBox="0 0 100 100" className="w-full h-16" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">System Monitor</h2>
          <p className="text-sm text-muted-foreground">Real-time system resource monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={refreshInterval.toString()} onValueChange={(v) => setRefreshInterval(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 seconds</SelectItem>
              <SelectItem value="10">10 seconds</SelectItem>
              <SelectItem value="15">15 seconds</SelectItem>
              <SelectItem value="30">30 seconds</SelectItem>
              <SelectItem value="60">1 minute</SelectItem>
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
            <p className="text-sm">Connect to a server via SSH to start monitoring</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="processes">Processes</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* System Info */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Uptime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatUptime(metrics.uptime)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    CPU Cores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{metrics.cpu.cores}</p>
                  <p className="text-xs text-muted-foreground truncate">{metrics.cpu.model}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Load Average
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{metrics.cpu.loadAvg[0].toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {metrics.cpu.loadAvg.map(l => l.toFixed(2)).join(' / ')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Processes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{processes.length}</p>
                  <p className="text-xs text-muted-foreground">Running processes</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Resource Usage Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CPU */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" />
                    CPU Usage
                  </span>
                  {metrics && (
                    <span className={`text-2xl font-bold ${getUsageColor(metrics.cpu.usage)}`}>
                      {metrics.cpu.usage.toFixed(1)}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metrics && <ProgressBar value={metrics.cpu.usage} />}
                {historicalData.length > 0 && (
                  <MiniChart data={historicalData} dataKey="cpu" color="hsl(var(--primary))" />
                )}
              </CardContent>
            </Card>

            {/* Memory */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <MemoryStick className="h-5 w-5 text-primary" />
                    Memory Usage
                  </span>
                  {metrics && (
                    <span className={`text-2xl font-bold ${getUsageColor(metrics.memory.percentage)}`}>
                      {metrics.memory.percentage.toFixed(1)}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metrics && (
                  <>
                    <ProgressBar value={metrics.memory.percentage} />
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Used</p>
                        <p className="font-medium">{formatBytes(metrics.memory.used)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Free</p>
                        <p className="font-medium">{formatBytes(metrics.memory.free)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium">{formatBytes(metrics.memory.total)}</p>
                      </div>
                    </div>
                  </>
                )}
                {historicalData.length > 0 && (
                  <MiniChart data={historicalData} dataKey="memory" color="hsl(var(--primary))" />
                )}
              </CardContent>
            </Card>

            {/* Disk */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-primary" />
                    Disk Usage
                  </span>
                  {metrics && (
                    <span className={`text-2xl font-bold ${getUsageColor(metrics.disk.percentage)}`}>
                      {metrics.disk.percentage.toFixed(1)}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metrics && (
                  <>
                    <ProgressBar value={metrics.disk.percentage} />
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Used</p>
                        <p className="font-medium">{formatBytes(metrics.disk.used)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Free</p>
                        <p className="font-medium">{formatBytes(metrics.disk.free)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium">{formatBytes(metrics.disk.total)}</p>
                      </div>
                    </div>
                    {metrics.disk.partitions.length > 0 && (
                      <ScrollArea className="h-32">
                        <div className="space-y-2">
                          {metrics.disk.partitions.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="font-mono text-xs">{p.mount}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-24">
                                  <ProgressBar value={p.percentage} />
                                </div>
                                <span className={`${getUsageColor(p.percentage)} w-12 text-right`}>
                                  {p.percentage}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Network */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-primary" />
                  Network
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics && metrics.network.interfaces.length > 0 ? (
                  <ScrollArea className="h-48">
                    <div className="space-y-4">
                      {metrics.network.interfaces.map((iface, i) => (
                        <div key={i} className="border-b pb-3 last:border-0">
                          <p className="font-medium mb-2">{iface.name}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">↓ RX</p>
                              <p className="font-medium">{formatBytes(iface.rxBytes)}</p>
                              <p className="text-xs text-muted-foreground">{iface.rxPackets} packets</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">↑ TX</p>
                              <p className="font-medium">{formatBytes(iface.txBytes)}</p>
                              <p className="text-xs text-muted-foreground">{iface.txPackets} packets</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-sm">No network data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="processes" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Process Monitor</CardTitle>
              <CardDescription>View and manage running processes</CardDescription>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Filter processes..."
                  value={processFilter}
                  onChange={(e) => setProcessFilter(e.target.value)}
                  className="max-w-xs"
                />
                <Select value={processSortBy} onValueChange={(v) => setProcessSortBy(v as 'cpu' | 'mem' | 'pid')}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpu">Sort by CPU</SelectItem>
                    <SelectItem value="mem">Sort by Memory</SelectItem>
                    <SelectItem value="pid">Sort by PID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left py-2 px-2">PID</th>
                      <th className="text-left py-2 px-2">User</th>
                      <th className="text-right py-2 px-2">CPU %</th>
                      <th className="text-right py-2 px-2">MEM %</th>
                      <th className="text-right py-2 px-2">RSS</th>
                      <th className="text-left py-2 px-2">Command</th>
                      <th className="text-right py-2 px-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProcesses.map((proc) => (
                      <tr key={proc.pid} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2 font-mono">{proc.pid}</td>
                        <td className="py-2 px-2">{proc.user}</td>
                        <td className={`py-2 px-2 text-right ${getUsageColor(proc.cpu)}`}>
                          {proc.cpu.toFixed(1)}%
                        </td>
                        <td className={`py-2 px-2 text-right ${getUsageColor(proc.mem)}`}>
                          {proc.mem.toFixed(1)}%
                        </td>
                        <td className="py-2 px-2 text-right">{formatBytes(proc.rss * 1024)}</td>
                        <td className="py-2 px-2 max-w-xs truncate font-mono text-xs">
                          {proc.command}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => killProcess(proc.pid)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedProcesses.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    {processes.length === 0 ? 'Start monitoring to see processes' : 'No matching processes'}
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Alerts</CardTitle>
                  <CardDescription>System alerts based on configured thresholds</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setAlerts([])}>
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {alerts.length > 0 ? (
                  <div className="space-y-2">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`flex items-start gap-3 p-3 rounded-lg ${
                          alert.severity === 'critical' ? 'bg-red-500/10 border border-red-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'
                        }`}
                      >
                        <AlertTriangle className={`h-5 w-5 mt-0.5 ${alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {alert.type.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {alert.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{alert.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No alerts</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Thresholds</CardTitle>
              <CardDescription>Configure when to trigger alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Cpu className="h-4 w-4" /> CPU
                  </h4>
                  <div className="space-y-2">
                    <Label>Warning Threshold (%)</Label>
                    <Input
                      type="number"
                      value={cpuWarning}
                      onChange={(e) => setCpuWarning(Number(e.target.value))}
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Critical Threshold (%)</Label>
                    <Input
                      type="number"
                      value={cpuCritical}
                      onChange={(e) => setCpuCritical(Number(e.target.value))}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <MemoryStick className="h-4 w-4" /> Memory
                  </h4>
                  <div className="space-y-2">
                    <Label>Warning Threshold (%)</Label>
                    <Input
                      type="number"
                      value={memWarning}
                      onChange={(e) => setMemWarning(Number(e.target.value))}
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Critical Threshold (%)</Label>
                    <Input
                      type="number"
                      value={memCritical}
                      onChange={(e) => setMemCritical(Number(e.target.value))}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <HardDrive className="h-4 w-4" /> Disk
                  </h4>
                  <div className="space-y-2">
                    <Label>Warning Threshold (%)</Label>
                    <Input
                      type="number"
                      value={diskWarning}
                      onChange={(e) => setDiskWarning(Number(e.target.value))}
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Critical Threshold (%)</Label>
                    <Input
                      type="number"
                      value={diskCritical}
                      onChange={(e) => setDiskCritical(Number(e.target.value))}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historical Data</CardTitle>
              <CardDescription>Configure data retention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label>Time Range</Label>
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as '1h' | '24h' | '7d' | '30d')}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Last 1 hour</SelectItem>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

