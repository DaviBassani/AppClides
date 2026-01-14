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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-2 flex gap-2 border border-slate-200 z-10 transition-all hover:shadow-xl">
      
      {/* Undo / Redo Group */}
      <div className="flex gap-1 mr-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-3 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Desfazer (Ctrl+Z)"
        >
          <ICONS.Undo size={20} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-3 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Refazer (Ctrl+Shift+Z)"
        >
          <ICONS.Redo size={20} />
        </button>
      </div>

      <div className="w-px bg-slate-200 my-1" />

      {/* Tools Group */}
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isSelected = selectedTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            className={clsx(
              "p-3 rounded-xl flex flex-col items-center justify-center transition-all duration-200 group relative",
              isSelected
                ? "bg-blue-600 text-white shadow-md scale-105"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            )}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <Icon size={24} strokeWidth={isSelected ? 2.5 : 2} />
            <span className="sr-only">{tool.label}</span>
            
            {/* Tooltip */}
            <span className="absolute -bottom-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-50">
              {tool.label}
            </span>
          </button>
        );
      })}
      
      <div className="w-px bg-slate-200 mx-1" />
      
      <button
        onClick={onClear}
        className="p-3 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium text-sm"
        title="Limpar Quadro"
      >
        Limpar
      </button>
    </div>
  );
};

export default Toolbar;