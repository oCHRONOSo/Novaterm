"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThemeSelector } from '@/components/app/theme-selector';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app/app-sidebar';
import { SocketProvider, useSocket } from '@/contexts/socket-context';
import { AIChat } from '@/components/app/ai-chat';
import { GlobalTerminal } from '@/components/app/global-terminal';

function AppHeader() {
  const [user, setUser] = useState<{ id: number; name: string; email: string } | null>(null);
  const { status } = useSocket();
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const res = await fetch('/api/user');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Control Panel</h1>
          {user && (
            <p className="text-xs text-muted-foreground">
              {user.name} ({user.email})
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeSelector type="app" />
          <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
            {status}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SocketProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="h-screen overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
          <AIChat />
          <GlobalTerminal />
        </SidebarInset>
      </SidebarProvider>
    </SocketProvider>
  );
}

