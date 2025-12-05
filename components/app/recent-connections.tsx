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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Last</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell>{conn.ip}</TableCell>
                  <TableCell>{conn.port}</TableCell>
                  <TableCell>{conn.username}</TableCell>
                  <TableCell>{new Date(conn.lastConnection).toLocaleString()}</TableCell>
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
        )}
      </CardContent>
    </Card>
  );
}

