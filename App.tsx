import React, { useState, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import Chat from './components/Chat';
import TabsBar from './components/TabsBar';
import { ToolType, Point, GeometricShape, Workspace } from './types';
import { generateId } from './utils/geometry';

const createWorkspace = (name: string): Workspace => ({
  id: generateId(),
  name,
  points: {},
  shapes: [],
  createdAt: Date.now(),
});

const App: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<ToolType>(ToolType.SELECT);
  
  // Workspace State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([createWorkspace('Demonstração 1')]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(workspaces[0].id);

  // Computed active workspace data
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  // Initialize with some demo data in the first tab if empty
  useEffect(() => {
    // Only add demo data if it's the very first load
    if (workspaces.length === 1 && Object.keys(workspaces[0].points).length === 0) {
       const idA = 'demo_A';
       const idB = 'demo_B';
       const idC = 'demo_C';
       
       const w = window.innerWidth;
       const h = window.innerHeight;
       const cx = w / 2;
       const cy = h / 2;

       setWorkspaces(prev => {
         const newWs = [...prev];
         newWs[0] = {
           ...newWs[0],
           points: {
            [idA]: { id: idA, x: cx - 100, y: cy + 50, label: 'A' },
            [idB]: { id: idB, x: cx + 100, y: cy + 50, label: 'B' },
            [idC]: { id: idC, x: cx, y: cy - 120, label: 'C' },
           },
           shapes: [
            { id: 's1', type: 'segment', p1: idA, p2: idB },
            { id: 's2', type: 'segment', p1: idB, p2: idC },
            { id: 's3', type: 'segment', p1: idC, p2: idA },
            { id: 'c1', type: 'circle', p1: idC, p2: idA }
           ]
         };
         return newWs;
       });
    }
  }, []); // Run once

  // --- Workspace Wrappers for Canvas ---
  
  // Wrapper to update points for the active workspace
  const handleSetPoints: React.Dispatch<React.SetStateAction<Record<string, Point>>> = (action) => {
    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== activeWorkspaceId) return ws;
      const newPoints = typeof action === 'function' ? action(ws.points) : action;
      return { ...ws, points: newPoints };
    }));
  };

  // Wrapper to update shapes for the active workspace
  const handleSetShapes: React.Dispatch<React.SetStateAction<GeometricShape[]>> = (action) => {
    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== activeWorkspaceId) return ws;
      const newShapes = typeof action === 'function' ? action(ws.shapes) : action;
      return { ...ws, shapes: newShapes };
    }));
  };

  // --- Tab Management ---

  const handleAddTab = () => {
    const newWs = createWorkspace(`Demonstração ${workspaces.length + 1}`);
    setWorkspaces(prev => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);
  };

  const handleCloseTab = (id: string) => {
    if (workspaces.length <= 1) return;
    
    const newWorkspaces = workspaces.filter(w => w.id !== id);
    setWorkspaces(newWorkspaces);
    
    // If we closed the active one, switch to the last one
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(newWorkspaces[newWorkspaces.length - 1].id);
    }
  };

  const handleRenameTab = (id: string, newName: string) => {
    setWorkspaces(prev => prev.map(ws => ws.id === id ? { ...ws, name: newName } : ws));
  };

  const handleClear = () => {
    if (window.confirm(`Tem certeza que deseja limpar o quadro "${activeWorkspace.name}"?`)) {
      handleSetPoints({});
      handleSetShapes([]);
      setSelectedTool(ToolType.SELECT);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch(e.key.toLowerCase()) {
        case 'p': setSelectedTool(ToolType.POINT); break;
        case 's': setSelectedTool(ToolType.SEGMENT); break;
        case 'r': setSelectedTool(ToolType.LINE); break;
        case 'c': setSelectedTool(ToolType.CIRCLE); break;
        case 'escape': setSelectedTool(ToolType.SELECT); break;
        case 'delete': setSelectedTool(ToolType.ERASER); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 relative overflow-hidden">
      
      {/* Tabs Bar */}
      <TabsBar 
        workspaces={workspaces}
        activeId={activeWorkspaceId}
        onSwitch={setActiveWorkspaceId}
        onAdd={handleAddTab}
        onClose={handleCloseTab}
        onRename={handleRenameTab}
      />

      <div className="flex-1 relative w-full h-full">
        <Toolbar 
          selectedTool={selectedTool} 
          onSelectTool={setSelectedTool}
          onClear={handleClear}
        />
        
        <main className="absolute inset-0">
          {/* Key prop ensures Canvas remounts and resets view state when tab changes */}
          <Canvas 
            key={activeWorkspace.id} 
            tool={selectedTool}
            points={activeWorkspace.points}
            shapes={activeWorkspace.shapes}
            setPoints={handleSetPoints}
            setShapes={handleSetShapes}
          />
        </main>
      </div>

      <Chat 
        activeWorkspace={activeWorkspace}
        setPoints={handleSetPoints}
        setShapes={handleSetShapes}
      />
    </div>
  );
};

export default App;