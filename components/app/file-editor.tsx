"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Save,
  X,
  Undo,
  Redo,
  Search,
  Replace,
  WrapText,
  Download,
  FileCode,
} from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type { FileEntry } from './file-browser';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

type FileEditorProps = {
  socket: Socket | null;
  file: FileEntry | null;
  onClose: () => void;
};

const languageMap: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'shell',
  bash: 'shell',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  md: 'markdown',
  sql: 'sql',
  php: 'php',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  conf: 'ini',
  cfg: 'ini',
  ini: 'ini',
  toml: 'ini',
  nginx: 'nginx',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
};

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const name = filename.toLowerCase();
  
  if (name === 'dockerfile') return 'dockerfile';
  if (name === 'makefile') return 'makefile';
  if (name.endsWith('.nginx') || name.includes('nginx.conf')) return 'nginx';
  
  return languageMap[ext] || 'plaintext';
}

export function FileEditor({ socket, file, onClose }: FileEditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('off');
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { push } = useToast();

  const hasChanges = content !== originalContent;
  const language = file ? getLanguage(file.name) : 'plaintext';

  useEffect(() => {
    if (!socket || !file) return;

    const handleContent = (data: { path: string; content: string }) => {
      if (data.path === file.path) {
        setContent(data.content);
        setOriginalContent(data.content);
        setLoading(false);
      }
    };

    const handleError = (error: string) => {
      push({ title: 'Error', description: error, variant: 'destructive' });
      setLoading(false);
      setSaving(false);
    };

    const handleSaved = (path: string) => {
      if (path === file?.path) {
        setOriginalContent(content);
        setSaving(false);
        push({ title: 'Saved', description: `${file.name} saved successfully` });
      }
    };

    socket.on('sftp.fileContent', handleContent);
    socket.on('sftp.error', handleError);
    socket.on('sftp.saved', handleSaved);

    return () => {
      socket.off('sftp.fileContent', handleContent);
      socket.off('sftp.error', handleError);
      socket.off('sftp.saved', handleSaved);
    };
  }, [socket, file, content, push]);

  useEffect(() => {
    if (socket && file) {
      setLoading(true);
      setContent('');
      setOriginalContent('');
      socket.emit('sftp.readFile', file.path);
    }
  }, [socket, file]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    
    // Add keyboard shortcut for save
    editor.addCommand(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).monaco?.KeyMod.CtrlCmd | (window as any).monaco?.KeyCode.KeyS,
      () => handleSave()
    );
  };

  const handleSave = () => {
    if (!socket || !file || saving) return;
    setSaving(true);
    socket.emit('sftp.writeFile', { path: file.path, content });
  };

  const handleUndo = () => {
    editorRef.current?.trigger('keyboard', 'undo', null);
  };

  const handleRedo = () => {
    editorRef.current?.trigger('keyboard', 'redo', null);
  };

  const handleFind = () => {
    editorRef.current?.trigger('keyboard', 'actions.find', null);
  };

  const handleReplace = () => {
    editorRef.current?.trigger('keyboard', 'editor.action.startFindReplaceAction', null);
  };

  const handleDownload = () => {
    if (!file) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!file) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <FileCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>Select a file to edit</p>
          <p className="text-sm">Double-click a file in the browser to open it</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg truncate">{file.name}</CardTitle>
            {hasChanges && <Badge variant="secondary">Modified</Badge>}
            <Badge variant="outline">{language}</Badge>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleUndo} title="Undo (Ctrl+Z)">
              <Undo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRedo} title="Redo (Ctrl+Y)">
              <Redo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleFind} title="Find (Ctrl+F)">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReplace} title="Replace (Ctrl+H)">
              <Replace className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setWordWrap(w => w === 'on' ? 'off' : 'on')} 
              title="Toggle Word Wrap"
              className={wordWrap === 'on' ? 'bg-accent' : ''}
            >
              <WrapText className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownload} title="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleSave} 
              disabled={!hasChanges || saving}
              title="Save (Ctrl+S)"
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} title="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground truncate">{file.path}</p>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        ) : (
          <Editor
            height="100%"
            language={language}
            value={content}
            onChange={(value) => setContent(value || '')}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
              folding: true,
              foldingHighlight: true,
              bracketPairColorization: { enabled: true },
              renderWhitespace: 'selection',
              smoothScrolling: true,
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

