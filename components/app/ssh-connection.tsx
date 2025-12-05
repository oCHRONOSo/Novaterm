"use client";

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SSHConnectionProps = {
  ip: string;
  setIp: (ip: string) => void;
  username: string;
  setUsername: (username: string) => void;
  password: string;
  setPassword: (password: string) => void;
  port: number;
  setPort: (port: number) => void;
  sshKeyContent: string | null;
  setSshKeyContent: (key: string | null) => void;
  passphrase: string;
  setPassphrase: (passphrase: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  status: string;
};

export function SSHConnection({
  ip,
  setIp,
  username,
  setUsername,
  password,
  setPassword,
  port,
  setPort,
  sshKeyContent,
  setSshKeyContent,
  passphrase,
  setPassphrase,
  onConnect,
  onDisconnect,
  status,
}: SSHConnectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setSshKeyContent(e.target?.result as string);
    };
    reader.readAsText(file);
  };

  const clearKey = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSshKeyContent(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SSH Connection</CardTitle>
        <CardDescription>Connect to your server</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ip">IP</Label>
            <Input id="ip" value={ip} onChange={(e) => setIp(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sshkey">SSH Key (optional)</Label>
          <Input
            ref={fileInputRef}
            id="sshkey"
            type="file"
            accept=".pub,.pem,.ppk"
            onChange={handleFileUpload}
          />
          {sshKeyContent && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearKey}>
                Clear Key
              </Button>
            </div>
          )}
        </div>
        {sshKeyContent && (
          <div className="space-y-2">
            <Label htmlFor="passphrase">Key Passphrase</Label>
            <Input
              id="passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase if key is encrypted"
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button 
            onClick={onConnect} 
            disabled={status === 'connected' || status === 'connecting'}
          >
            {status === 'connecting' ? 'Connecting...' : 'Connect'}
          </Button>
          <Button 
            variant="secondary" 
            onClick={onDisconnect} 
            disabled={status !== 'connected' && status !== 'connecting'}
          >
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

