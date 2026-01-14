import React from 'react';
import { TOOLS, ICONS } from '../constants';
import { ToolType } from '../types';
import clsx from 'clsx';

interface ToolbarProps {
  selectedTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  selectedTool, 
  onSelectTool, 
  onClear, 
  onUndo, 
  onRedo, 
  canUndo, 
  canRedo 
}) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-[95vw] md:w-auto">
      <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-2xl p-1.5 flex gap-1 border border-slate-200 overflow-x-auto no-scrollbar mx-auto w-fit max-w-full">
        
        {/* Undo / Redo Group */}
        <div className="flex gap-1 shrink-0">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-3 md:p-3 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
            title="Desfazer"
          >
            <ICONS.Undo size={22} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-3 md:p-3 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
            title="Refazer"
          >
            <ICONS.Redo size={22} />
          </button>
        </div>

        <div className="w-px bg-slate-200 my-1 shrink-0" />

        {/* Tools Group */}
        <div className="flex gap-1 shrink-0">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isSelected = selectedTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => onSelectTool(tool.id)}
                className={clsx(
                  "p-3 rounded-xl flex flex-col items-center justify-center transition-all duration-200 group relative active:scale-95",
                  isSelected
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
                title={tool.label}
              >
                <Icon size={24} strokeWidth={isSelected ? 2.5 : 2} />
              </button>
            );
          })}
        </div>
        
        <div className="w-px bg-slate-200 mx-1 shrink-0" />
        
        <button
          onClick={onClear}
          className="p-3 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium text-sm shrink-0 whitespace-nowrap active:scale-95"
        >
          Limpar
        </button>
      </div>
    </div>
  );
};

export default Toolbar;