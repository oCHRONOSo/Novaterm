"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ConnectionRow = {
  id: number;
  ip: string;
  port: number;
  username: string;
  password?: string;
  lastConnection: string;
};

type RecentConnectionsProps = {
  connections: ConnectionRow[];
  onUseConnection: (conn: ConnectionRow) => void;
  onConnect?: (conn: ConnectionRow) => void;
};

export function RecentConnections({ connections, onUseConnection, onConnect }: RecentConnectionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Connections</CardTitle>
        <CardDescription>Quickly reuse host settings</CardDescription>
      </CardHeader>
      <CardContent>
        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent connections</p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">IP</TableHead>
                  <TableHead className="min-w-[80px]">Port</TableHead>
                  <TableHead className="min-w-[100px]">User</TableHead>
                  <TableHead className="min-w-[180px]">Last</TableHead>
                  <TableHead className="min-w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((conn) => (
                  <TableRow key={conn.id}>
                    <TableCell className="font-mono text-xs truncate max-w-[120px]" title={conn.ip}>
                      {conn.ip}
                    </TableCell>
                    <TableCell>{conn.port}</TableCell>
                    <TableCell className="truncate max-w-[100px]" title={conn.username}>
                      {conn.username}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(conn.lastConnection).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => onUseConnection(conn)}>
                          Fill
                        </Button>
                        {onConnect && (
                          <Button size="sm" onClick={() => onConnect(conn)}>
                            Connect
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

