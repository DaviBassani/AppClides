import { ToolType } from './types';
import { MousePointer2, Circle, Minus, MoveHorizontal, ArrowRightFromLine, Eraser, Dot, Undo2, Redo2, Type } from 'lucide-react';

export const SNAP_DISTANCE = 15;

export const TOOLS = [
  { id: ToolType.SELECT, icon: MousePointer2, shortcut: '1' },
  { id: ToolType.POINT, icon: Dot, shortcut: '2' },
  { id: ToolType.SEGMENT, icon: Minus, shortcut: '3' },
  { id: ToolType.LINE, icon: MoveHorizontal, shortcut: '4' }, // Line with arrows on both ends (infinite both directions)
  { id: ToolType.RAY, icon: ArrowRightFromLine, shortcut: '5' }, // Arrow leaving a point (semi-infinite)
  { id: ToolType.CIRCLE, icon: Circle, shortcut: '6' },
  { id: ToolType.TEXT, icon: Type, shortcut: '7' },
  { id: ToolType.ERASER, icon: Eraser, shortcut: '8' },
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
  selection: '#818cf8', // indigo-400
  text: '#334155', // slate-700
};

export const PALETTE = [
  { id: 'default', value: '#3b82f6', label: 'Azul' },    // blue-500
  { id: 'red', value: '#ef4444', label: 'Vermelho' },    // red-500
  { id: 'green', value: '#22c55e', label: 'Verde' },     // green-500
  { id: 'orange', value: '#f97316', label: 'Laranja' },  // orange-500
  { id: 'purple', value: '#a855f7', label: 'Roxo' },     // purple-500
  { id: 'black', value: '#1e293b', label: 'Preto' },     // slate-800
];