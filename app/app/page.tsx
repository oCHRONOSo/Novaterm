"use client";

import { SSHConnection } from '@/components/app/ssh-connection';
import { RecentConnections } from '@/components/app/recent-connections';
import { useSocket } from '@/contexts/socket-context';

export default function TerminalPage() {
  const {
    status,
    ip,
    setIp,
    username,
    setUsername,
    password,
    setPassword,
    sshKeyContent,
    setSshKeyContent,
    passphrase,
    setPassphrase,
    port,
    setPort,
    connections,
    connect,
    disconnect,
    useConnection,
    connectWithConnection,
  } = useSocket();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="grid gap-4 md:grid-cols-2">
        <SSHConnection
          ip={ip}
          setIp={setIp}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          port={port}
          setPort={setPort}
          sshKeyContent={sshKeyContent}
          setSshKeyContent={setSshKeyContent}
          passphrase={passphrase}
          setPassphrase={setPassphrase}
          onConnect={connect}
          onDisconnect={disconnect}
          status={status}
        />
        <RecentConnections
          connections={connections}
          onUseConnection={useConnection}
          onConnect={connectWithConnection}
        />
      </div>

      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold mb-2">SSH Connection & Terminal</h2>
          <p className="text-sm text-muted-foreground">
            Connect to your server using the form above. Once connected, use the terminal button in the bottom left corner to open the global terminal.
          </p>
        </div>
      </div>
    </div>
  );
}
