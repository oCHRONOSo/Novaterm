"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

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

export function TerminalSection({ socket, isConnected, terminalTheme, headerActions, hideDefaultControls = false, onFloatingChange }: TerminalSectionProps) {
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);
  const searchAddonRef = useRef<import('@xterm/addon-search').SearchAddon | null>(null);
  const termContainerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [size, setSize] = useState<Size>({ width: 800, height: 500 });
  const [isFloating, setIsFloating] = useState(false);
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

  const initTerminal = async () => {
    if (termRef.current || !termContainerRef.current) return;
    const [{ Terminal }, { FitAddon }, { SearchAddon }, { WebLinksAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/addon-search'),
      import('@xterm/addon-web-links'),
    ]);
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
    termRef.current = term;
    fitAddonRef.current = fit;
    searchAddonRef.current = search;
    term.open(termContainerRef.current);
    
    // Fit terminal after a small delay to ensure container is fully rendered
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          if (fit && termContainerRef.current) {
            fit.fit();
            // Emit initial resize
            if (socket && term) {
              socket.emit('resize', { rows: term.rows, cols: term.cols });
            }
          }
        } catch (e) {
          console.error('Fit error:', e);
        }
      }, 50);
    });
    
    setIsTerminalReady(true);

    // Input handler is managed by the useEffect below
    
    const resizeObserver = new ResizeObserver(() => {
      try {
        if (fit && termContainerRef.current) {
          fit.fit();
          if (socket && term) {
            socket.emit('resize', { rows: term.rows, cols: term.cols });
          }
        }
      } catch (e) {
        console.error('Resize error:', e);
      }
    });
    if (termContainerRef.current) {
      resizeObserver.observe(termContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
  };

  // Update terminal theme when it changes
  useEffect(() => {
    if (termRef.current && terminalTheme !== undefined) {
      const theme = getTerminalTheme(terminalTheme);
      if (theme) {
        termRef.current.options.theme = theme;
      } else {
        // Clear theme by setting to undefined or default empty theme
        termRef.current.options.theme = undefined;
      }
    }
  }, [terminalTheme, getTerminalTheme]);

  // Initialize terminal when socket is available
  useEffect(() => {
    if (socket && !termRef.current && termContainerRef.current) {
      initTerminal();
    }
    return () => {
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
        fitAddonRef.current = null;
        searchAddonRef.current = null;
      }
      setIsTerminalReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      // Refit terminal when fullscreen state changes
      setTimeout(() => {
        if (fitAddonRef.current && termRef.current) {
          try {
            fitAddonRef.current.fit();
            if (socket && termRef.current) {
              socket.emit('resize', { rows: termRef.current.rows, cols: termRef.current.cols });
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
  }, [socket]);

  // Update input handler when socket changes
  useEffect(() => {
    if (isTerminalReady && termRef.current && socket) {
      const term = termRef.current;
      const disposable = term.onData((data) => {
        socket.emit('input', data);
      });
      return () => {
        disposable.dispose();
      };
    }
  }, [socket, isTerminalReady]);

  // Set up output handler when both socket and terminal are ready
  useEffect(() => {
    if (!socket || !isTerminalReady || !termRef.current) return;
    
    const handler = (data: string) => {
      if (termRef.current) {
        termRef.current.write(data);
      }
    };
    
    socket.on('output', handler);
    
    return () => {
      socket.off('output', handler);
    };
  }, [socket, isTerminalReady]);

  const toggleFullscreen = () => {
    if (!termContainerRef.current) return;
    if (!isFullscreen) {
      termContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
        // Refit after fullscreen change
        setTimeout(() => {
          if (fitAddonRef.current && termRef.current) {
            fitAddonRef.current.fit();
            if (socket && termRef.current) {
              socket.emit('resize', { rows: termRef.current.rows, cols: termRef.current.cols });
            }
          }
        }, 100);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        // Refit after exiting fullscreen
        setTimeout(() => {
          if (fitAddonRef.current && termRef.current) {
            fitAddonRef.current.fit();
            if (socket && termRef.current) {
              socket.emit('resize', { rows: termRef.current.rows, cols: termRef.current.cols });
            }
          }
        }, 100);
      });
    }
  };

  const clearTerminal = () => {
    termRef.current?.clear();
  };

  const findNext = () => {
    if (searchAddonRef.current && searchText) {
      searchAddonRef.current.findNext(searchText, { caseSensitive: false });
    }
  };

  const findPrevious = () => {
    if (searchAddonRef.current && searchText) {
      searchAddonRef.current.findPrevious(searchText, { caseSensitive: false });
    }
  };

  // Refit terminal when size changes
  const refitTerminal = useCallback(() => {
    if (fitAddonRef.current && termRef.current && termContainerRef.current) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            fitAddonRef.current?.fit();
            if (socket && termRef.current) {
              socket.emit('resize', { rows: termRef.current.rows, cols: termRef.current.cols });
            }
          } catch (e) {
            console.error('Refit error:', e);
          }
        }, 50);
      });
    }
  }, [socket]);

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
  }, [isResizing, isFloating]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    resizeDirection.current = null;
    refitTerminal();
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
    if (isFloating && isTerminalReady) {
      refitTerminal();
    }
  }, [size, isFloating, isTerminalReady, refitTerminal]);

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
      <CardContent className={`space-y-3 flex-1 overflow-hidden ${isFloating ? 'flex flex-col' : ''}`}>
        <div 
          className={`rounded-lg border overflow-hidden ${isFloating ? '' : 'min-h-[400px]'}`}
          style={{ 
            height: isFloating ? 'auto' : isFullscreen ? '100vh' : '400px',
          }}
        >
          <div
            ref={termContainerRef}
            className="w-full h-full"
            style={{ 
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>
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