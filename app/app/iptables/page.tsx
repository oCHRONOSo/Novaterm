"use client";

import { IptablesGenerator } from '@/components/app/iptables-generator';
import { useSocket } from '@/contexts/socket-context';

export default function IptablesPage() {
  const { socket } = useSocket();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Iptables Generator</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Generate and manage firewall rules for your server
          </p>
          <IptablesGenerator socket={socket} />
        </div>
      </div>
    </div>
  );
}

