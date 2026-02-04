import { Sparkles, Heart, Lightbulb, AlertTriangle, LucideIcon } from "lucide-react";

export const NOTE_TYPES = {
  fact: {
    label: 'Ciekawostka',
    icon: Sparkles,
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-500',
    labelColor: 'text-amber-600 dark:text-amber-400',
    hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-950/30',
    hoverBorder: 'hover:border-amber-300 dark:hover:border-amber-700',
    activeBg: 'bg-amber-100 dark:bg-amber-900/50',
    activeBorder: 'border-amber-400 dark:border-amber-600',
  },
  experience: {
    label: 'Doświadczenie',
    icon: Heart,
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    borderColor: 'border-rose-200 dark:border-rose-800',
    iconColor: 'text-rose-500',
    labelColor: 'text-rose-600 dark:text-rose-400',
    hoverBg: 'hover:bg-rose-50 dark:hover:bg-rose-950/30',
    hoverBorder: 'hover:border-rose-300 dark:hover:border-rose-700',
    activeBg: 'bg-rose-100 dark:bg-rose-900/50',
    activeBorder: 'border-rose-400 dark:border-rose-600',
  },
  tip: {
    label: 'Rada',
    icon: Lightbulb,
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-500',
    labelColor: 'text-blue-600 dark:text-blue-400',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
    hoverBorder: 'hover:border-blue-300 dark:hover:border-blue-700',
    activeBg: 'bg-blue-100 dark:bg-blue-900/50',
    activeBorder: 'border-blue-400 dark:border-blue-600',
  },
  warning: {
    label: 'Ostrzeżenie',
    icon: AlertTriangle,
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    iconColor: 'text-orange-500',
    labelColor: 'text-orange-600 dark:text-orange-400',
    hoverBg: 'hover:bg-orange-50 dark:hover:bg-orange-950/30',
    hoverBorder: 'hover:border-orange-300 dark:hover:border-orange-700',
    activeBg: 'bg-orange-100 dark:bg-orange-900/50',
    activeBorder: 'border-orange-400 dark:border-orange-600',
  },
} as const;

export type NoteType = keyof typeof NOTE_TYPES;

export interface NoteTypeConfig {
  label: string;
  icon: LucideIcon;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  labelColor: string;
  hoverBg: string;
  hoverBorder: string;
  activeBg: string;
  activeBorder: string;
}

export const getNoteTypeConfig = (noteType: NoteType | string | undefined): NoteTypeConfig => {
  const type = noteType && noteType in NOTE_TYPES ? noteType as NoteType : 'fact';
  return NOTE_TYPES[type];
};

export const NOTE_TYPE_KEYS = Object.keys(NOTE_TYPES) as NoteType[];
