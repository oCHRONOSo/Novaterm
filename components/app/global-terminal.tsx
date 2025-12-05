"use client";

import { useState } from 'react';
import { TerminalSection } from '@/components/app/terminal-section';
import { ThemeSelector } from '@/components/app/theme-selector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Terminal } from 'lucide-react';
import { useSocket } from '@/contexts/socket-context';

export function GlobalTerminal() {
  const [isOpen, setIsOpen] = useState(false);
  const [terminalTheme, setTerminalTheme] = useState<string>('');
  const [isFloating, setIsFloating] = useState(false);
  const { socket, status } = useSocket();

  return (
    <>
      {/* Toggle Button - Always visible when terminal is closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 h-14 w-14 rounded-full shadow-lg z-[9999] flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          aria-label="Open Terminal"
        >
          <Terminal className="h-6 w-6" />
        </button>
      )}

      {/* Terminal - Always mounted, just hidden when closed */}
      <div
        className={`fixed bottom-6 left-6 z-[9999] transition-all duration-300 w-[800px] max-h-[80vh] ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none invisible'
        }`}
      >
        <div className="relative shadow-2xl">
          <TerminalSection
            socket={socket}
            isConnected={status === 'connected' || status === 'SSH connected'}
            terminalTheme={terminalTheme}
            hideDefaultControls={true}
            onFloatingChange={setIsFloating}
            headerActions={
              <>
                <Badge variant={status === 'connected' ? 'default' : 'secondary'} className="flex-shrink-0">
                  {status === 'connected' ? 'Connected' : 'Disconnected'}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const toggleFn = (window as Window & { __terminalToggleFloating?: () => void }).__terminalToggleFloating;
                    if (toggleFn) {
                      toggleFn();
                    }
                  }}
                  className="flex-shrink-0"
                >
                  {isFloating ? 'Dock' : 'Float'}
                </Button>
                <div 
                  className="relative z-[100]" 
                  style={{ pointerEvents: 'auto' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <ThemeSelector type="terminal" onThemeChange={setTerminalTheme} />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0 flex-shrink-0"
                  title="Close Terminal"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            }
          />
        </div>
      </div>
    </>
  );
}

