"use client";

import { useEffect, useState, useRef } from 'react';
import { 
  Check, Palette, Circle, Moon, Sun, Heart, TreePine, Star, 
  Gem, Coffee, Anchor, Leaf, Cloud, Milk, Waves, Flower2, Terminal,
  Bird, Snowflake, Eclipse, Sunset, Zap, LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
type Theme = {
  value: string;
  label: string;
  colors: string[];
  icon: LucideIcon;
};

// App themes
const appThemes: Theme[] = [
  { value: 'default', label: 'Default', colors: ['#ffffff', '#000000', '#3b82f6'], icon: Circle },
  { value: 'dark', label: 'Dark', colors: ['#1a1a1a', '#ffffff', '#3b82f6'], icon: Moon },
  { value: 'light', label: 'Light', colors: ['#ffffff', '#000000', '#3b82f6'], icon: Sun },
  { value: 'pink-cute', label: 'Pink Cute', colors: ['#FFF2F6', '#7A4A68', '#FF6BA8'], icon: Heart },
  { value: 'dark-green', label: 'Forest', colors: ['#0A1F1C', '#B8E6D3', '#4ECCA3'], icon: TreePine },
  { value: 'dark-yellow', label: 'Amber', colors: ['#222831', '#EEEEEE', '#FFD369'], icon: Star },
  { value: 'dark-violet', label: 'Violet', colors: ['#0F0B1E', '#E9D5FF', '#A78BFA'], icon: Gem },
  { value: 'dark-warm-brown', label: 'Mocha', colors: ['#2D2424', '#E0C097', '#B85C38'], icon: Coffee },
  { value: 'dark-blue-grey', label: 'Steel', colors: ['#222831', '#EEEEEE', '#76ABAE'], icon: Anchor },
  { value: 'dark-cream-green', label: 'Sage', colors: ['#2C3639', '#DCD7C9', '#A27B5C'], icon: Leaf },
  { value: 'sky-blue', label: 'Sky', colors: ['#F9F7F7', '#112D4E', '#3F72AF'], icon: Cloud },
  { value: 'cream', label: 'Cream', colors: ['#FFF2D8', '#113946', '#BCA37F'], icon: Milk },
  { value: 'cream-indigo', label: 'Ocean', colors: ['#0A1F2A', '#EAD7BB', '#FFF2D8'], icon: Waves },
  { value: 'light-violet', label: 'Lavender', colors: ['#F4EEFF', '#424874', '#A6B1E1'], icon: Flower2 },
  { value: 'hacker-green', label: 'Matrix', colors: ['#000000', '#00FF41', '#00CC33'], icon: Terminal },
];

// Terminal themes - same as app themes but with separate storage/state
const terminalThemes: Theme[] = appThemes;

export function ThemeSelector({ 
  onThemeChange, 
  type = 'app' 
}: { 
  onThemeChange?: (theme: string) => void;
  type?: 'app' | 'terminal';
}) {
  const [selectedTheme, setSelectedTheme] = useState('default');
  const [open, setOpen] = useState(false);
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const themes = type === 'app' ? appThemes : terminalThemes;
  const storageKey = `${type}-theme`;

  // Apply theme to document
  const applyTheme = (theme: string) => {
    if (type !== 'app') return;
    const root = document.documentElement;
    
    if (theme === 'default') {
      root.removeAttribute('data-bs-theme');
      root.classList.remove('dark');
    } else {
      root.setAttribute('data-bs-theme', theme);
      root.classList.toggle('dark', theme === 'dark');
    }
  };

  // Initialize theme
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) || 'default';
    setSelectedTheme(stored);
    applyTheme(stored);
    onThemeChange?.(stored === 'default' ? '' : stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleChange = (value: string) => {
    setSelectedTheme(value);
    localStorage.setItem(storageKey, value);
    applyTheme(value);
    setOpen(false);
    onThemeChange?.(value === 'default' ? '' : value);
  };

  const current = themes.find(t => t.value === selectedTheme) || themes[0];
  const display = hoveredTheme ? themes.find(t => t.value === hoveredTheme)! : current;
  const DisplayIcon = display.icon;

  return (
    <div 
      ref={dropdownRef}
      className="relative"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative group rounded-full transition-all duration-300 ease-out flex items-center justify-center",
          "w-10 h-10 border-2 shadow-sm hover:shadow-md hover:scale-105 active:scale-95",
          open && "scale-105 shadow-lg ring-2 ring-primary/20"
        )}
        style={{
          backgroundColor: current.colors[0],
          borderColor: current.colors[2],
        }}
        title={`Theme: ${current.label}`}
      >
        <Palette 
          className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" 
          style={{ color: current.colors[1] }}
        />
      </button>

      {/* Radial Palette Wheel */}
      {open && (
        <div className="absolute right-0 top-full mt-4 z-50">
          <div 
            className="relative bg-background rounded-lg border shadow-lg overflow-visible p-5"
            style={{ width: type === 'app' ? '340px' : '280px' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-10 h-10 rounded-full border-2 shadow-md flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: display.colors[0],
                  borderColor: display.colors[2],
                }}
              >
                <DisplayIcon className="h-5 w-5" style={{ color: display.colors[1] }} />
              </div>
              <div>
                <p className="text-sm font-semibold">{display.label}</p>
                <p className="text-xs text-muted-foreground capitalize">{type} Theme</p>
              </div>
            </div>

            {/* Wheel */}
            <div 
              className="relative mx-auto"
              style={{ 
                width: type === 'app' ? '280px' : '220px',
                height: type === 'app' ? '280px' : '220px',
              }}
            >
              {/* Center Preview */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div 
                  className="w-20 h-20 rounded-full border-2 shadow-xl transition-all duration-500 flex items-center justify-center z-10"
                  style={{
                    backgroundColor: display.colors[0],
                    borderColor: display.colors[2],
                  }}
                >
                  <span className="text-2xl font-bold" style={{ color: display.colors[1] }}>Aa</span>
                </div>
                <div className="absolute inset-8 rounded-full border border-dashed border-border/30" />
              </div>

              {/* Theme Orbs */}
              {themes.map((theme, index) => {
                const angle = (index * (360 / themes.length) - 90) * (Math.PI / 180);
                const radius = type === 'app' ? 115 : 88;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                const isSelected = selectedTheme === theme.value;
                const isHovered = hoveredTheme === theme.value;
                const Icon = theme.icon;

                return (
                  <button
                    key={theme.value}
                    onClick={() => handleChange(theme.value)}
                    onMouseEnter={() => setHoveredTheme(theme.value)}
                    onMouseLeave={() => setHoveredTheme(null)}
                    className={cn(
                      "absolute w-10 h-10 rounded-full transition-all duration-300 ease-out flex items-center justify-center",
                      "hover:z-20 focus:outline-none shadow-sm border-2",
                      isSelected ? "scale-110 z-20 shadow-lg ring-2 ring-primary ring-offset-2 ring-offset-popover" : "scale-100 z-10",
                      isHovered && !isSelected && "scale-125 z-20 shadow-md"
                    )}
                    style={{
                      left: `calc(50% + ${x}px - 20px)`,
                      top: `calc(50% + ${y}px - 20px)`,
                      backgroundColor: theme.colors[0],
                      borderColor: theme.colors[2],
                    }}
                    title={theme.label}
                  >
                    {isSelected ? (
                      <Check className="h-5 w-5" style={{ color: theme.colors[1] }} />
                    ) : (
                      <Icon className="h-4 w-4 opacity-80" style={{ color: theme.colors[1] }} />
                    )}

                    {/* Tooltip */}
                    <div className={cn(
                      "absolute left-1/2 -translate-x-1/2 px-2 py-1 bg-popover text-popover-foreground border rounded-md shadow-md",
                      "text-[11px] font-medium whitespace-nowrap flex items-center gap-1.5 pointer-events-none transition-all duration-200",
                      (isHovered || isSelected) ? "opacity-100 -bottom-9" : "opacity-0 -bottom-6"
                    )}>
                      <Icon className="h-3 w-3" style={{ color: theme.colors[2] }} />
                      <span>{theme.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
