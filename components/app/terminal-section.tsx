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

  // Terminal themes mapping
  const getTerminalTheme = useCallback((themeName?: string) => {
    if (!themeName || themeName === 'default') return undefined;
    
    const themes: Record<string, {
      background: string;
      foreground: string;
      cursor: string;
      selection: string;
    }> = {
      'night-owl': {
        background: '#011627',
        foreground: '#d6deeb',
        cursor: '#80a4c2',
        selection: '#1d3b53',
      },
      'nord': {
        background: '#2e3440',
        foreground: '#d8dee9',
        cursor: '#d8dee9',
        selection: '#434c5e',
      },
      'one-dark': {
        background: '#282c34',
        foreground: '#abb2bf',
        cursor: '#528bff',
        selection: '#3e4451',
      },
      'one-light': {
        background: '#fafafa',
        foreground: '#383a42',
        cursor: '#526fff',
        selection: '#e5e5e5',
      },
      'synthwave-84': {
        background: '#241b2f',
        foreground: '#f4eee4',
        cursor: '#f97e72',
        selection: '#372d47',
      },
      'verminal': {
        background: '#191323',
        foreground: '#c7c7c7',
        cursor: '#bbbbbb',
        selection: '#2d2d44',
      },
    };
    
    return themes[themeName];
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
          className={`rounded-md border bg-black overflow-hidden flex-1 ${isFloating ? '' : 'min-h-[400px]'}`}
          style={{ 
            height: isFloating ? '100%' : isFullscreen ? '100vh' : '400px',
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