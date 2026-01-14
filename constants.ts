import { ToolType } from './types';
import { MousePointer2, Circle, Minus, Activity, XCircle, Dot, Undo2, Redo2 } from 'lucide-react';

export const SNAP_DISTANCE = 15;

export const TOOLS = [
  { id: ToolType.SELECT, label: 'Mover', icon: MousePointer2, shortcut: 'Esc' },
  { id: ToolType.POINT, label: 'Ponto', icon: Dot, shortcut: 'P' },
  { id: ToolType.SEGMENT, label: 'Segmento', icon: Minus, shortcut: 'S' },
  { id: ToolType.LINE, label: 'Reta', icon: Activity, shortcut: 'R' }, // Using Activity as a proxy for infinite line visual
  { id: ToolType.CIRCLE, label: 'Círculo', icon: Circle, shortcut: 'C' },
  { id: ToolType.ERASER, label: 'Apagar', icon: XCircle, shortcut: 'Del' },
];

export const ICONS = {
  Undo: Undo2,
  Redo: Redo2
};

export const COLORS = {
  primary: '#3b82f6', // blue-500
  secondary: '#64748b', // slate-500
  accent: '#f59e0b', // amber-500
  point: '#1e293b', // slate-800
  grid: '#e2e8f0', // slate-200
};