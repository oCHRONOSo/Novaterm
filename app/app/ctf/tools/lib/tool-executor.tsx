"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Terminal,
  Download,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Square,
  ExternalLink,
  Info,
  Zap,
} from "lucide-react";
import { useSocket } from '@/contexts/socket-context';
import { useToast } from '@/components/ui/use-toast';
import { Tool, CommandPreset, ToolStatus, levelColors, levelLabels, ToolArg } from './types';

type ToolExecutorProps = {
  tool: Tool;
};

export function ToolExecutor({ tool }: ToolExecutorProps) {
  const { socket, status } = useSocket();
  const { push } = useToast();
  const [toolStatus, setToolStatus] = useState<ToolStatus>('unknown');
  const [selectedPreset, setSelectedPreset] = useState<CommandPreset | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [customCommand, setCustomCommand] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  // Check tool status
  const checkToolStatus = useCallback(() => {
    if (!socket || status !== 'connected') return;
    setToolStatus('checking');
    socket.emit('ctf.checkTool', { toolId: tool.id, checkCmd: tool.checkCmd });
  }, [socket, status, tool]);

  // Install tool
  const installTool = () => {
    if (!socket || status !== 'connected') {
      push({ title: 'Not connected', description: 'Connect via SSH first', variant: 'destructive' });
      return;
    }
    setToolStatus('installing');
    socket.emit('ctf.installTool', { toolId: tool.id, installCmd: tool.installCmd });
    push({ title: 'Installing', description: `Installing ${tool.name}...` });
  };

  // Build command from preset and args
  const buildCommand = useCallback(() => {
    if (useCustom) return customCommand;
    if (!selectedPreset) return '';

    let cmd = selectedPreset.command;
    for (const arg of selectedPreset.args) {
      const value = argValues[arg.name];
      if (value) {
        cmd = cmd.replace(`{${arg.name}}`, value);
      } else if (arg.default) {
        cmd = cmd.replace(`{${arg.name}}`, arg.default);
      } else {
        cmd = cmd.replace(`{${arg.name}}`, '');
      }
    }
    // Clean up any remaining placeholders and extra spaces
    cmd = cmd.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
    return cmd;
  }, [selectedPreset, argValues, useCustom, customCommand]);

  // Run command
  const runCommand = () => {
    if (!socket || status !== 'connected') return;
    
    const cmd = buildCommand();
    if (!cmd) {
      push({ title: 'No command', description: 'Build or enter a command first', variant: 'destructive' });
      return;
    }

    // Validate required args
    if (!useCustom && selectedPreset) {
      for (const arg of selectedPreset.args) {
        if (arg.required && !argValues[arg.name]) {
          push({ title: 'Missing argument', description: `${arg.name} is required`, variant: 'destructive' });
          return;
        }
      }
    }

    setIsRunning(true);
    setOutput('');
    socket.emit('ctf.runCommand', { command: cmd });
  };

  // Stop command
  const stopCommand = () => {
    if (!socket) return;
    socket.emit('ctf.stopCommand');
    setIsRunning(false);
  };

  // Copy command
  const copyCommand = () => {
    const cmd = buildCommand();
    if (cmd) {
      navigator.clipboard.writeText(cmd);
      push({ title: 'Copied', description: 'Command copied to clipboard' });
    }
  };

  // Socket handlers
  useEffect(() => {
    if (!socket) return;

    const handleToolStatus = ({ toolId, installed }: { toolId: string; installed: boolean }) => {
      if (toolId === tool.id) {
        setToolStatus(installed ? 'installed' : 'not_installed');
      }
    };

    const handleInstallComplete = ({ toolId, success }: { toolId: string; success: boolean }) => {
      if (toolId === tool.id) {
        setToolStatus(success ? 'installed' : 'not_installed');
        push({ 
          title: success ? 'Installed' : 'Install failed', 
          description: success ? `${tool.name} installed successfully` : 'Check terminal for errors',
          variant: success ? 'success' : 'destructive'
        });
      }
    };

    const handleCommandOutput = ({ output: out, done }: { output: string; done: boolean }) => {
      setOutput(prev => prev + out);
      if (done) setIsRunning(false);
    };

    socket.on('ctf.toolStatus', handleToolStatus);
    socket.on('ctf.installComplete', handleInstallComplete);
    socket.on('ctf.commandOutput', handleCommandOutput);

    return () => {
      socket.off('ctf.toolStatus', handleToolStatus);
      socket.off('ctf.installComplete', handleInstallComplete);
      socket.off('ctf.commandOutput', handleCommandOutput);
    };
  }, [socket, tool, push]);

  // Check status on mount
  useEffect(() => {
    if (status === 'connected') {
      checkToolStatus();
    }
  }, [status, checkToolStatus]);

  // Reset args when preset changes
  useEffect(() => {
    if (selectedPreset) {
      const defaults: Record<string, string> = {};
      selectedPreset.args.forEach(arg => {
        if (arg.default) defaults[arg.name] = arg.default;
      });
      setArgValues(defaults);
    }
  }, [selectedPreset]);

  const getStatusBadge = () => {
    switch (toolStatus) {
      case 'installed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> Installed</Badge>;
      case 'not_installed':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/30"><XCircle className="h-3 w-3 mr-1" /> Not Installed</Badge>;
      case 'checking':
      case 'installing':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {toolStatus === 'checking' ? 'Checking' : 'Installing'}</Badge>;
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><AlertTriangle className="h-3 w-3 mr-1" /> Unknown</Badge>;
    }
  };

  const renderArgInput = (arg: ToolArg) => {
    const commonClasses = "font-mono text-sm";
    
    switch (arg.type) {
      case 'select':
        return (
          <Select
            value={argValues[arg.name] || ''}
            onValueChange={(v) => setArgValues(prev => ({ ...prev, [arg.name]: v }))}
          >
            <SelectTrigger className={commonClasses}>
              <SelectValue placeholder={arg.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {arg.options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'textarea':
        return (
          <Textarea
            placeholder={arg.placeholder}
            value={argValues[arg.name] || ''}
            onChange={(e) => setArgValues(prev => ({ ...prev, [arg.name]: e.target.value }))}
            className={commonClasses}
            rows={3}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            placeholder={arg.placeholder}
            value={argValues[arg.name] || ''}
            onChange={(e) => setArgValues(prev => ({ ...prev, [arg.name]: e.target.value }))}
            className={commonClasses}
          />
        );
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={arg.name}
              checked={argValues[arg.name] === 'true'}
              onCheckedChange={(checked) => setArgValues(prev => ({ ...prev, [arg.name]: checked ? 'true' : '' }))}
            />
            <label htmlFor={arg.name} className="text-sm">{arg.placeholder}</label>
          </div>
        );
      default:
        return (
          <Input
            placeholder={arg.placeholder}
            value={argValues[arg.name] || ''}
            onChange={(e) => setArgValues(prev => ({ ...prev, [arg.name]: e.target.value }))}
            className={commonClasses}
          />
        );
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Tool Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-2">
                  {tool.name}
                  {tool.documentation && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a href={tool.documentation} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>View Documentation</TooltipContent>
                    </Tooltip>
                  )}
                </CardTitle>
                <CardDescription className="text-sm">{tool.longDescription}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge()}
                {toolStatus === 'not_installed' && (
                  <Button size="sm" onClick={installTool} disabled={status !== 'connected'}>
                    <Download className="h-4 w-4 mr-1" /> Install
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          {tool.tips && tool.tips.length > 0 && (
            <CardContent className="pt-0">
              <div className="bg-accent/50 border border-accent rounded-lg p-4">
                <p className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-primary" /> Pro Tips for {tool.name}
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  {tool.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Presets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" /> Command Presets
            </CardTitle>
            <CardDescription>Select a preset or build a custom command</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {tool.presets.map(preset => (
                <div
                  key={preset.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPreset?.id === preset.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => {
                    setSelectedPreset(preset);
                    setUseCustom(false);
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{preset.name}</span>
                    <Badge variant="outline" className={levelColors[preset.level]}>
                      {levelLabels[preset.level]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                  {preset.dangerous && (
                    <Badge variant="outline" className="mt-2 bg-red-500/10 text-red-500 border-red-500/30 text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Use with caution
                    </Badge>
                  )}
                </div>
              ))}
              <div
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  useCustom ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => {
                  setUseCustom(true);
                  setSelectedPreset(null);
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">Custom Command</span>
                  <Badge variant="outline">Manual</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Write your own command</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Arguments / Custom Input */}
        {(selectedPreset || useCustom) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="h-4 w-4" /> 
                {useCustom ? 'Custom Command' : 'Arguments'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {useCustom ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder={`${tool.id} [options] target`}
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    className="font-mono text-sm min-h-[80px]"
                  />
                </div>
              ) : selectedPreset && (
                <>
                  {selectedPreset.args.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedPreset.args.map(arg => (
                        <div key={arg.name} className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1">
                            {arg.flag && <code className="text-primary">{arg.flag}</code>}
                            {arg.name}
                            {arg.required && <span className="text-red-500">*</span>}
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">{arg.description}</TooltipContent>
                            </Tooltip>
                          </Label>
                          {renderArgInput(arg)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No arguments required for this preset.</p>
                  )}

                  {/* Notes and Tips */}
                  {((selectedPreset.notes && selectedPreset.notes.length > 0) || (selectedPreset.tips && selectedPreset.tips.length > 0)) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedPreset.notes && selectedPreset.notes.length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Info className="h-3 w-3" /> Notes
                          </p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                            {selectedPreset.notes.map((note, i) => (
                              <li key={i}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedPreset.tips && selectedPreset.tips.length > 0 && (
                        <div className="bg-accent/50 border border-accent rounded-lg p-3 space-y-1">
                          <p className="text-xs font-medium text-foreground flex items-center gap-1">
                            <Zap className="h-3 w-3 text-primary" /> Tips & Tricks
                          </p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                            {selectedPreset.tips.map((tip, i) => (
                              <li key={i}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Command Preview */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Command Preview</Label>
                <div className="bg-background border rounded-lg p-3 font-mono text-sm break-all">
                  <span className="text-green-500">$</span> {buildCommand() || <span className="text-muted-foreground">Fill in the arguments above...</span>}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyCommand} disabled={!buildCommand()}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  onClick={runCommand}
                  disabled={status !== 'connected' || isRunning || toolStatus !== 'installed' || !buildCommand()}
                  className="flex-1"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" /> Execute
                    </>
                  )}
                </Button>
                {isRunning && (
                  <Button variant="outline" onClick={stopCommand} className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <Square className="h-4 w-4 mr-2" /> Stop
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Output */}
        {(output || isRunning) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Output
                {isRunning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px]">
                <pre className="font-mono text-xs whitespace-pre-wrap bg-background border rounded-lg p-4">
                  {output || 'Waiting for output...'}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}

