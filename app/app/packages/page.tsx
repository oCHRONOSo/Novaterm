"use client";

import { PackageInstall } from '@/components/app/package-install';
import { ConfigForms } from '@/components/app/config-forms';
import { useSocket } from '@/contexts/socket-context';

export default function PackagesPage() {
  const { socket, ip } = useSocket();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Package Manager</h2>
          <PackageInstall socket={socket} />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Configuration</h2>
          <ConfigForms socket={socket} ip={ip} />
        </div>
      </div>
    </div>
  );
}

