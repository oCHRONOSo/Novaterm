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

// Helper to determine if color is dark
const isColorDark = (color: string): boolean => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
};

// Helper to adjust color brightness
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

// Generate Monaco Editor theme from app theme
const generateMonacoTheme = (themeName: string): editor.IStandaloneThemeData => {
  const colors = appThemeColors[themeName] || appThemeColors['default'];
  const [bg, fg, primary] = colors;
  const isDark = isColorDark(bg);
  
  // Generate complementary colors
  const selectionBg = isDark ? adjustBrightness(bg, 1.3) : adjustBrightness(bg, 0.85);
  const lineNumberFg = adjustBrightness(fg, isDark ? 0.6 : 0.7);
  const editorBg = bg;
  const editorFg = fg;
  const borderColor = adjustBrightness(bg, isDark ? 1.15 : 0.9);
  const widgetBg = isDark ? adjustBrightness(bg, 1.1) : adjustBrightness(bg, 0.95);
  const widgetBorder = borderColor;
  
  return {
    base: isDark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: editorFg, background: editorBg },
      { token: 'comment', foreground: adjustBrightness(editorFg, isDark ? 0.6 : 0.7), fontStyle: 'italic' },
      { token: 'string', foreground: adjustBrightness(primary, isDark ? 1.2 : 0.8) },
      { token: 'number', foreground: adjustBrightness(primary, isDark ? 1.1 : 0.9) },
      { token: 'keyword', foreground: primary, fontStyle: 'bold' },
      { token: 'type', foreground: adjustBrightness(primary, isDark ? 0.9 : 1.1) },
      { token: 'class', foreground: adjustBrightness(primary, isDark ? 0.95 : 1.05) },
      { token: 'function', foreground: adjustBrightness(primary, isDark ? 1.05 : 0.95) },
      { token: 'variable', foreground: editorFg },
      { token: 'constant', foreground: adjustBrightness(primary, isDark ? 1.15 : 0.85) },
      { token: 'operator', foreground: editorFg },
      { token: 'delimiter', foreground: editorFg },
    ],
    colors: {
      'editor.background': editorBg,
      'editor.foreground': editorFg,
      'editor.lineHighlightBackground': isDark ? adjustBrightness(bg, 1.05) : adjustBrightness(bg, 0.98),
      'editor.selectionBackground': selectionBg,
      'editor.selectionHighlightBackground': isDark ? adjustBrightness(selectionBg, 0.95) : adjustBrightness(selectionBg, 1.05),
      'editor.inactiveSelectionBackground': isDark ? adjustBrightness(selectionBg, 0.9) : adjustBrightness(selectionBg, 1.1),
      'editor.lineNumber.foreground': lineNumberFg,
      'editor.lineNumber.activeForeground': editorFg,
      'editorCursor.foreground': primary,
      'editorWhitespace.foreground': adjustBrightness(bg, isDark ? 1.1 : 0.9),
      'editorIndentGuide.background': adjustBrightness(bg, isDark ? 1.05 : 0.95),
      'editorIndentGuide.activeBackground': adjustBrightness(bg, isDark ? 1.1 : 0.9),
      'editor.selectionBorder': primary,
      'editor.wordHighlightBackground': isDark ? adjustBrightness(selectionBg, 0.9) : adjustBrightness(selectionBg, 1.1),
      'editor.wordHighlightStrongBackground': isDark ? adjustBrightness(selectionBg, 0.85) : adjustBrightness(selectionBg, 1.15),
      'editorBracketMatch.background': isDark ? adjustBrightness(bg, 1.1) : adjustBrightness(bg, 0.9),
      'editorBracketMatch.border': primary,
      'editorWidget.background': widgetBg,
      'editorWidget.border': widgetBorder,
      'editorSuggestWidget.background': widgetBg,
      'editorSuggestWidget.border': widgetBorder,
      'editorSuggestWidget.selectedBackground': selectionBg,
      'input.background': widgetBg,
      'input.border': widgetBorder,
      'inputOption.activeBorder': primary,
      'scrollbarSlider.background': adjustBrightness(bg, isDark ? 1.2 : 0.8),
      'scrollbarSlider.hoverBackground': adjustBrightness(bg, isDark ? 1.3 : 0.7),
      'scrollbarSlider.activeBackground': adjustBrightness(bg, isDark ? 1.4 : 0.6),
    },
  };
};

export function FileEditor({ socket, file, onClose }: FileEditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('off');
  const [monacoTheme, setMonacoTheme] = useState<string>(() => {
    // Initialize theme from localStorage
    const stored = localStorage.getItem('app-theme') || 'default';
    if (stored === 'default') return 'vs';
    return `novaterm-${stored}`;
  });
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { push } = useToast();

  const hasChanges = content !== originalContent;
  const language = file ? getLanguage(file.name) : 'plaintext';

  // Listen for theme changes and update Monaco theme
  useEffect(() => {
    const applyMonacoTheme = (themeName: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const monaco = (window as any).monaco;
      if (!monaco || !editorRef.current) return;

      if (themeName === 'default') {
        monaco.editor.setTheme('vs');
        setMonacoTheme('vs');
      } else {
        const themeId = `novaterm-${themeName}`;
        try {
          monaco.editor.setTheme(themeId);
          setMonacoTheme(themeId);
        } catch {
          // Theme might not be defined yet, will be defined on mount
          console.warn(`Monaco theme ${themeId} not yet defined`);
        }
      }
    };

    // Listen for theme changes via storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'app-theme') {
        const newTheme = e.newValue || 'default';
        applyMonacoTheme(newTheme);
      }
    };

    // Listen for theme changes via attribute change (for same-tab changes)
    const observer = new MutationObserver(() => {
      const stored = localStorage.getItem('app-theme') || 'default';
      const expectedTheme = stored === 'default' ? 'vs' : `novaterm-${stored}`;
      if (monacoTheme !== expectedTheme) {
        applyMonacoTheme(stored);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-bs-theme'],
    });

    window.addEventListener('storage', handleStorageChange);

    // Check for theme changes periodically (fallback)
    const interval = setInterval(() => {
      const stored = localStorage.getItem('app-theme') || 'default';
      const expectedTheme = stored === 'default' ? 'vs' : `novaterm-${stored}`;
      if (monacoTheme !== expectedTheme) {
        applyMonacoTheme(stored);
      }
    }, 500);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [monacoTheme]);

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

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Define all themes when Monaco loads
    Object.keys(appThemeColors).forEach((themeName) => {
      if (themeName !== 'default') {
        const themeId = `novaterm-${themeName}`;
        try {
          monaco.editor.defineTheme(themeId, generateMonacoTheme(themeName));
        } catch {
          // Theme might already be defined
        }
      }
    });
    
    // Apply current theme
    const currentTheme = localStorage.getItem('app-theme') || 'default';
    if (currentTheme === 'default') {
      // Use built-in light theme for default
      monaco.editor.setTheme('vs');
      setMonacoTheme('vs');
    } else {
      const themeId = `novaterm-${currentTheme}`;
      try {
        monaco.editor.setTheme(themeId);
        setMonacoTheme(themeId);
      } catch {
        // Fallback to default theme
        monaco.editor.setTheme('vs');
        setMonacoTheme('vs');
      }
    }
    
    // Add keyboard shortcut for save
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
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
      <Card className="h-full flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <FileCode className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-50" />
          <p className="text-sm sm:text-base">Select a file to edit</p>
          <p className="text-xs sm:text-sm mt-1">Double-click a file in the browser to open it</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-2 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <CardTitle className="text-lg truncate max-w-[200px] sm:max-w-none" title={file.name}>{file.name}</CardTitle>
            <div className="flex gap-1 flex-shrink-0">
              {hasChanges && <Badge variant="secondary" className="text-xs">Modified</Badge>}
              <Badge variant="outline" className="text-xs">{language}</Badge>
            </div>
          </div>
          <div className="flex gap-0.5 flex-wrap">
            {/* Essential actions - always visible */}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleUndo} title="Undo (Ctrl+Z)">
              <Undo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleRedo} title="Redo (Ctrl+Y)">
              <Redo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hidden sm:flex" onClick={handleFind} title="Find (Ctrl+F)">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hidden sm:flex" onClick={handleReplace} title="Replace (Ctrl+H)">
              <Replace className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-8 w-8 p-0 hidden sm:flex ${wordWrap === 'on' ? 'bg-accent' : ''}`}
              onClick={() => setWordWrap(w => w === 'on' ? 'off' : 'on')} 
              title="Toggle Word Wrap"
            >
              <WrapText className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleDownload} title="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="h-8 px-2"
              onClick={handleSave} 
              disabled={!hasChanges || saving}
              title="Save (Ctrl+S)"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">{saving ? 'Saving...' : 'Save'}</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose} title="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground truncate" title={file.path}>{file.path}</p>
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
            theme={monacoTheme}
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

