"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode, useCallback } from 'react';
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

type StoredCredentials = {
  ip: string;
  port: number;
  username: string;
  password: string;
  sshKeyContent: string | null;
  passphrase: string;
  sessionId: string | null;
};

type SocketContextType = {
  socket: Socket | null;
  status: string;
  sessionId: string | null;
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

const CREDENTIALS_KEY = 'novaterm_ssh_credentials';
const ENCRYPTION_KEY = 'novaterm_encryption_key';

// Simple XOR-based obfuscation with a session-specific key
// This provides basic protection against casual inspection of sessionStorage
// For production, consider using Web Crypto API with proper key management

function generateSessionKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function getOrCreateSessionKey(): string {
  if (typeof window === 'undefined') return '';
  let key = sessionStorage.getItem(ENCRYPTION_KEY);
  if (!key) {
    key = generateSessionKey();
    sessionStorage.setItem(ENCRYPTION_KEY, key);
  }
  return key;
}

function encryptString(plaintext: string, key: string): string {
  if (!plaintext) return '';
  const encoded = new TextEncoder().encode(plaintext);
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = new Uint8Array(encoded.length);
  
  for (let i = 0; i < encoded.length; i++) {
    encrypted[i] = encoded[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

function decryptString(ciphertext: string, key: string): string {
  if (!ciphertext) return '';
  try {
    const decoded = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const keyBytes = new TextEncoder().encode(key);
    const decrypted = new Uint8Array(decoded.length);
    
    for (let i = 0; i < decoded.length; i++) {
      decrypted[i] = decoded[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return new TextDecoder().decode(decrypted);
  } catch {
    return '';
  }
}

// Helper functions for sessionStorage with encryption
const saveCredentials = (creds: StoredCredentials) => {
  if (typeof window !== 'undefined') {
    const key = getOrCreateSessionKey();
    const encrypted = {
      ...creds,
      password: encryptString(creds.password, key),
      passphrase: encryptString(creds.passphrase, key),
      sshKeyContent: creds.sshKeyContent ? encryptString(creds.sshKeyContent, key) : null,
    };
    sessionStorage.setItem(CREDENTIALS_KEY, JSON.stringify(encrypted));
  }
};

const clearCredentials = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(CREDENTIALS_KEY);
    sessionStorage.removeItem(ENCRYPTION_KEY);
  }
};

// Initialize state from sessionStorage (called once during initial render)
const getInitialCredentials = (): StoredCredentials | null => {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(CREDENTIALS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const key = getOrCreateSessionKey();
      
      // Decrypt sensitive fields
      return {
        ...parsed,
        password: decryptString(parsed.password, key),
        passphrase: decryptString(parsed.passphrase, key),
        sshKeyContent: parsed.sshKeyContent ? decryptString(parsed.sshKeyContent, key) : null,
      };
    } catch {
      return null;
    }
  }
  return null;
};

export function SocketProvider({ children }: { children: ReactNode }) {
  // Get initial credentials once during first render
  const initialCreds = useMemo(() => getInitialCredentials(), []);
  
  const [status, setStatus] = useState('disconnected');
  const [ip, setIp] = useState(initialCreds?.ip || '');
  const [username, setUsername] = useState(initialCreds?.username || '');
  const [password, setPassword] = useState(initialCreds?.password || '');
  const [sshKeyContent, setSshKeyContent] = useState<string | null>(initialCreds?.sshKeyContent || null);
  const [passphrase, setPassphrase] = useState(initialCreds?.passphrase || '');
  const [port, setPort] = useState(initialCreds?.port || 22);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialCreds?.sessionId || null);
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(initialCreds?.sessionId || null);
  const hasAutoConnected = useRef(false);
  const shouldAutoConnect = useRef(!!initialCreds);
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

  const connect = useCallback((connectionData?: { ip: string; port: number; username: string; password: string }, isAutoReconnect = false) => {
    if (!socketUrl) return;
    
    // Disconnect existing socket first if it exists
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
    
    // Reset status and proceed with new connection
    setStatus(isAutoReconnect ? 'reconnecting' : 'connecting');
    
    const connectIp = connectionData?.ip || ip;
    const connectPort = connectionData?.port || port;
    const connectUsername = connectionData?.username || username;
    const connectPassword = connectionData?.password || password;
    const connectSshKeyContent = sshKeyContent;
    const connectPassphrase = passphrase;
    const existingSessionId = sessionIdRef.current;
    
    const newSocket = io(socketUrl, { transports: ['websocket'] });
    socketRef.current = newSocket;
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      // If we have an existing session ID and are reconnecting, try to reconnect to that session
      if (isAutoReconnect && existingSessionId) {
        newSocket.emit('reconnectSession', existingSessionId);
      } else {
        // Start a new SSH connection
        newSocket.emit('startSSHConnection', {
          ip: connectIp,
          username: connectUsername,
          password: connectPassword,
          port: Number(connectPort) || 22,
          sshKeyContent: connectSshKeyContent,
          passphrase: connectPassphrase,
        });
      }
    });
    
    // Handle session ID from server
    newSocket.on('ssh.sessionId', (newSessionId: string) => {
      sessionIdRef.current = newSessionId;
      setSessionId(newSessionId);
      
      // Save credentials with session ID
      saveCredentials({
        ip: connectIp,
        port: connectPort,
        username: connectUsername,
        password: connectPassword,
        sshKeyContent: connectSshKeyContent,
        passphrase: connectPassphrase,
        sessionId: newSessionId,
      });
    });
    
    // Handle session reconnection success
    newSocket.on('ssh.reconnected', () => {
      push({ title: 'Session Restored', description: 'Reconnected to existing SSH session', variant: 'success' });
    });
    
    // Handle session expiration - need to create new session
    newSocket.on('ssh.sessionExpired', () => {
      sessionIdRef.current = null;
      setSessionId(null);
      
      // Session expired, start fresh connection
      newSocket.emit('startSSHConnection', {
        ip: connectIp,
        username: connectUsername,
        password: connectPassword,
        port: Number(connectPort) || 22,
        sshKeyContent: connectSshKeyContent,
        passphrase: connectPassphrase,
      });
      
      push({ title: 'Session Expired', description: 'Starting new SSH session', variant: 'default' });
    });
    
    newSocket.on('disconnect', () => {
      setStatus('disconnected');
      // Don't show disconnect toast if page is being unloaded
      if (document.visibilityState !== 'hidden') {
        push({ title: 'Disconnected', description: 'Session preserved for 5 minutes', variant: 'default' });
      }
    });
    
    newSocket.on('connect_error', () => {
      setStatus('disconnected');
      push({ title: 'Connection failed', variant: 'destructive' });
      // Clear credentials on connection error to prevent infinite reconnect loop
      if (isAutoReconnect) {
        clearCredentials();
        sessionIdRef.current = null;
        setSessionId(null);
      }
    });
    
    newSocket.on('ssh.status', (msg: string) => {
      setStatus(msg);
      if (msg === 'SSH connected') {
        setStatus('connected');
        if (!isAutoReconnect) {
          push({ title: 'Connected', variant: 'success' });
        }
      }
    });
    
    newSocket.on('ssh.error', (msg: string) => {
      setStatus('disconnected');
      push({ title: 'SSH error', description: msg, variant: 'destructive' });
      // Clear credentials on SSH error to prevent reconnect with bad credentials
      if (isAutoReconnect) {
        clearCredentials();
        sessionIdRef.current = null;
        setSessionId(null);
      }
    });
    
    if (!isAutoReconnect) {
      fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: connectIp, port: Number(connectPort) || 22, username: connectUsername, password: connectPassword }),
      }).catch(() => {});
    }
  }, [socketUrl, ip, port, username, password, sshKeyContent, passphrase, push]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      // Tell server to end the session (not just detach)
      socketRef.current.emit('endSession');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }
    setSocket(null);
    setStatus('disconnected');
    sessionIdRef.current = null;
    setSessionId(null);
    // Clear saved credentials on manual disconnect
    clearCredentials();
  }, []);

  // Auto-reconnect on page load if credentials were stored
  useEffect(() => {
    if (hasAutoConnected.current || !shouldAutoConnect.current) return;
    if (!initialCreds?.ip || !initialCreds?.username) return;
    
    hasAutoConnected.current = true;
    
    // Auto-reconnect with slight delay to allow component to mount
    const timer = setTimeout(() => {
      connect({
        ip: initialCreds.ip,
        port: initialCreds.port,
        username: initialCreds.username,
        password: initialCreds.password,
      }, true); // isAutoReconnect = true
    }, 500);
    
    return () => clearTimeout(timer);
  }, [connect, initialCreds]);

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

    // Keep context state in sync so terminals created after this connect
    // have access to the credentials immediately.
    setIp(connectionWithPassword.ip);
    setPort(connectionWithPassword.port);
    setUsername(connectionWithPassword.username);
    setPassword(connectionWithPassword.password || '');

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
        sessionId,
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

