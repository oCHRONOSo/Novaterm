"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Terminal,
  Package,
  Shield,
  FolderOpen,
} from "lucide-react";

const menuItems = [
  {
    title: "Terminal",
    icon: Terminal,
    href: "/app",
    description: "SSH Connection & Terminal",
  },
  {
    title: "Files",
    icon: FolderOpen,
    href: "/app/files",
    description: "File Browser & Editor",
  },
  {
    title: "Packages & Config",
    icon: Package,
    href: "/app/packages",
    description: "Package Manager & Configuration",
  },
  {
    title: "Iptables",
    icon: Shield,
    href: "/app/iptables",
    description: "Firewall Rules Generator",
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-4">
          <Terminal className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Novaterm AI</h2>
            <p className="text-xs text-muted-foreground">Control Panel</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.description}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <p className="text-xs text-muted-foreground px-2">
          Press <kbd className="px-1 py-0.5 text-xs font-semibold bg-muted rounded">Ctrl+B</kbd> to toggle sidebar
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

