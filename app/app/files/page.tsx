"use client";

import { useState, useEffect } from 'react';
import { FileBrowser, FileEntry } from '@/components/app/file-browser';
import { FileEditor } from '@/components/app/file-editor';
import { useSocket } from '@/contexts/socket-context';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FolderOpen, FileCode } from 'lucide-react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

export default function FilesPage() {
  const { socket, status } = useSocket();
  const [openFile, setOpenFile] = useState<FileEntry | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'browser' | 'editor'>('browser');

  // Detect mobile/tablet breakpoint
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleFileOpen = (file: FileEntry) => {
    if (file.type === 'file') {
      setOpenFile(file);
      if (isMobile) {
        setMobileView('editor');
      }
    }
  };

  const handleCloseEditor = () => {
    setOpenFile(null);
    if (isMobile) {
      setMobileView('browser');
    }
  };

  const isConnected = status === 'connected' || status === 'SSH connected';

  if (!isConnected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Not Connected</h2>
          <p className="text-muted-foreground">
            Please connect to a server via SSH to browse files.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Go to the Terminal page to establish a connection.
          </p>
        </div>
      </div>
    );
  }

  // Mobile layout - single panel with toggle
  if (isMobile) {
    return (
      <div className="flex flex-1 flex-col h-full">
        {/* Mobile navigation tabs */}
        <div className="flex border-b bg-muted/30 p-1 gap-1">
          <Button
            variant={mobileView === 'browser' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setMobileView('browser')}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Files
          </Button>
          <Button
            variant={mobileView === 'editor' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setMobileView('editor')}
            disabled={!openFile}
          >
            <FileCode className="h-4 w-4 mr-2" />
            Editor
            {openFile && <span className="ml-1 text-xs opacity-70 truncate max-w-20">({openFile.name})</span>}
          </Button>
        </div>

        {/* Mobile content */}
        <div className="flex-1 overflow-hidden p-2">
          {mobileView === 'browser' ? (
            <FileBrowser
              socket={socket}
              onFileOpen={handleFileOpen}
            />
          ) : (
            <div className="h-full flex flex-col">
              {openFile && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start mb-2"
                  onClick={() => setMobileView('browser')}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Files
                </Button>
              )}
              <div className="flex-1 min-h-0">
                <FileEditor
                  socket={socket}
                  file={openFile}
                  onClose={handleCloseEditor}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop/tablet layout - resizable panels
  return (
    <div className="flex flex-1 flex-col p-4 h-full">
      <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg">
        <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
          <FileBrowser
            socket={socket}
            onFileOpen={handleFileOpen}
          />
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-transparent after:hidden mx-1" />
        <ResizablePanel defaultSize={70} minSize={40}>
          <FileEditor
            socket={socket}
            file={openFile}
            onClose={handleCloseEditor}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

