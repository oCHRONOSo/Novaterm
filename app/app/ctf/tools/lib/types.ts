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
  basic: 'bg-green-500/10 text-green-500 border-green-500/30',
  intermediate: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  advanced: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  expert: 'bg-red-500/10 text-red-500 border-red-500/30',
};

export const levelLabels = {
  basic: 'Basic',
  intermediate: 'Intermediate', 
  advanced: 'Advanced',
  expert: 'Expert',
};

