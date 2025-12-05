"use client";

import { useState } from 'react';
import { FileBrowser, FileEntry } from '@/components/app/file-browser';
import { FileEditor } from '@/components/app/file-editor';
import { useSocket } from '@/contexts/socket-context';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

export default function FilesPage() {
  const { socket, status } = useSocket();
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [openFile, setOpenFile] = useState<FileEntry | null>(null);

  const handleFileSelect = (file: FileEntry) => {
    setSelectedFile(file);
  };

  const handleFileOpen = (file: FileEntry) => {
    if (file.type === 'file') {
      setOpenFile(file);
    }
  };

  const handleCloseEditor = () => {
    setOpenFile(null);
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

  return (
    <div className="flex flex-1 flex-col p-4 h-full">
      <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <FileBrowser
            socket={socket}
            onFileSelect={handleFileSelect}
            onFileOpen={handleFileOpen}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70}>
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

