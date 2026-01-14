import { useEffect } from 'react';
import { ToolType } from '../types';

interface UseGlobalShortcutsProps {
    onUndo: () => void;
    onRedo: () => void;
    onSelectTool: (tool: ToolType) => void;
}

export const useGlobalShortcuts = ({ onUndo, onRedo, onSelectTool }: UseGlobalShortcutsProps) => {
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
          switch(e.key.toLowerCase()) {
            case 'p': onSelectTool(ToolType.POINT); break;
            case 's': onSelectTool(ToolType.SEGMENT); break;
            case 'r': onSelectTool(ToolType.LINE); break;
            case 'c': onSelectTool(ToolType.CIRCLE); break;
            case 'escape': onSelectTool(ToolType.SELECT); break;
            case 'delete': onSelectTool(ToolType.ERASER); break;
          }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, [onUndo, onRedo, onSelectTool]);
};