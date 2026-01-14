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

          switch(e.key.toLowerCase()) {
            case 'p': onSelectTool(ToolType.POINT); break;
            case 's': onSelectTool(ToolType.SEGMENT); break;
            case 'r': onSelectTool(ToolType.LINE); break;
            case 'c': onSelectTool(ToolType.CIRCLE); break;
            case 'escape': onSelectTool(ToolType.SELECT); break;
            case 'e': onSelectTool(ToolType.ERASER); break;
          }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, [onUndo, onRedo, onSelectTool, onDelete]);
};