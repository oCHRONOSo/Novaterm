"use client";

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// App themes from old project
const appThemes = [
  { value: 'default', label: 'Default' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'dark-green', label: 'Dark Green' },
  { value: 'dark-yellow', label: 'Dark Yellow' },
  { value: 'dark-violet', label: 'Dark Violet' },
  { value: 'dark-warm-brown', label: 'Dark Warm Brown' },
  { value: 'dark-blue-grey', label: 'Dark Blue Grey' },
  { value: 'dark-cream-green', label: 'Dark Cream Green' },
  { value: 'sky-blue', label: 'Sky Blue' },
  { value: 'cream', label: 'Cream' },
  { value: 'cream-indigo', label: 'Cream Indigo' },
  { value: 'light-violet', label: 'Light Violet' },
  { value: 'hacker-green', label: 'Hacker Green' },
];

// Terminal themes
const terminalThemes = [
  { value: 'default', label: 'Default Terminal' },
  { value: 'night-owl', label: 'Night Owl' },
  { value: 'nord', label: 'Nord' },
  { value: 'one-dark', label: 'One Dark' },
  { value: 'one-light', label: 'One Light' },
  { value: 'synthwave-84', label: 'Synthwave 84' },
  { value: 'verminal', label: 'Verminal' },
];

export function ThemeSelector({ 
  onThemeChange, 
  type = 'app' 
}: { 
  onThemeChange?: (theme: string) => void;
  type?: 'app' | 'terminal';
}) {
  const [selectedTheme, setSelectedTheme] = useState('default');
  const themes = type === 'app' ? appThemes : terminalThemes;
  const storageKey = type === 'app' ? 'app-theme' : 'terminal-theme';

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored && stored !== selectedTheme) {
      setSelectedTheme(stored);
      applyTheme(stored, type);
      if (onThemeChange) onThemeChange(stored === 'default' ? '' : stored);
    } else if (!stored) {
      setSelectedTheme('default');
      applyTheme('default', type);
      if (onThemeChange) onThemeChange('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTheme = (theme: string, themeType: 'app' | 'terminal') => {
    if (themeType === 'app') {
      // Apply app theme to document
      if (theme === 'default') {
        document.documentElement.removeAttribute('data-bs-theme');
        document.documentElement.classList.remove('dark');
      } else if (theme === 'dark') {
        document.documentElement.setAttribute('data-bs-theme', 'dark');
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.setAttribute('data-bs-theme', 'light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.setAttribute('data-bs-theme', theme);
        // Remove dark class for custom themes (they handle their own colors)
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Terminal theme is handled by onThemeChange callback
      // This is for terminal xterm.js themes
    }
  };

  const handleChange = (value: string) => {
    setSelectedTheme(value);
    localStorage.setItem(storageKey, value);
    applyTheme(value, type);
    
    if (type === 'terminal' && onThemeChange) {
      const themeValue = value === 'default' ? '' : value;
      onThemeChange(themeValue);
    }
  };

  return (
    <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <Select value={selectedTheme} onValueChange={handleChange}>
        <SelectTrigger 
          className="w-[160px]"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue placeholder={`Select ${type} theme`} />
        </SelectTrigger>
        <SelectContent>
          {themes.map((theme) => (
            <SelectItem key={theme.value} value={theme.value}>
              {theme.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

