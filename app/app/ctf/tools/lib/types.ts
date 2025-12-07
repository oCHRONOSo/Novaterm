export type ToolArg = {
  name: string;
  flag?: string;
  placeholder: string;
  description: string;
  required: boolean;
  type: 'text' | 'select' | 'number' | 'checkbox' | 'textarea';
  options?: { value: string; label: string }[];
  default?: string;
};

export type CommandPreset = {
  id: string;
  name: string;
  level: 'basic' | 'intermediate' | 'advanced' | 'expert';
  description: string;
  command: string;
  args: ToolArg[];
  notes?: string[];
  tips?: string[];
  dangerous?: boolean;
};

export type Tool = {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  installCmd: string;
  checkCmd: string;
  documentation?: string;
  tips?: string[];
  presets: CommandPreset[];
};

export type ToolStatus = 'unknown' | 'checking' | 'installed' | 'not_installed' | 'installing';

export const levelColors = {
  basic: 'bg-primary/10 text-primary border-primary/30',
  intermediate: 'bg-primary/20 text-primary border-primary/30',
  advanced: 'bg-accent/10 text-accent-foreground border-accent/30',
  expert: 'bg-destructive/10 text-destructive border-destructive/30',
};

export const levelLabels = {
  basic: 'Basic',
  intermediate: 'Intermediate', 
  advanced: 'Advanced',
  expert: 'Expert',
};

