import { useEffect } from 'react';
import { ToolType } from '../types';

interface UseGlobalShortcutsProps {
    onUndo: () => void;
    onRedo: () => void;
    onSelectTool: (tool: ToolType) => void;
    onDelete: () => void;
}

export const useGlobalShortcuts = ({ onUndo, onRedo, onSelectTool, onDelete }: UseGlobalShortcutsProps) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
            if (e.shiftKey) {
              e.preventDefault();
              onRedo();
            } else {
              e.preventDefault();
              onUndo();
            }
            return;
          }
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            onRedo();
            return;
          }

          // Delete Selection
          if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault();
              onDelete();
              return;
          }

          // Numeric shortcuts (1-8) map to toolbar order
          const numericTools: ToolType[] = [
            ToolType.SELECT,
            ToolType.POINT,
            ToolType.SEGMENT,
            ToolType.LINE,
            ToolType.RAY,
            ToolType.CIRCLE,
            ToolType.TEXT,
            ToolType.ERASER
          ];
          const numericIndex = parseInt(e.key, 10) - 1;
          if (numericIndex >= 0 && numericIndex < numericTools.length) {
            onSelectTool(numericTools[numericIndex]);
            return;
          }

          switch(e.key.toLowerCase()) {
            case 'p': onSelectTool(ToolType.POINT); break;
            case 's': onSelectTool(ToolType.SEGMENT); break;
            case 'r': onSelectTool(ToolType.LINE); break;
            case 'y': onSelectTool(ToolType.RAY); break;
            case 'c': onSelectTool(ToolType.CIRCLE); break;
            case 't': onSelectTool(ToolType.TEXT); break;
            case 'escape': onSelectTool(ToolType.SELECT); break;
            case 'e': onSelectTool(ToolType.ERASER); break;
          }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, [onUndo, onRedo, onSelectTool, onDelete]);
};