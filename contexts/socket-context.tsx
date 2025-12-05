"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';

type ConnectionRow = {
  id: number;
  ip: string;
  port: number;
  username: string;
  password?: string;
  lastConnection: string;
};

type SocketContextType = {
  socket: Socket | null;
  status: string;
  ip: string;
  setIp: (ip: string) => void;
  username: string;
  setUsername: (username: string) => void;
  password: string;
  setPassword: (password: string) => void;
  sshKeyContent: string | null;
  setSshKeyContent: (key: string | null) => void;
  passphrase: string;
  setPassphrase: (passphrase: string) => void;
  port: number;
  setPort: (port: number) => void;
  connections: ConnectionRow[];
  connect: (connectionData?: { ip: string; port: number; username: string; password: string }) => void;
  disconnect: () => void;
  useConnection: (conn: ConnectionRow) => void;
  connectWithConnection: (conn: ConnectionRow) => Promise<void>;
};

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState('disconnected');
  const [ip, setIp] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sshKeyContent, setSshKeyContent] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [port, setPort] = useState(22);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { push } = useToast();

  const socketUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return process.env.NEXT_PUBLIC_SOCKET_HOST || window.location.origin;
  }, []);

  useEffect(() => {
    const loadConnections = async () => {
      const res = await fetch('/api/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections);
      }
    };
    loadConnections();
  }, []);

  const loadConnectionWithPassword = async (connId: number) => {
    const res = await fetch(`/api/connections?includePassword=true`);
    if (res.ok) {
      const data = await res.json();
      const conn = data.connections.find((c: ConnectionRow) => c.id === connId);
      return conn;
    }
    return null;
  };

  const connect = (connectionData?: { ip: string; port: number; username: string; password: string }) => {
    if (!socketUrl) return;
    
    // Disconnect existing socket first if it exists
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
    
    // Reset status and proceed with new connection
    setStatus('connecting');
    
    const connectIp = connectionData?.ip || ip;
    const connectPort = connectionData?.port || port;
    const connectUsername = connectionData?.username || username;
    const connectPassword = connectionData?.password || password;
    
    const newSocket = io(socketUrl, { transports: ['websocket'] });
    socketRef.current = newSocket;
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      setStatus('connected');
      push({ title: 'Connected', variant: 'success' });
      
      setTimeout(() => {
        newSocket.emit('startSSHConnection', {
          ip: connectIp,
          username: connectUsername,
          password: connectPassword,
          port: Number(connectPort) || 22,
          sshKeyContent,
          passphrase,
        });
      }, 100);
    });
    
    newSocket.on('disconnect', () => {
      setStatus('disconnected');
      push({ title: 'Disconnected', variant: 'destructive' });
    });
    
    newSocket.on('connect_error', () => {
      setStatus('disconnected');
      push({ title: 'Connection failed', variant: 'destructive' });
    });
    
    newSocket.on('ssh.status', (msg: string) => {
      setStatus(msg);
      if (msg === 'SSH connected') {
        setStatus('connected');
      }
    });
    newSocket.on('ssh.error', (msg: string) => {
      setStatus('disconnected');
      push({ title: 'SSH error', description: msg, variant: 'destructive' });
    });
    
    fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: connectIp, port: Number(connectPort) || 22, username: connectUsername, password: connectPassword }),
    }).catch(() => {});
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }
    setSocket(null);
    setStatus('disconnected');
  };

  const useConnection = (conn: ConnectionRow) => {
    setIp(conn.ip);
    setPort(conn.port);
    setUsername(conn.username);
    if (conn.password) {
      setPassword(conn.password);
    }
  };

  const connectWithConnection = async (conn: ConnectionRow) => {
    let connectionWithPassword = conn;
    if (!conn.password) {
      const loaded = await loadConnectionWithPassword(conn.id);
      if (loaded && loaded.password) {
        connectionWithPassword = loaded;
      } else {
        push({ title: 'Password not available', description: 'Please enter password manually', variant: 'destructive' });
        setIp(conn.ip);
        setPort(conn.port);
        setUsername(conn.username);
        return;
      }
    }

    connect({
      ip: connectionWithPassword.ip,
      port: connectionWithPassword.port,
      username: connectionWithPassword.username,
      password: connectionWithPassword.password || '',
    });
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
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
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

