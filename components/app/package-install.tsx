"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { Socket } from 'socket.io-client';

type PackageInstallProps = {
  socket: Socket | null;
};

type PackageResult = {
  name: string;
  description: string;
};

export function PackageInstall({ socket }: PackageInstallProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PackageResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const { push } = useToast();
  const outputBufferRef = useRef<string>('');

  // Parse package search output
  const parseSearchOutput = (output: string): PackageResult[] => {
    const results: PackageResult[] = [];
    const lines = output.split('\n').filter((line) => line.trim());
    
    for (const line of lines) {
      // Skip header lines and empty lines
      if (line.startsWith('Sorting') || line.startsWith('Full') || line.startsWith('=') || !line.trim()) {
        continue;
      }
      
      // APT format: "package/version Description text"
      // DNF/YUM format: "package : Description text"
      let match = line.match(/^(\S+)\/(\S+)\s+(.+)$/); // APT format
      if (match) {
        results.push({
          name: match[1],
          description: match[3] || 'No description',
        });
        continue;
      }
      
      match = line.match(/^(\S+)\s*:\s*(.+)$/); // DNF/YUM format
      if (match) {
        results.push({
          name: match[1],
          description: match[2] || 'No description',
        });
        continue;
      }
      
      // Try to extract package name from any line
      const words = line.trim().split(/\s+/);
      if (words.length > 0 && !words[0].includes('/') && !words[0].includes(':')) {
        results.push({
          name: words[0],
          description: words.slice(1).join(' ') || 'No description',
        });
      }
    }
    
    // Remove duplicates
    const unique = results.filter((pkg, index, self) =>
      index === self.findIndex((p) => p.name === pkg.name)
    );
    
    return unique.slice(0, 20); // Limit to 20 results
  };

  // Listen for search results
  useEffect(() => {
    if (!socket) return;

    const searchResultsHandler = (output: string) => {
      console.log('Received search results:', output.substring(0, 200));
      setIsSearching(false);
      const results = parseSearchOutput(output);
      setSearchResults(results);
      
      if (results.length === 0) {
        push({ title: 'No results', description: `No packages found for "${searchQuery}"`, variant: 'destructive' });
      } else {
        push({ title: 'Search complete', description: `Found ${results.length} packages` });
      }
    };

    const searchErrorHandler = (error: string) => {
      setIsSearching(false);
      push({ title: 'Search error', description: error, variant: 'destructive' });
    };

    socket.on('package.search.results', searchResultsHandler);
    socket.on('package.search.error', searchErrorHandler);

    return () => {
      socket.off('package.search.results', searchResultsHandler);
      socket.off('package.search.error', searchErrorHandler);
    };
  }, [socket, isSearching, searchQuery, push]);

  const handleSearch = () => {
    if (!socket) {
      push({ title: 'Not connected', description: 'Please connect via SSH first', variant: 'destructive' });
      return;
    }

    if (!searchQuery.trim()) {
      push({ title: 'Empty search', description: 'Please enter a package name to search', variant: 'destructive' });
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    outputBufferRef.current = '';
    
    // Set timeout fallback
    const timeoutId = setTimeout(() => {
      if (isSearching) {
        setIsSearching(false);
        push({ title: 'Search timeout', description: 'Search is taking longer than expected. Check terminal for results.', variant: 'destructive' });
      }
    }, 10000); // 10 second timeout
    
    // Store timeout to clear if results arrive
    const timeoutRef = { id: timeoutId };
    
    // Listen for results once
    const resultHandler = () => {
      clearTimeout(timeoutRef.id);
      socket?.off('package.search.results', resultHandler);
    };
    socket.once('package.search.results', resultHandler);
    
    // Emit search
    socket.emit('searchPackages', searchQuery.trim());
  };

  const handleInstall = (packageName: string) => {
    if (!socket) {
      push({ title: 'Not connected', description: 'Please connect via SSH first', variant: 'destructive' });
      return;
    }

    setInstalling(packageName);
    socket.emit('installPackage', packageName);
    push({ title: 'Installation started', description: `Installing ${packageName}...` });
    
    // Reset installing state after a delay
    setTimeout(() => {
      setInstalling(null);
    }, 5000);
  };

  const runScript = (scriptName: string) => {
    if (!socket) {
      push({ title: 'Not connected', description: 'Please connect via SSH first', variant: 'destructive' });
      return;
    }
    socket.emit('runScript', { scriptName, args: [] });
    push({ title: 'Script sent', description: `Executing ${scriptName}` });
  };

  const legacyPackages = [
    { name: 'Tools', script: 'installing/tools.sh' },
    { name: 'Apache', script: 'installing/install_apache.sh' },
    { name: 'Nginx', script: 'installing/install_nginx.sh' },
    { name: 'MariaDB Server', script: 'installing/install_mariadb_server.sh' },
    { name: 'Bind (DNS)', script: 'installing/install_bind.sh' },
    { name: 'Kea (DHCP)', script: 'installing/install_kea.sh' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Package Manager</CardTitle>
        <CardDescription>Search and install packages from repositories</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="search" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="legacy">Legacy Scripts</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-3 mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search package (e.g., apache2, nginx, mysql)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isSearching || !socket}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Search Results ({searchResults.length})</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchResults([]);
                      setSearchQuery('');
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <div className="max-h-[400px] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Package</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[100px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((pkg, index) => (
                        <TableRow key={`${pkg.name}-${index}`}>
                          <TableCell className="font-mono text-sm">{pkg.name}</TableCell>
                          <TableCell className="text-sm">{pkg.description}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInstall(pkg.name)}
                              disabled={installing === pkg.name || !socket}
                            >
                              {installing === pkg.name ? 'Installing...' : 'Install'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {!searchResults.length && !isSearching && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <p>Search for packages using your system&apos;s package manager</p>
                <p className="mt-2 text-xs">Supports: apt (Debian/Ubuntu), dnf/yum (RedHat/CentOS/Fedora)</p>
              </div>
            )}

            {isSearching && (
              <div className="text-center py-4">
                <Badge variant="secondary">Searching repositories...</Badge>
              </div>
            )}
          </TabsContent>

          <TabsContent value="legacy" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              One-click installation using pre-configured scripts
            </p>
            <div className="grid grid-cols-2 gap-2">
              {legacyPackages.map((pkg) => (
                <Button
                  key={pkg.script}
                  variant="outline"
                  className="w-full"
                  onClick={() => runScript(pkg.script)}
                  disabled={!socket}
                >
                  {pkg.name}
                </Button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
