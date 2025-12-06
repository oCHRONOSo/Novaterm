"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Search,
  Play,
  Pause,
  Trash2,
  Download,
  Filter,
  AlertTriangle,
  AlertCircle,
  Info,
  Bug,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useSocket } from '@/contexts/socket-context';
import { useToast } from '@/components/ui/use-toast';

type LogEntry = {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  raw: string;
};

type LogSource = {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
};

type ErrorPattern = {
  pattern: string;
  count: number;
  lastSeen: Date;
  examples: string[];
};

const defaultLogSources: LogSource[] = [
  // Journald (modern systemd systems) - these use special "journald:" prefix
  { id: 'journald-system', name: '📋 System Journal (journald)', path: 'journald:system', enabled: false },
  { id: 'journald-kernel', name: '📋 Kernel (journald)', path: 'journald:kernel', enabled: false },
  { id: 'journald-auth', name: '📋 Auth (journald)', path: 'journald:auth', enabled: false },
  { id: 'journald-nginx', name: '📋 Nginx (journald)', path: 'journald:nginx', enabled: false },
  { id: 'journald-apache', name: '📋 Apache (journald)', path: 'journald:apache', enabled: false },
  // Traditional log files (older systems)
  { id: 'syslog', name: 'Syslog (legacy)', path: '/var/log/syslog', enabled: false },
  { id: 'messages', name: 'Messages (legacy)', path: '/var/log/messages', enabled: false },
  { id: 'auth', name: 'Auth Log (legacy)', path: '/var/log/auth.log', enabled: false },
  { id: 'nginx-access', name: 'Nginx Access', path: '/var/log/nginx/access.log', enabled: false },
  { id: 'nginx-error', name: 'Nginx Error', path: '/var/log/nginx/error.log', enabled: false },
  { id: 'apache-access', name: 'Apache Access', path: '/var/log/apache2/access.log', enabled: false },
  { id: 'apache-error', name: 'Apache Error', path: '/var/log/apache2/error.log', enabled: false },
  { id: 'dmesg', name: 'Kernel dmesg', path: '/var/log/dmesg', enabled: false },
];

const levelColors = {
  debug: 'text-gray-500',
  info: 'text-blue-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  critical: 'text-red-700 font-bold',
};

const levelBadgeVariant = {
  debug: 'secondary',
  info: 'default',
  warning: 'secondary',
  error: 'destructive',
  critical: 'destructive',
} as const;

const levelIcons = {
  debug: Bug,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  critical: AlertCircle,
};

const parseLogLevel = (message: string): 'debug' | 'info' | 'warning' | 'error' | 'critical' => {
  const lower = message.toLowerCase();
  if (lower.includes('critical') || lower.includes('fatal') || lower.includes('emergency')) return 'critical';
  if (lower.includes('error') || lower.includes('fail') || lower.includes('exception')) return 'error';
  if (lower.includes('warn')) return 'warning';
  if (lower.includes('debug')) return 'debug';
  return 'info';
};

export default function LogViewerPage() {
  const { socket, status } = useSocket();
  const { push } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [regexEnabled, setRegexEnabled] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(['debug', 'info', 'warning', 'error', 'critical']));
  const [logSources, setLogSources] = useState<LogSource[]>(defaultLogSources);
  const [customLogPath, setCustomLogPath] = useState('');
  const [errorPatterns, setErrorPatterns] = useState<ErrorPattern[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [linesCount, setLinesCount] = useState(100);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter logs when search or level filters change
  useEffect(() => {
    let filtered = logs;

    // Filter by level
    filtered = filtered.filter(log => selectedLevels.has(log.level));

    // Filter by search query
    if (searchQuery) {
      if (regexEnabled) {
        try {
          const regex = new RegExp(searchQuery, 'i');
          filtered = filtered.filter(log => regex.test(log.message) || regex.test(log.raw));
        } catch {
          // Invalid regex, fall back to simple search
          filtered = filtered.filter(log => 
            log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.raw.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
      } else {
        filtered = filtered.filter(log => 
          log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.raw.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
    }

    setFilteredLogs(filtered);
  }, [logs, searchQuery, regexEnabled, selectedLevels]);

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Analyze error patterns
  const analyzePatterns = useCallback(() => {
    const patterns: Map<string, { count: number; lastSeen: Date; examples: string[] }> = new Map();
    
    logs
      .filter(log => log.level === 'error' || log.level === 'critical')
      .forEach(log => {
        // Extract common error patterns
        const simplified = log.message
          .replace(/\d+/g, 'N')
          .replace(/0x[a-f0-9]+/gi, 'HEX')
          .replace(/[a-f0-9]{32,}/gi, 'HASH')
          .slice(0, 100);
        
        const existing = patterns.get(simplified);
        if (existing) {
          existing.count++;
          existing.lastSeen = log.timestamp;
          if (existing.examples.length < 3) {
            existing.examples.push(log.raw);
          }
        } else {
          patterns.set(simplified, {
            count: 1,
            lastSeen: log.timestamp,
            examples: [log.raw],
          });
        }
      });

    const sorted = Array.from(patterns.entries())
      .map(([pattern, data]) => ({ pattern, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    setErrorPatterns(sorted);
  }, [logs]);

  useEffect(() => {
    analyzePatterns();
  }, [logs, analyzePatterns]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('logs.entry', (entry: { source: string; line: string; timestamp: number }) => {
      const newEntry: LogEntry = {
        id: `${entry.timestamp}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date(entry.timestamp),
        level: parseLogLevel(entry.line),
        source: entry.source,
        message: entry.line.slice(0, 200),
        raw: entry.line,
      };

      setLogs(prev => {
        const updated = [...prev, newEntry];
        return updated.slice(-5000); // Keep last 5000 entries
      });
    });

    socket.on('logs.batch', (entries: Array<{ source: string; line: string; timestamp: number }>) => {
      const newEntries = entries.map(entry => ({
        id: `${entry.timestamp}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date(entry.timestamp),
        level: parseLogLevel(entry.line),
        source: entry.source,
        message: entry.line.slice(0, 200),
        raw: entry.line,
      }));

      setLogs(prev => {
        const updated = [...prev, ...newEntries];
        return updated.slice(-5000);
      });
    });

    socket.on('logs.error', (error: string) => {
      push({ title: 'Log Error', description: error, variant: 'destructive' });
    });

    return () => {
      socket.off('logs.entry');
      socket.off('logs.batch');
      socket.off('logs.error');
    };
  }, [socket, push]);

  const startStreaming = () => {
    if (!socket || status !== 'connected') {
      push({ title: 'Not connected', description: 'Please connect via SSH first', variant: 'destructive' });
      return;
    }

    const enabledSources = logSources.filter(s => s.enabled).map(s => s.path);
    if (enabledSources.length === 0) {
      push({ title: 'No sources selected', description: 'Enable at least one log source', variant: 'destructive' });
      return;
    }

    socket.emit('logs.start', { sources: enabledSources, lines: linesCount });
    setIsStreaming(true);
    push({ title: 'Log streaming started', variant: 'success' });
  };

  const stopStreaming = () => {
    if (!socket) return;
    socket.emit('logs.stop');
    setIsStreaming(false);
    push({ title: 'Log streaming stopped' });
  };

  const fetchLogs = () => {
    if (!socket || status !== 'connected') return;
    const enabledSources = logSources.filter(s => s.enabled).map(s => s.path);
    socket.emit('logs.fetch', { sources: enabledSources, lines: linesCount });
  };

  const clearLogs = () => {
    setLogs([]);
    setFilteredLogs([]);
  };

  const downloadLogs = () => {
    const content = filteredLogs.map(log => `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] [${log.source}] ${log.raw}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSource = (sourceId: string) => {
    setLogSources(prev => prev.map(s => 
      s.id === sourceId ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const addCustomSource = () => {
    if (!customLogPath) return;
    const id = `custom-${Date.now()}`;
    setLogSources(prev => [...prev, {
      id,
      name: customLogPath.split('/').pop() || 'Custom Log',
      path: customLogPath,
      enabled: true,
    }]);
    setCustomLogPath('');
  };

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Log Viewer</h2>
          <p className="text-sm text-muted-foreground">Real-time log streaming and analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={linesCount.toString()} onValueChange={(v) => setLinesCount(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 lines</SelectItem>
              <SelectItem value="100">100 lines</SelectItem>
              <SelectItem value="500">500 lines</SelectItem>
              <SelectItem value="1000">1000 lines</SelectItem>
            </SelectContent>
          </Select>
          {isStreaming ? (
            <Button variant="outline" onClick={stopStreaming} className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
              <Pause className="h-4 w-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button onClick={startStreaming} disabled={status !== 'connected'}>
              <Play className="h-4 w-4 mr-2" />
              Start Streaming
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={fetchLogs} disabled={status !== 'connected'}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {status !== 'connected' && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <p className="text-sm">Connect to a server via SSH to view logs</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar - Log Sources */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Log Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {logSources.map((source) => (
                  <div key={source.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={source.id}
                      checked={source.enabled}
                      onCheckedChange={() => toggleSource(source.id)}
                    />
                    <Label htmlFor={source.id} className="text-sm cursor-pointer flex-1">
                      {source.name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t pt-4 space-y-2">
              <Label className="text-xs text-muted-foreground">Add Custom Log</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="/var/log/custom.log"
                  value={customLogPath}
                  onChange={(e) => setCustomLogPath(e.target.value)}
                  className="text-xs"
                />
                <Button size="sm" onClick={addCustomSource}>Add</Button>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label className="text-xs text-muted-foreground">Filter by Level</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(levelColors).map(([level, color]) => {
                  const Icon = levelIcons[level as keyof typeof levelIcons];
                  return (
                    <Button
                      key={level}
                      variant={selectedLevels.has(level) ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => toggleLevel(level)}
                    >
                      <Icon className={`h-3 w-3 mr-1 ${color}`} />
                      <span className="text-xs capitalize">{level}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content - Logs */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search and Actions */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="regex"
                    checked={regexEnabled}
                    onCheckedChange={(checked) => setRegexEnabled(checked === true)}
                  />
                  <Label htmlFor="regex" className="text-sm">Regex</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="autoscroll"
                    checked={autoScroll}
                    onCheckedChange={(checked) => setAutoScroll(checked === true)}
                  />
                  <Label htmlFor="autoscroll" className="text-sm">Auto-scroll</Label>
                </div>
                <Button variant="outline" size="icon" onClick={clearLogs}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={downloadLogs}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="stream" className="w-full">
            <TabsList>
              <TabsTrigger value="stream">
                <FileText className="h-4 w-4 mr-2" />
                Log Stream
                <Badge variant="secondary" className="ml-2">{filteredLogs.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="patterns">
                <Filter className="h-4 w-4 mr-2" />
                Error Patterns
                <Badge variant="destructive" className="ml-2">{errorPatterns.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stream" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]" ref={scrollRef}>
                    <div className="font-mono text-xs">
                      {filteredLogs.map((log) => {
                        const Icon = levelIcons[log.level];
                        const isExpanded = expandedLog === log.id;
                        return (
                          <div
                            key={log.id}
                            className={`border-b last:border-0 hover:bg-muted/50 ${
                              log.level === 'error' || log.level === 'critical' ? 'bg-red-500/5' : ''
                            }`}
                          >
                            <div
                              className="flex items-start gap-2 p-2 cursor-pointer"
                              onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                            >
                              <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${levelColors[log.level]}`} />
                              <span className="text-muted-foreground flex-shrink-0 w-[140px]">
                                {log.timestamp.toLocaleTimeString()}
                              </span>
                              <Badge variant={levelBadgeVariant[log.level]} className="flex-shrink-0 h-5 text-[10px]">
                                {log.source.split('/').pop()}
                              </Badge>
                              <span className={`flex-1 break-all ${levelColors[log.level]}`}>
                                {log.message}
                              </span>
                              {log.raw.length > 200 && (
                                isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                            {isExpanded && log.raw.length > 200 && (
                              <div className="px-8 pb-2 text-muted-foreground whitespace-pre-wrap break-all">
                                {log.raw}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {filteredLogs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <FileText className="h-12 w-12 mb-4 opacity-50" />
                          <p>No logs to display</p>
                          <p className="text-xs mt-1">Start streaming or adjust filters</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="patterns" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Error Pattern Analysis</CardTitle>
                  <CardDescription>Common error patterns detected in logs</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    {errorPatterns.length > 0 ? (
                      <div className="space-y-4">
                        {errorPatterns.map((pattern, i) => (
                          <div key={i} className="border rounded-lg p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="destructive">{pattern.count} occurrences</Badge>
                              <span className="text-xs text-muted-foreground">
                                Last seen: {pattern.lastSeen.toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="font-mono text-sm text-muted-foreground">{pattern.pattern}</p>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Examples:</p>
                              {pattern.examples.map((ex, j) => (
                                <p key={j} className="font-mono text-xs bg-muted p-2 rounded break-all">
                                  {ex.slice(0, 200)}...
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
                        <p>No error patterns detected</p>
                        <p className="text-xs mt-1">Error patterns will appear as logs are collected</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

