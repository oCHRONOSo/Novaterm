"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

import type { Socket } from 'socket.io-client';

type IptablesGeneratorProps = {
  socket: Socket | null;
};

export function IptablesGenerator({ socket }: IptablesGeneratorProps) {
  const { push } = useToast();
  const [table, setTable] = useState('filter');
  const [chain, setChain] = useState('INPUT');
  const [type, setType] = useState('A');
  const [protocol, setProtocol] = useState('none');
  const [originIP, setOriginIP] = useState('');
  const [destinationIP, setDestinationIP] = useState('');
  const [outputInterface, setOutputInterface] = useState('');
  const [inputInterface, setInputInterface] = useState('');
  const [sourcePort, setSourcePort] = useState('');
  const [destinationPort, setDestinationPort] = useState('');
  const [user, setUser] = useState('');
  const [finalAction, setFinalAction] = useState('ACCEPT');
  const [logTag, setLogTag] = useState('');
  const [generatedRule, setGeneratedRule] = useState('');

  const generateRule = () => {
    let command = `iptables -t ${table} -${type} ${chain}`;
    if (protocol && protocol !== 'none') command += ` -p ${protocol}`;
    if (originIP) command += ` -s ${originIP}`;
    if (destinationIP) command += ` -d ${destinationIP}`;
    if (outputInterface) command += ` -o ${outputInterface}`;
    if (inputInterface) command += ` -i ${inputInterface}`;
    if (sourcePort) command += ` --sport ${sourcePort}`;
    if (destinationPort) command += ` --dport ${destinationPort}`;
    if (user) command += ` -m owner --uid-owner ${user}`;
    if (finalAction === 'LOG' && logTag) {
      command += ` -j LOG --log-prefix "${logTag}: "`;
    } else {
      command += ` -j ${finalAction}`;
    }
    setGeneratedRule(command);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedRule);
    push({ title: 'Copied to clipboard', description: 'Iptables rule copied' });
  };

  const sendToTerminal = () => {
    if (!socket) {
      push({ title: 'Not connected', description: 'Please connect via SSH first', variant: 'destructive' });
      return;
    }
    socket.emit('input', generatedRule);
    push({ title: 'Rule sent to terminal' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iptables Rule Generator</CardTitle>
        <CardDescription>Generate firewall rules</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="table">Table</Label>
            <Select value={table} onValueChange={setTable}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filter">Filter</SelectItem>
                <SelectItem value="nat">NAT</SelectItem>
                <SelectItem value="mangle">Mangle</SelectItem>
                <SelectItem value="raw">Raw</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chain">Chain</Label>
            <Select value={chain} onValueChange={setChain}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INPUT">Input</SelectItem>
                <SelectItem value="OUTPUT">Output</SelectItem>
                <SelectItem value="FORWARD">Forward</SelectItem>
                <SelectItem value="PREROUTING">Pre-routing</SelectItem>
                <SelectItem value="POSTROUTING">Post-routing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Rule Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Regular rule</SelectItem>
                <SelectItem value="P">Policy by default</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="protocol">Protocol</Label>
            <Select value={protocol} onValueChange={setProtocol}>
              <SelectTrigger>
                <SelectValue placeholder="Select protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="tcp">TCP</SelectItem>
                <SelectItem value="udp">UDP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="originIP">Source IP</Label>
            <Input
              id="originIP"
              value={originIP}
              onChange={(e) => setOriginIP(e.target.value)}
              placeholder="e.g., 192.168.1.0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destinationIP">Destination IP</Label>
            <Input
              id="destinationIP"
              value={destinationIP}
              onChange={(e) => setDestinationIP(e.target.value)}
              placeholder="e.g., 192.168.1.100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="outputInterface">Output Interface</Label>
            <Input
              id="outputInterface"
              value={outputInterface}
              onChange={(e) => setOutputInterface(e.target.value)}
              placeholder="e.g., eth0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inputInterface">Input Interface</Label>
            <Input
              id="inputInterface"
              value={inputInterface}
              onChange={(e) => setInputInterface(e.target.value)}
              placeholder="e.g., eth0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sourcePort">Source Port</Label>
            <Input
              id="sourcePort"
              value={sourcePort}
              onChange={(e) => setSourcePort(e.target.value)}
              placeholder="e.g., 80"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destinationPort">Destination Port</Label>
            <Input
              id="destinationPort"
              value={destinationPort}
              onChange={(e) => setDestinationPort(e.target.value)}
              placeholder="e.g., 22"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user">User</Label>
            <Input
              id="user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="e.g., username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="finalAction">Final Action</Label>
            <Select value={finalAction} onValueChange={setFinalAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACCEPT">Accept</SelectItem>
                <SelectItem value="DROP">Drop</SelectItem>
                <SelectItem value="LOG">Log</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {finalAction === 'LOG' && (
            <div className="space-y-2">
              <Label htmlFor="logTag">Log Tag</Label>
              <Input
                id="logTag"
                value={logTag}
                onChange={(e) => setLogTag(e.target.value)}
                placeholder="e.g., my-iptables-rule"
              />
            </div>
          )}
        </div>
        <Button onClick={generateRule} className="w-full">
          Generate Rule
        </Button>
        {generatedRule && (
          <div className="space-y-2">
            <div className="rounded-md border bg-muted p-3 font-mono text-sm">
              {generatedRule}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyToClipboard}>
                Copy
              </Button>
              <Button variant="outline" onClick={sendToTerminal}>
                Send to Terminal
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

