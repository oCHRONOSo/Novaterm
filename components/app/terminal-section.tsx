"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import io, { Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import { useSocket } from '@/contexts/socket-context';

type TerminalSectionProps = {
  socket: Socket | null;
  isConnected: boolean;
  terminalTheme?: string;
  headerActions?: React.ReactNode;
  hideDefaultControls?: boolean;
  onFloatingChange?: (isFloating: boolean) => void;
  onToggleFloating?: () => void;
};

type Position = { x: number; y: number };
type Size = { width: number; height: number };
type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

// Terminal tab instance
type TerminalTab = {
  id: string;
  name: string; // display name (Terminal 1, Terminal 2, ...)
  term: import('@xterm/xterm').Terminal | null;
  fitAddon: import('@xterm/addon-fit').FitAddon | null;
  searchAddon: import('@xterm/addon-search').SearchAddon | null;
  containerRef: HTMLDivElement | null;
  isReady: boolean;
  socket: Socket | null;
  isShared?: boolean;
  sessionId?: string | null;
  status?: string;
  cleanup?: () => void;
};

export function TerminalSection({ socket, isConnected, terminalTheme, headerActions, hideDefaultControls = false, onFloatingChange }: TerminalSectionProps) {
  // Multi-terminal state
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const tabContainersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [size, setSize] = useState<Size>({ width: 800, height: 500 });
  const [isFloating, setIsFloating] = useState(false);
  const isCreatingInitialTab = useRef(false);
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const resizeStartPos = useRef<{ 
    pos: Position; 
    size: Size; 
    initialCardPos: Position;
  }>({ 
    pos: { x: 0, y: 0 }, 
    size: { width: 0, height: 0 },
    initialCardPos: { x: 0, y: 0 },
  });
  const resizeDirection = useRef<ResizeDirection>(null);
  
  // Get active tab
  const activeTab = tabs.find(t => t.id === activeTabId) || null;
  const activeTabIsShared = !!activeTab?.isShared;

  // Credentials and socket host from global context
  const { ip, username, password, sshKeyContent, passphrase, port, status } = useSocket();
  const socketHost = typeof window === 'undefined' ? '' : (process.env.NEXT_PUBLIC_SOCKET_HOST || window.location.origin);

  // Terminal themes mapping - supports all app themes
  const getTerminalTheme = useCallback((themeName?: string) => {
    if (!themeName || themeName === 'default') return undefined;
    
    // Configuration variables - adjust these to control terminal color behavior
    const CONFIG = {
      // Contrast ratios (WCAG guidelines: 3:1 for UI, 4.5:1 for text)
      contrast: {
        foreground: 4.5,      // Minimum contrast for foreground text
        standardAnsi: 3.5,    // Minimum contrast for standard ANSI colors
        brightAnsi: 2.5,      // Minimum contrast for bright ANSI colors
      },
      // Color intensity adjustments
      intensity: {
        darkBg: 0.7,         // Base intensity for dark backgrounds
        lightBg: 0.5,         // Base intensity for light backgrounds
        brightBoost: 0.3,     // Additional intensity for bright colors
      },
      // Hue shift for prompt color (green)
      hueShift: {
        degrees: 120,         // Degrees to shift primary color towards green (0-360)
      },
      // Brightness adjustments
      brightness: {
        darkSelection: 1.3,   // Brightness multiplier for selection on dark bg
        lightSelection: 0.7,  // Brightness multiplier for selection on light bg
        brightColorBoost: 1.2, // Brightness boost for bright colors
        brightBlueBoost: 1.3,  // Brightness boost specifically for bright blue
      },
    };
    
    // App theme color mappings: [background, foreground, primary]
    const appThemeColors: Record<string, string[]> = {
      'default': ['#ffffff', '#000000', '#3b82f6'],
      'dark': ['#1a1a1a', '#ffffff', '#3b82f6'],
      'light': ['#ffffff', '#000000', '#3b82f6'],
      'pink-cute': ['#FFF2F6', '#7A4A68', '#FF6BA8'],
      'dark-green': ['#0A1F1C', '#B8E6D3', '#4ECCA3'],
      'dark-yellow': ['#222831', '#EEEEEE', '#FFD369'],
      'dark-violet': ['#0F0B1E', '#E9D5FF', '#A78BFA'],
      'dark-warm-brown': ['#2D2424', '#E0C097', '#B85C38'],
      'dark-blue-grey': ['#222831', '#EEEEEE', '#76ABAE'],
      'dark-cream-green': ['#2C3639', '#DCD7C9', '#A27B5C'],
      'sky-blue': ['#F9F7F7', '#112D4E', '#3F72AF'],
      'cream': ['#FFF2D8', '#113946', '#BCA37F'],
      'cream-indigo': ['#0A1F2A', '#EAD7BB', '#FFF2D8'],
      'light-violet': ['#F4EEFF', '#424874', '#A6B1E1'],
      'hacker-green': ['#000000', '#00FF41', '#00CC33'],
    };
    
    // Helper to darken/lighten color
    const adjustBrightness = (color: string, factor: number): string => {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      const newR = Math.max(0, Math.min(255, Math.round(r * factor)));
      const newG = Math.max(0, Math.min(255, Math.round(g * factor)));
      const newB = Math.max(0, Math.min(255, Math.round(b * factor)));
      
      return `#${[newR, newG, newB].map(x => x.toString(16).padStart(2, '0')).join('')}`;
    };
    
    // Helper to determine if color is dark
    const isColorDark = (color: string): boolean => {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness < 128;
    };
    
    // Calculate relative luminance (for contrast ratio)
    const getLuminance = (color: string): number => {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      const [rs, gs, bs] = [r, g, b].map(c => {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };
    
    // Calculate contrast ratio between two colors
    const getContrastRatio = (color1: string, color2: string): number => {
      const lum1 = getLuminance(color1);
      const lum2 = getLuminance(color2);
      const lighter = Math.max(lum1, lum2);
      const darker = Math.min(lum1, lum2);
      return (lighter + 0.05) / (darker + 0.05);
    };
    
    // Ensure color has sufficient contrast against background
    const ensureContrast = (color: string, bg: string, minRatio: number = 3.5): string => {
      let currentColor = color;
      let contrast = getContrastRatio(currentColor, bg);
      
      // If contrast is too low, adjust brightness
      if (contrast < minRatio) {
        const isBgDark = isColorDark(bg);
        
        // Adjust towards target luminance
        let attempts = 0;
        while (contrast < minRatio && attempts < 20) {
          const hex = currentColor.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16) / 255;
          const g = parseInt(hex.substr(2, 2), 16) / 255;
          const b = parseInt(hex.substr(4, 2), 16) / 255;
          
          // Move towards target luminance
          const factor = isBgDark ? 1.15 : 0.85;
          const newR = Math.max(0, Math.min(1, r * factor));
          const newG = Math.max(0, Math.min(1, g * factor));
          const newB = Math.max(0, Math.min(1, b * factor));
          
          currentColor = `#${[
            Math.round(newR * 255),
            Math.round(newG * 255),
            Math.round(newB * 255)
          ].map(x => x.toString(16).padStart(2, '0')).join('')}`;
          
          contrast = getContrastRatio(currentColor, bg);
          attempts++;
        }
      }
      
      return currentColor;
    };
    
    // Helper to shift hue towards green
    const shiftHueToGreen = (color: string, shiftDegrees: number = CONFIG.hueShift.degrees): string => {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;
      
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      // Shift hue towards green (add degrees, wrap around 360)
      h = (h * 360 + shiftDegrees) % 360 / 360;
      
      // Convert back to RGB
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      let newR, newG, newB;
      if (s === 0) {
        newR = newG = newB = l;
      } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        newR = hue2rgb(p, q, h + 1/3);
        newG = hue2rgb(p, q, h);
        newB = hue2rgb(p, q, h - 1/3);
      }
      
      return `#${[Math.round(newR * 255), Math.round(newG * 255), Math.round(newB * 255)]
        .map(x => x.toString(16).padStart(2, '0')).join('')}`;
    };
    
    // Generate ANSI colors based on theme
    const generateAnsiColors = (primary: string, bg: string) => {
      const isDark = isColorDark(bg);
      const baseIntensity = isDark ? CONFIG.intensity.darkBg : CONFIG.intensity.lightBg;
      
      // Shift primary color towards green for prompt color
      const greenColor = shiftHueToGreen(primary, CONFIG.hueShift.degrees);
      
      // Generate base colors with proper intensity
      const baseRed = adjustBrightness('#ff4444', baseIntensity);
      const baseYellow = adjustBrightness('#ffff44', baseIntensity);
      const baseMagenta = adjustBrightness('#ff44ff', baseIntensity);
      const baseCyan = adjustBrightness('#44ffff', baseIntensity);
      
      // Ensure all colors have sufficient contrast against background
      const colors = {
        // Standard ANSI colors
        black: ensureContrast(isDark ? '#000000' : '#333333', bg, CONFIG.contrast.standardAnsi),
        red: ensureContrast(baseRed, bg, CONFIG.contrast.standardAnsi),
        green: ensureContrast(greenColor, bg, CONFIG.contrast.standardAnsi),
        yellow: ensureContrast(baseYellow, bg, CONFIG.contrast.standardAnsi),
        blue: ensureContrast(primary, bg, CONFIG.contrast.standardAnsi),
        magenta: ensureContrast(baseMagenta, bg, CONFIG.contrast.standardAnsi),
        cyan: ensureContrast(baseCyan, bg, CONFIG.contrast.standardAnsi),
        white: ensureContrast(isDark ? '#ffffff' : '#000000', bg, CONFIG.contrast.standardAnsi),
        // Bright ANSI colors (more vibrant)
        brightBlack: ensureContrast(isDark ? '#666666' : '#999999', bg, CONFIG.contrast.brightAnsi),
        brightRed: ensureContrast(adjustBrightness('#ff6666', baseIntensity + CONFIG.intensity.brightBoost), bg, CONFIG.contrast.brightAnsi),
        brightGreen: ensureContrast(adjustBrightness(greenColor, CONFIG.brightness.brightColorBoost), bg, CONFIG.contrast.brightAnsi),
        brightYellow: ensureContrast(adjustBrightness('#ffff66', baseIntensity + CONFIG.intensity.brightBoost), bg, CONFIG.contrast.brightAnsi),
        brightBlue: ensureContrast(adjustBrightness(primary, CONFIG.brightness.brightBlueBoost), bg, CONFIG.contrast.brightAnsi),
        brightMagenta: ensureContrast(adjustBrightness('#ff66ff', baseIntensity + CONFIG.intensity.brightBoost), bg, CONFIG.contrast.brightAnsi),
        brightCyan: ensureContrast(adjustBrightness('#66ffff', baseIntensity + CONFIG.intensity.brightBoost), bg, CONFIG.contrast.brightAnsi),
        brightWhite: ensureContrast(isDark ? '#ffffff' : '#000000', bg, CONFIG.contrast.brightAnsi),
      };
      
      return colors;
    };
    
    // Legacy terminal-specific themes (for backward compatibility)
    const legacyThemes: Record<string, Record<string, string>> = {
      'night-owl': {
        background: '#011627',
        foreground: '#d6deeb',
        cursor: '#80a4c2',
        selectionBackground: '#1d3b53',
        selectionForeground: '#d6deeb',
        ...generateAnsiColors('#80a4c2', '#011627'),
      },
      'nord': {
        background: '#2e3440',
        foreground: '#d8dee9',
        cursor: '#d8dee9',
        selectionBackground: '#434c5e',
        selectionForeground: '#d8dee9',
        ...generateAnsiColors('#88c0d0', '#2e3440'),
      },
      'one-dark': {
        background: '#282c34',
        foreground: '#abb2bf',
        cursor: '#528bff',
        selectionBackground: '#3e4451',
        selectionForeground: '#abb2bf',
        ...generateAnsiColors('#528bff', '#282c34'),
      },
      'one-light': {
        background: '#fafafa',
        foreground: '#383a42',
        cursor: '#526fff',
        selectionBackground: '#e5e5e5',
        selectionForeground: '#383a42',
        ...generateAnsiColors('#526fff', '#fafafa'),
      },
      'synthwave-84': {
        background: '#241b2f',
        foreground: '#f4eee4',
        cursor: '#f97e72',
        selectionBackground: '#372d47',
        selectionForeground: '#f4eee4',
        ...generateAnsiColors('#f97e72', '#241b2f'),
      },
      'verminal': {
        background: '#191323',
        foreground: '#c7c7c7',
        cursor: '#bbbbbb',
        selectionBackground: '#2d2d44',
        selectionForeground: '#c7c7c7',
        ...generateAnsiColors('#ff6b6b', '#191323'),
      },
    };
    
    // Check legacy themes first
    if (legacyThemes[themeName]) {
      return legacyThemes[themeName];
    }
    
    // Map app themes to terminal colors with full ANSI support
    const colors = appThemeColors[themeName];
    if (colors) {
      const isDark = isColorDark(colors[0]);
      const selectionBg = isDark 
        ? adjustBrightness(colors[0], CONFIG.brightness.darkSelection) 
        : adjustBrightness(colors[0], CONFIG.brightness.lightSelection);
      
      // Ensure foreground has sufficient contrast
      const foreground = ensureContrast(colors[1], colors[0], CONFIG.contrast.foreground);
      
      return {
        background: colors[0],
        foreground: foreground,
        cursor: colors[2],
        selectionBackground: selectionBg,
        selectionForeground: foreground,
        ...generateAnsiColors(colors[2], colors[0]),
      };
    }
    
    return undefined;
  }, []);

  // Create a new terminal tab
  const createTerminalTab = useCallback(async (
    container: HTMLDivElement,
    displayName: string,
    existingSocket?: Socket | null,
  ): Promise<TerminalTab> => {
    const [{ Terminal }, { FitAddon }, { SearchAddon }, { WebLinksAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/addon-search'),
      import('@xterm/addon-web-links'),
    ]);
    
    if (!socketHost) {
      throw new Error('Socket host is not configured');
    }

    const id = `term-${Math.random().toString(36).slice(2, 8)}`;
    const log = (...args: unknown[]) => console.log(`[Terminal ${id}]`, ...args);
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 13,
      scrollback: 2000,
      disableStdin: false,
      allowProposedApi: true,
      theme: terminalTheme ? getTerminalTheme(terminalTheme) : undefined,
    });
    
    const fit = new FitAddon();
    const search = new SearchAddon();
    const webLinks = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(webLinks);
    term.open(container);

    // Use provided socket for first tab (shares main session) or create a dedicated one
    const isSharedSocket = !!existingSocket;
    const tabSocket = existingSocket || io(socketHost, { transports: ['websocket'] });
    let tabSessionId: string | null = null;
    let tabStatus: string | undefined = tabSocket.connected ? 'connected' : 'connecting';

    const handleConnect = () => {
      tabStatus = 'connecting';
      log('socket connected, starting SSH connection');
      if (!ip || !username) {
        term.writeln('\x1b[31mMissing SSH credentials. Please connect first.\x1b[0m');
        return;
      }
      tabSocket.emit('startSSHConnection', {
        ip,
        username,
        password,
        port: Number(port) || 22,
        sshKeyContent,
        passphrase,
      });
    };

    const handleSessionId = (sid: string) => {
      tabSessionId = sid;
      log('sessionId', sid);
    };

    const handleStatus = (msg: string) => {
      tabStatus = msg;
      log('status', msg);
      if (msg === 'SSH connected') {
        term.writeln('\x1b[32mConnected\x1b[0m');
      }
    };

    const handleError = (msg: string) => {
      tabStatus = 'disconnected';
      log('ssh.error', msg);
      term.writeln(`\x1b[31mSSH error: ${msg}\x1b[0m`);
    };

    const handleOutput = (data: string) => {
      term.write(data);
    };

    const handleDisconnect = () => {
      tabStatus = 'disconnected';
      log('socket disconnected');
      term.writeln('\x1b[33mDisconnected\x1b[0m');
    };

    const handleConnectError = () => {
      tabStatus = 'disconnected';
      log('connect_error');
      term.writeln('\x1b[31mConnection failed\x1b[0m');
    };

    // Register listeners
    if (!isSharedSocket) {
      tabSocket.on('connect', handleConnect);
    } else if (!tabSocket.connected) {
      term.writeln('\x1b[33mWaiting for main connection...\x1b[0m');
    }
    tabSocket.on('ssh.sessionId', handleSessionId);
    tabSocket.on('ssh.status', handleStatus);
    tabSocket.on('ssh.error', handleError);
    tabSocket.on('output', handleOutput);
    tabSocket.on('disconnect', handleDisconnect);
    tabSocket.on('connect_error', handleConnectError);

    // If using shared socket and already connected, immediately show status
    if (isSharedSocket && tabSocket.connected) {
      handleStatus('SSH connected');
    }

    // Send input to this tab's socket
    const inputDisposable = term.onData((data) => {
      log('input', data.length, 'bytes');
      tabSocket.emit('input', data);
    });
    
    // Fit terminal after a small delay
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          fit.fit();
          const size = { rows: term.rows, cols: term.cols };
          tabSocket.emit('resize', size);
          log('resize', size);
        } catch (e) {
          console.error('Fit error:', e);
        }
      }, 50);
    });
    
    // Add ResizeObserver for this terminal
    const resizeObserver = new ResizeObserver(() => {
      try {
        if (fit && container.style.display !== 'none') {
          fit.fit();
          const size = { rows: term.rows, cols: term.cols };
          tabSocket.emit('resize', size);
          log('resize (observer)', size);
        }
      } catch (e) {
        console.error('Resize error:', e);
      }
    });
    resizeObserver.observe(container);
    
    const tab: TerminalTab = {
      id,
      name: displayName,
      term,
      fitAddon: fit,
      searchAddon: search,
      containerRef: container,
      isReady: true,
      socket: tabSocket,
      isShared: isSharedSocket,
      sessionId: tabSessionId,
      status: tabStatus,
    };
    
    // Cleanup helper to dispose resources when tab is removed
    const cleanup = () => {
      resizeObserver.disconnect();
      inputDisposable.dispose();
      tabSocket.off?.('ssh.sessionId', handleSessionId);
      tabSocket.off?.('ssh.status', handleStatus);
      tabSocket.off?.('ssh.error', handleError);
      tabSocket.off?.('output', handleOutput);
      tabSocket.off?.('disconnect', handleDisconnect);
      tabSocket.off?.('connect_error', handleConnectError);
      if (!isSharedSocket) {
        tabSocket.off?.('connect', handleConnect);
        tabSocket.removeAllListeners();
        tabSocket.disconnect();
      }
      term.dispose();
    };
    tab.cleanup = cleanup;
    
    return tab;
  }, [terminalTheme, getTerminalTheme, socketHost, ip, username, password, port, sshKeyContent, passphrase]);
  
  // Add a new terminal tab
  const addTerminalTab = useCallback(async () => {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.display = 'none'; // Hidden by default
    
    // Find the terminal container wrapper and append
    const wrapper = document.getElementById('terminal-tabs-container');
    if (wrapper) {
      wrapper.appendChild(container);
      const displayName = tabs.length === 0 ? 'Main' : `Terminal ${tabs.length + 1}`;
      const newTab = await createTerminalTab(container, displayName, tabs.length === 0 ? socket : undefined);
      tabContainersRef.current.set(newTab.id, container);
      
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
      
      // Show the new tab container
      container.style.display = 'block';
    }
  }, [createTerminalTab, tabs.length, socket]);
  
  // Ensure at least one tab exists after a successful connect
  useEffect(() => {
    if (status === 'connected' && tabs.length === 0 && !isCreatingInitialTab.current) {
      isCreatingInitialTab.current = true;
      void addTerminalTab().finally(() => {
        isCreatingInitialTab.current = false;
      });
    }
  }, [status, tabs.length, addTerminalTab]);

  // Remove a terminal tab
  const removeTerminalTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const tabIndex = prev.findIndex(t => t.id === tabId);
      const tab = prev[tabIndex];
      
      if (tab?.isShared) {
        return prev;
      }

      if (tab) {
        // Cleanup tab resources
        tab.cleanup?.();
        if (!tab.cleanup) {
          tab.term?.dispose();
          tab.socket?.removeAllListeners();
          tab.socket?.disconnect();
        }
        const container = tabContainersRef.current.get(tabId);
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        tabContainersRef.current.delete(tabId);
      }
      
      const newTabs = prev.filter(t => t.id !== tabId);
      
      // If we're removing the active tab, switch to another
      if (tabId === activeTabId && newTabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
        setActiveTabId(newTabs[newActiveIndex]?.id || null);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      
      return newTabs;
    });
  }, [activeTabId]);
  
  // Switch to a tab
  const switchToTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    
    // Update container visibility
    tabs.forEach(tab => {
      const container = tabContainersRef.current.get(tab.id);
      if (container) {
        container.style.display = tab.id === tabId ? 'block' : 'none';
      }
    });
    
    // Refit the active terminal
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.fitAddon) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            tab.fitAddon?.fit();
            if (tab.socket && tab.term) {
              tab.socket.emit('resize', { rows: tab.term.rows, cols: tab.term.cols });
            }
          } catch (e) {
            console.error('Fit error:', e);
          }
        }, 50);
      });
    }
  }, [tabs]);

  // Update terminal theme when it changes - apply to all tabs
  useEffect(() => {
    if (terminalTheme !== undefined) {
      const theme = getTerminalTheme(terminalTheme);
      tabs.forEach(tab => {
        if (tab.term) {
          tab.term.options.theme = theme || undefined;
        }
      });
    }
  }, [terminalTheme, getTerminalTheme, tabs]);

  // Cleanup all terminals on unmount
  useEffect(() => {
    const containersMap = tabContainersRef.current;
    return () => {
      tabs.forEach(tab => {
        tab.cleanup?.();
        if (!tab.cleanup) {
          tab.term?.dispose();
          tab.socket?.removeAllListeners();
          tab.socket?.disconnect();
        }
        const container = containersMap.get(tab.id);
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
      });
      containersMap.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      // Refit terminal when fullscreen state changes
      setTimeout(() => {
        if (activeTab?.fitAddon && activeTab?.term) {
          try {
            activeTab.fitAddon.fit();
            if (activeTab.socket && activeTab.term) {
              activeTab.socket.emit('resize', { rows: activeTab.term.rows, cols: activeTab.term.cols });
            }
          } catch (e) {
            console.error('Refit error:', e);
          }
        }
      }, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [activeTab]);

  // When global status goes disconnected, clean up all tab sockets/terminals
  useEffect(() => {
    if (status !== 'disconnected' || tabs.length === 0) return;

    setTabs(prevTabs => {
      prevTabs.forEach(tab => {
        // Ask the server to end the SSH session, then fully clean up client side
        tab.socket?.emit?.('endSession');
        tab.cleanup?.();
        if (!tab.cleanup) {
          tab.term?.dispose();
          tab.socket?.removeAllListeners();
          tab.socket?.disconnect();
        }
        const container = tabContainersRef.current.get(tab.id);
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
      });
      tabContainersRef.current.clear();
      return [];
    });

    if (activeTabId !== null) {
      setActiveTabId(null);
    }
  }, [status, tabs.length, activeTabId]);


  const toggleFullscreen = () => {
    const container = document.getElementById('terminal-tabs-container');
    if (!container) return;
    if (!isFullscreen) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
        // Refit after fullscreen change
        setTimeout(() => {
          if (activeTab?.fitAddon && activeTab?.term) {
            activeTab.fitAddon.fit();
            if (activeTab.socket && activeTab.term) {
              activeTab.socket.emit('resize', { rows: activeTab.term.rows, cols: activeTab.term.cols });
            }
          }
        }, 100);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        // Refit after exiting fullscreen
        setTimeout(() => {
          if (activeTab?.fitAddon && activeTab?.term) {
            activeTab.fitAddon.fit();
            if (activeTab.socket && activeTab.term) {
              activeTab.socket.emit('resize', { rows: activeTab.term.rows, cols: activeTab.term.cols });
            }
          }
        }, 100);
      });
    }
  };

  const clearTerminal = () => {
    activeTab?.term?.clear();
  };

  const findNext = () => {
    if (activeTab?.searchAddon && searchText) {
      activeTab.searchAddon.findNext(searchText, { caseSensitive: false });
    }
  };

  const findPrevious = () => {
    if (activeTab?.searchAddon && searchText) {
      activeTab.searchAddon.findPrevious(searchText, { caseSensitive: false });
    }
  };

  // Refit terminal when size changes
  const refitTerminal = useCallback(() => {
    if (activeTab?.fitAddon && activeTab?.term && activeTab?.containerRef) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            activeTab.fitAddon?.fit();
            if (activeTab.socket && activeTab.term) {
              activeTab.socket.emit('resize', { rows: activeTab.term.rows, cols: activeTab.term.cols });
            }
          } catch (e) {
            console.error('Refit error:', e);
          }
        }, 50);
      });
    }
  }, [activeTab]);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    if (!isFloating || !cardRef.current) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging || !isFloating) return;
    const newX = e.clientX - dragStartPos.current.x;
    const newY = e.clientY - dragStartPos.current.y;
    
    // Constrain to viewport
    const maxX = window.innerWidth - size.width;
    const maxY = window.innerHeight - size.height;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  }, [isDragging, isFloating, size]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
    if (!isFloating || !cardRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeDirection.current = direction;
    
    // Store initial position for resize calculations
    const rect = cardRef.current.getBoundingClientRect();
    resizeStartPos.current = {
      pos: { x: e.clientX, y: e.clientY },
      size: { ...size },
      initialCardPos: { x: rect.left, y: rect.top },
    };
  };

  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeDirection.current || !isFloating || !resizeStartPos.current.initialCardPos) return;
    
    const deltaX = e.clientX - resizeStartPos.current.pos.x;
    const deltaY = e.clientY - resizeStartPos.current.pos.y;
    
    const initialSize = resizeStartPos.current.size;
    const initialCardPos = resizeStartPos.current.initialCardPos;
    
    let newWidth = initialSize.width;
    let newHeight = initialSize.height;
    let newX = initialCardPos.x;
    let newY = initialCardPos.y;

    const minWidth = 400;
    const minHeight = 300;

    if (resizeDirection.current.includes('e')) {
      newWidth = Math.max(minWidth, initialSize.width + deltaX);
    }
    if (resizeDirection.current.includes('w')) {
      newWidth = Math.max(minWidth, initialSize.width - deltaX);
      newX = initialCardPos.x + (initialSize.width - newWidth);
    }
    if (resizeDirection.current.includes('s')) {
      newHeight = Math.max(minHeight, initialSize.height + deltaY);
    }
    if (resizeDirection.current.includes('n')) {
      newHeight = Math.max(minHeight, initialSize.height - deltaY);
      newY = initialCardPos.y + (initialSize.height - newHeight);
    }

    // Constrain to viewport
    if (newX < 0) {
      newWidth += newX;
      newX = 0;
    }
    if (newY < 0) {
      newHeight += newY;
      newY = 0;
    }
    if (newX + newWidth > window.innerWidth) {
      newWidth = window.innerWidth - newX;
    }
    if (newY + newHeight > window.innerHeight) {
      newHeight = window.innerHeight - newY;
    }

    setSize({ width: newWidth, height: newHeight });
    setPosition({ x: newX, y: newY });

    // Throttled refit during resize for better responsiveness
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    resizeTimeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        refitTerminal();
      });
    }, 50);
  }, [isResizing, isFloating, refitTerminal]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    resizeDirection.current = null;
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }
    // Final refit after resize ends
    requestAnimationFrame(() => {
      setTimeout(() => refitTerminal(), 50);
    });
  }, [refitTerminal]);

  // Mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDrag, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResize, handleResizeEnd]);

  // Refit when size changes
  useEffect(() => {
    if (isFloating && activeTab?.isReady) {
      refitTerminal();
    }
  }, [size, isFloating, activeTab?.isReady, refitTerminal]);
  
  // Update container visibility when active tab changes
  useEffect(() => {
    if (activeTabId) {
      tabs.forEach(tab => {
        const container = tabContainersRef.current.get(tab.id);
        if (container) {
          container.style.display = tab.id === activeTabId ? 'block' : 'none';
        }
      });
      // Refit the active terminal
      refitTerminal();
    }
  }, [activeTabId, tabs, refitTerminal]);
  
  // Keyboard shortcuts for tab management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+T: New tab
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        addTerminalTab();
        return;
      }
      
      // Ctrl+Shift+W: Close current tab
      if (
        e.ctrlKey &&
        e.shiftKey &&
        e.key === 'W' &&
        activeTabId &&
        tabs.length > 1 &&
        !activeTabIsShared
      ) {
        e.preventDefault();
        removeTerminalTab(activeTabId);
        return;
      }
      
      // Ctrl+Tab / Ctrl+Shift+Tab: Switch tabs
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        if (e.shiftKey) {
          // Previous tab
          const prevIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
          switchToTab(tabs[prevIndex].id);
        } else {
          // Next tab
          const nextIndex = (currentIndex + 1) % tabs.length;
          switchToTab(tabs[nextIndex].id);
        }
        return;
      }
      
      // Ctrl+1-9: Switch to specific tab
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < tabs.length) {
          switchToTab(tabs[tabIndex].id);
        }
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, activeTabIsShared, addTerminalTab, removeTerminalTab, switchToTab]);

  const toggleFloating = useCallback(() => {
    const newFloating = !isFloating;
    setIsFloating(newFloating);
    if (onFloatingChange) {
      onFloatingChange(newFloating);
    }
    if (!isFloating) {
      // Center the window when making it floating
      setPosition({
        x: (window.innerWidth - size.width) / 2,
        y: (window.innerHeight - size.height) / 2,
      });
    }
    setTimeout(() => refitTerminal(), 100);
  }, [isFloating, onFloatingChange, size.width, size.height, refitTerminal]);

  // Expose toggleFloating globally for external access
  useEffect(() => {
    (window as Window & { __terminalToggleFloating?: () => void }).__terminalToggleFloating = toggleFloating;
    return () => {
      delete (window as Window & { __terminalToggleFloating?: () => void }).__terminalToggleFloating;
    };
  }, [toggleFloating]);

  const cardStyle: React.CSSProperties = isFloating
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 1000,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
      }
    : {};

  const ResizeHandle = ({ direction, className }: { direction: ResizeDirection; className?: string }) => (
    <div
      className={`absolute bg-transparent hover:bg-primary/20 transition-colors ${className || ''}`}
      style={{
        cursor: direction === 'n' || direction === 's' ? 'ns-resize' :
                direction === 'e' || direction === 'w' ? 'ew-resize' :
                direction === 'ne' || direction === 'sw' ? 'nesw-resize' : 'nwse-resize',
      }}
      onMouseDown={(e) => handleResizeStart(e, direction)}
    />
  );

  return (
    <Card
      ref={cardRef}
      style={cardStyle}
      className={isFloating ? 'shadow-2xl' : ''}
    >
      <CardHeader
        className={`flex-shrink-0 ${isFloating ? 'cursor-move select-none' : ''}`}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-shrink-0">
            <CardTitle>Terminal</CardTitle>
            <CardDescription>Interactive shell</CardDescription>
          </div>
          <div className="flex gap-2 items-center flex-wrap justify-end min-w-0">
            {!hideDefaultControls && (
              <>
                <Badge variant={isConnected ? 'default' : 'secondary'} className="flex-shrink-0">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
                <Button variant="outline" size="sm" onClick={toggleFloating} className="flex-shrink-0">
                  {isFloating ? 'Dock' : 'Float'}
                </Button>
                <Button variant="outline" size="sm" onClick={clearTerminal} className="flex-shrink-0">
                  Clear
                </Button>
                {!isFloating && (
                  <Button variant="outline" size="sm" onClick={toggleFullscreen} className="flex-shrink-0">
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  </Button>
                )}
              </>
            )}
            {headerActions}
          </div>
        </div>
      </CardHeader>
      <CardContent className={` flex-1 overflow-auto ${isFloating ? 'flex flex-col min-h-0' : ''}`}>
        {/* Terminal Tabs Bar */}
        <div className="flex items-center gap-1 flex-shrink-0 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-t-md cursor-pointer transition-colors group ${
                tab.id === activeTabId
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
              onClick={() => switchToTab(tab.id)}
            >
              <span className="text-sm font-medium whitespace-nowrap">{tab.name}</span>
              {tabs.length > 1 && !tab.isShared && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTerminalTab(tab.id);
                  }}
                  className={`ml-1 p-0.5 rounded hover:bg-destructive/20 transition-colors ${
                    tab.id === activeTabId ? 'hover:bg-primary-foreground/20' : ''
                  }`}
                  title="Close terminal"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={addTerminalTab}
            className="h-7 w-7 p-0 flex-shrink-0"
            title="New terminal"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Terminal Container */}
        <div 
          className={`rounded-b-lg rounded-tr-lg mb-2 overflow-hidden ${isFloating ? 'flex-1 min-h-0' : 'min-h-[400px]'}`}
          style={{ 
            height: isFloating ? undefined : isFullscreen ? '100vh' : '400px',
            minHeight: isFloating ? '200px' : '400px',
          }}
        >
          <div
            id="terminal-tabs-container"
            className="w-full h-full"
            style={{ 
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>
        
        {/* Search Bar */}
        <div className="flex gap-2 items-center flex-shrink-0">
          <Input
            placeholder="Search in terminal..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={findPrevious}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={findNext}>
            Next
          </Button>
        </div>
      </CardContent>
      
      {/* Resize handles */}
      {isFloating && (
        <>
          <ResizeHandle direction="n" className="top-0 left-0 right-0 h-1" />
          <ResizeHandle direction="s" className="bottom-0 left-0 right-0 h-1" />
          <ResizeHandle direction="e" className="top-0 bottom-0 right-0 w-1" />
          <ResizeHandle direction="w" className="top-0 bottom-0 left-0 w-1" />
          <ResizeHandle direction="ne" className="top-0 right-0 w-3 h-3" />
          <ResizeHandle direction="nw" className="top-0 left-0 w-3 h-3" />
          <ResizeHandle direction="se" className="bottom-0 right-0 w-3 h-3" />
          <ResizeHandle direction="sw" className="bottom-0 left-0 w-3 h-3" />
        </>
      )}
    </Card>
  );
}