"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Home,
  ArrowUp,
  Upload,
  FolderPlus,
  FilePlus,
  Trash2,
  Download,
  Edit,
  Copy,
  Scissors,
  Clipboard,
} from 'lucide-react';
import type { Socket } from 'socket.io-client';

export type FileEntry = {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modified: string;
  permissions: string;
};

type FileBrowserProps = {
  socket: Socket | null;
  onFileSelect?: (file: FileEntry) => void;
  onFileOpen: (file: FileEntry) => void;
};

const fileIcons: Record<string, typeof File> = {
  js: FileCode,
  ts: FileCode,
  jsx: FileCode,
  tsx: FileCode,
  py: FileCode,
  sh: FileCode,
  bash: FileCode,
  json: FileCode,
  yaml: FileCode,
  yml: FileCode,
  xml: FileCode,
  html: FileCode,
  css: FileCode,
  scss: FileCode,
  md: FileText,
  txt: FileText,
  log: FileText,
  conf: FileText,
  cfg: FileText,
  ini: FileText,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  svg: FileImage,
  webp: FileImage,
};

function getFileIcon(filename: string, type: string) {
  if (type === 'directory') return Folder;
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return fileIcons[ext] || File;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function FileBrowser({ socket, onFileSelect, onFileOpen }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sftpReady, setSftpReady] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<{ file: FileEntry; action: 'copy' | 'cut' } | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [pathInput, setPathInput] = useState('/');
  const { push } = useToast();

  const loadDirectory = useCallback((path: string) => {
    if (!socket) {
      push({ title: 'Not connected', description: 'Please connect via SSH first', variant: 'destructive' });
      return;
    }
    setLoading(true);
    socket.emit('sftp.list', path);
  }, [socket, push]);

  useEffect(() => {
    if (!socket) return;

    const handleList = (data: { path: string; files: FileEntry[] }) => {
      setSftpReady(true);
      setFiles(data.files.sort((a, b) => {
        // Directories first, then files
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      }));
      setCurrentPath(data.path);
      setPathInput(data.path);
      setLoading(false);
    };

    const handleError = (error: string) => {
      push({ title: 'SFTP Error', description: error, variant: 'destructive' });
      setLoading(false);
    };

    const handleSuccess = (message: string) => {
      push({ title: 'Success', description: message });
      loadDirectory(currentPath);
    };

    const handleDownloadData = (data: { path: string; filename: string; content: string }) => {
      // Convert base64 to blob and trigger download
      const byteCharacters = atob(data.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/octet-stream' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      push({ title: 'Downloaded', description: `${data.filename} downloaded` });
    };

    const handleSftpReady = () => {
      console.log('SFTP ready, loading directory');
      setSftpReady(true);
      loadDirectory(currentPath);
    };

    socket.on('sftp.list', handleList);
    socket.on('sftp.error', handleError);
    socket.on('sftp.success', handleSuccess);
    socket.on('sftp.downloadData', handleDownloadData);
    socket.on('sftp.ready', handleSftpReady);

    return () => {
      socket.off('sftp.list', handleList);
      socket.off('sftp.error', handleError);
      socket.off('sftp.success', handleSuccess);
      socket.off('sftp.downloadData', handleDownloadData);
      socket.off('sftp.ready', handleSftpReady);
    };
  }, [socket, push, loadDirectory, currentPath]);

  // Reset SFTP ready state when socket changes
  useEffect(() => {
    setSftpReady(false);
  }, [socket]);

  const navigateTo = (path: string) => {
    loadDirectory(path);
  };

  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    navigateTo(parent);
  };

  const goHome = () => {
    navigateTo('/');
  };

  const handleFileClick = (file: FileEntry) => {
    setSelectedFile(file);
    onFileSelect?.(file);
  };

  const handleFileDoubleClick = (file: FileEntry) => {
    if (file.type === 'directory') {
      navigateTo(file.path);
    } else {
      onFileOpen(file);
    }
  };

  const handleCreateFolder = () => {
    if (!socket || !newItemName.trim()) return;
    const newPath = `${currentPath}/${newItemName}`.replace(/\/+/g, '/');
    socket.emit('sftp.mkdir', newPath);
    setShowNewFolderDialog(false);
    setNewItemName('');
  };

  const handleCreateFile = () => {
    if (!socket || !newItemName.trim()) return;
    const newPath = `${currentPath}/${newItemName}`.replace(/\/+/g, '/');
    socket.emit('sftp.writeFile', { path: newPath, content: '' });
    setShowNewFolderDialog(false);
    setNewItemName('');
  };

  const handleDelete = () => {
    if (!socket || !selectedFile) return;
    if (selectedFile.type === 'directory') {
      socket.emit('sftp.rmdir', selectedFile.path);
    } else {
      socket.emit('sftp.unlink', selectedFile.path);
    }
    setShowDeleteDialog(false);
    setSelectedFile(null);
  };

  const handleRename = () => {
    if (!socket || !selectedFile || !newItemName.trim()) return;
    const newPath = `${currentPath}/${newItemName}`.replace(/\/+/g, '/');
    socket.emit('sftp.rename', { oldPath: selectedFile.path, newPath });
    setShowRenameDialog(false);
    setNewItemName('');
  };

  const handleCopy = (file: FileEntry) => {
    setClipboard({ file, action: 'copy' });
    push({ title: 'Copied', description: `${file.name} copied to clipboard` });
  };

  const handleCut = (file: FileEntry) => {
    setClipboard({ file, action: 'cut' });
    push({ title: 'Cut', description: `${file.name} cut to clipboard` });
  };

  const handlePaste = () => {
    if (!socket || !clipboard) return;
    const destPath = `${currentPath}/${clipboard.file.name}`.replace(/\/+/g, '/');
    
    if (clipboard.action === 'copy') {
      socket.emit('sftp.copy', { src: clipboard.file.path, dest: destPath });
    } else {
      socket.emit('sftp.rename', { oldPath: clipboard.file.path, newPath: destPath });
      setClipboard(null);
    }
  };

  const handleDownload = (file: FileEntry) => {
    if (!socket || file.type === 'directory') return;
    socket.emit('sftp.download', file.path);
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || !socket) return;
      
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          const destPath = `${currentPath}/${file.name}`.replace(/\/+/g, '/');
          socket.emit('sftp.upload', { 
            path: destPath, 
            content: content.split(',')[1], // Base64 content
            encoding: 'base64'
          });
        };
        reader.readAsDataURL(file);
      });
    };
    input.click();
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg">File Browser</CardTitle>
          <div className="flex gap-0.5 flex-wrap">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={goHome} title="Home">
              <Home className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={goUp} title="Go Up">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => loadDirectory(currentPath)} title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleUpload} title="Upload">
              <Upload className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setNewItemName(''); setShowNewFolderDialog(true); }} title="New Folder">
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setNewItemName(''); setShowNewFileDialog(true); }} title="New File">
              <FilePlus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 text-sm text-muted-foreground overflow-x-auto scrollbar-thin pb-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-1.5 flex-shrink-0"
            onClick={() => navigateTo('/')}
          >
            /
          </Button>
          {pathParts.map((part, index) => (
            <div key={index} className="flex items-center flex-shrink-0">
              <ChevronRight className="h-3 w-3 flex-shrink-0" />
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-1.5 truncate max-w-[100px]"
                onClick={() => navigateTo('/' + pathParts.slice(0, index + 1).join('/'))}
                title={part}
              >
                {part}
              </Button>
            </div>
          ))}
        </div>

        {/* Path input */}
        <div className="flex gap-1">
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigateTo(pathInput);
              }
            }}
            className="h-8 text-sm min-w-0 flex-1"
            placeholder="Enter path..."
          />
          <Button size="sm" variant="outline" className="h-8 px-3 flex-shrink-0" onClick={() => navigateTo(pathInput)}>
            Go
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-0.5">
            {!sftpReady && files.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Waiting for SFTP connection...</p>
                <p className="text-xs mt-2">Make sure you are connected via SSH</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => loadDirectory(currentPath)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Loading
                </Button>
              </div>
            ) : loading && files.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Empty directory</div>
            ) : (
              files.map((file) => {
                const Icon = getFileIcon(file.name, file.type);
                const isSelected = selectedFile?.path === file.path;
                
                return (
                  <ContextMenu key={file.path}>
                    <ContextMenuTrigger>
                      <div
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent ${
                          isSelected ? 'bg-accent' : ''
                        }`}
                        onClick={() => handleFileClick(file)}
                        onDoubleClick={() => handleFileDoubleClick(file)}
                      >
                        <Icon className={`h-4 w-4 flex-shrink-0 ${file.type === 'directory' ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                        <span className="flex-1 truncate text-sm">{file.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {file.type === 'file' ? formatSize(file.size) : ''}
                        </span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      {file.type === 'file' && (
                        <>
                          <ContextMenuItem onClick={() => onFileOpen(file)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Open
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleDownload(file)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                        </>
                      )}
                      {file.type === 'directory' && (
                        <>
                          <ContextMenuItem onClick={() => navigateTo(file.path)}>
                            <Folder className="h-4 w-4 mr-2" />
                            Open
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                        </>
                      )}
                      <ContextMenuItem onClick={() => handleCopy(file)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleCut(file)}>
                        <Scissors className="h-4 w-4 mr-2" />
                        Cut
                      </ContextMenuItem>
                      {clipboard && (
                        <ContextMenuItem onClick={handlePaste}>
                          <Clipboard className="h-4 w-4 mr-2" />
                          Paste
                        </ContextMenuItem>
                      )}
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => { setSelectedFile(file); setNewItemName(file.name); setShowRenameDialog(true); }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem 
                        onClick={() => { setSelectedFile(file); setShowDeleteDialog(true); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Enter a name for the new folder</DialogDescription>
          </DialogHeader>
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>Enter a name for the new file</DialogDescription>
          </DialogHeader>
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="File name"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateFile}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>Enter a new name</DialogDescription>
          </DialogHeader>
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="New name"
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedFile?.type === 'directory' ? 'Folder' : 'File'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedFile?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="outline" onClick={handleDelete} className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

