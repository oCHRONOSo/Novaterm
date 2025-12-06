"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  Target,
  Activity,
  FileText,
  Network,
  Wrench,
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

const monitoringMenuItems = [
  {
    title: "System Monitor",
    icon: Activity,
    href: "/app/monitoring",
    description: "CPU, RAM, Disk & Process Monitoring",
  },
  {
    title: "Log Viewer",
    icon: FileText,
    href: "/app/monitoring/logs",
    description: "Real-time Log Streaming & Analysis",
  },
  {
    title: "Network",
    icon: Network,
    href: "/app/monitoring/network",
    description: "Bandwidth, Connections & Port Scanner",
  },
];

const ctfMenuItems = [
  {
    title: "CTF Guide",
    icon: Target,
    href: "/app/ctf",
    description: "Methodology, Roadmap, OSINT & OWASP",
  },
  {
    title: "CTF Tools",
    icon: Wrench,
    href: "/app/ctf/tools",
    description: "Professional Pentesting Toolkit",
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2 px-2 py-4 hover:bg-accent/50 transition-colors rounded-lg -mx-2">
          <Terminal className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Novaterm AI</h2>
            <p className="text-xs text-muted-foreground">Control Panel</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
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
        <SidebarGroup>
          <SidebarGroupLabel>Monitoring</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {monitoringMenuItems.map((item) => {
                const Icon = item.icon;
                // Check if pathname matches this item exactly or starts with it
                const matchesThisItem = pathname === item.href || pathname.startsWith(item.href + '/');
                
                // Check if any sibling route is more specific and also matches
                const allMonitoringHrefs = monitoringMenuItems.map(m => m.href);
                const hasMoreSpecificMatch = allMonitoringHrefs.some(href => {
                  if (href === item.href) return false;
                  // Check if this sibling is more specific (longer) and matches the pathname
                  return (pathname === href || pathname.startsWith(href + '/')) && href.length > item.href.length;
                });
                
                const isActive = matchesThisItem && !hasMoreSpecificMatch;
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
        <SidebarGroup>
          <SidebarGroupLabel>CTF & Security</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ctfMenuItems.map((item) => {
                const Icon = item.icon;
                // Check if pathname matches this item exactly or starts with it
                const matchesThisItem = pathname === item.href || pathname.startsWith(item.href + '/');
                
                // Check if any sibling route is more specific and also matches
                const allCTFHrefs = ctfMenuItems.map(m => m.href);
                const hasMoreSpecificMatch = allCTFHrefs.some(href => {
                  if (href === item.href) return false;
                  // Check if this sibling is more specific (longer) and matches the pathname
                  return (pathname === href || pathname.startsWith(href + '/')) && href.length > item.href.length;
                });
                
                const isActive = matchesThisItem && !hasMoreSpecificMatch;
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

