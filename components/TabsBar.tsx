import React, { useState } from 'react';
import { Plus, X, Layout } from 'lucide-react';
import clsx from 'clsx';
import { Workspace } from '../types';

interface TabsBarProps {
  workspaces: Workspace[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onClose: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

const TabsBar: React.FC<TabsBarProps> = ({ 
  workspaces, 
  activeId, 
  onSwitch, 
  onAdd, 
  onClose,
  onRename
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const finishEditing = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') finishEditing();
    if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <div className="flex items-center bg-slate-200 border-b border-slate-300 px-2 pt-2 gap-1 overflow-x-auto select-none h-10 min-h-[40px]">
      <div className="flex items-center mr-2 text-slate-500">
        <Layout size={18} />
      </div>
      
      {workspaces.map((ws) => {
        const isActive = ws.id === activeId;
        return (
          <div
            key={ws.id}
            onClick={() => onSwitch(ws.id)}
            onDoubleClick={() => startEditing(ws.id, ws.name)}
            className={clsx(
              "group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-sm max-w-[200px] cursor-pointer transition-all relative",
              isActive 
                ? "bg-slate-50 text-slate-800 font-medium shadow-sm border-t border-x border-slate-300 -mb-px pb-2 z-10" 
                : "bg-slate-200 text-slate-600 hover:bg-slate-100/50 hover:text-slate-800"
            )}
          >
            {editingId === ws.id ? (
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={finishEditing}
                onKeyDown={handleKeyDown}
                className="w-24 bg-transparent outline-none border-b border-blue-500 px-0 py-0"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate">{ws.name}</span>
            )}

            {workspaces.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(ws.id);
                }}
                className={clsx(
                  "opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-slate-300 transition-all",
                  isActive ? "text-slate-400 hover:text-red-500" : "text-slate-400"
                )}
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}

      <button
        onClick={onAdd}
        className="p-1.5 ml-1 rounded-md hover:bg-slate-300 text-slate-500 transition-colors"
        title="Nova Demonstração"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};

export default TabsBar;