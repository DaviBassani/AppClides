import React from 'react';
import { PALETTE } from '../constants';

interface StyleMenuProps {
  selectedCount: number;
  onUpdateColor: (color: string) => void;
}

const StyleMenu: React.FC<StyleMenuProps> = ({ selectedCount, onUpdateColor }) => {
  if (selectedCount === 0) return null;

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div 
      // Moved from bottom-20 to bottom-28 (mobile) to clear the safe-area toolbar
      className="absolute z-20 left-1/2 -translate-x-1/2 bottom-28 md:bottom-20 animate-in fade-in slide-in-from-bottom-2 duration-300 mb-safe"
      onMouseDown={stopPropagation}
      onMouseUp={stopPropagation}
      onTouchStart={stopPropagation}
      onTouchEnd={stopPropagation}
      onClick={stopPropagation}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-2 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 px-2 uppercase tracking-wider">
           {selectedCount} {selectedCount === 1 ? 'Item' : 'Items'}
        </span>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex gap-1.5">
            {PALETTE.map((color) => (
                <button
                    key={color.id}
                    onClick={() => onUpdateColor(color.value)}
                    className="w-6 h-6 rounded-full border border-slate-200 hover:scale-110 active:scale-95 transition-all shadow-sm focus:outline-none focus:ring-2 ring-offset-1 ring-blue-400"
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                />
            ))}
        </div>
      </div>
    </div>
  );
};

export default StyleMenu;