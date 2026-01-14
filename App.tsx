import React, { useState, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import Chat from './components/Chat';
import TabsBar from './components/TabsBar';
import { ToolType } from './types';
import { useWorkspaces } from './hooks/useWorkspaces';
import { ZoomIn, ZoomOut, Maximize, Grid3x3, Magnet, MessageSquare } from 'lucide-react';
import clsx from 'clsx';

const App: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<ToolType>(ToolType.SELECT);
  
  // Canvas View State lifted to App
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Custom Hook managing all workspace logic, persistence, and history
  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    setActiveWorkspaceId,
    addWorkspace,
    removeWorkspace,
    renameWorkspace,
    updatePoints,
    updateShapes,
    clearActiveWorkspace,
    undo,
    redo,
    canUndo,
    canRedo
  } = useWorkspaces();

  const handleClear = () => {
    // Simply clear without confirmation for better UX, relying on Undo if accidental
    clearActiveWorkspace();
    setSelectedTool(ToolType.SELECT);
  };

  // View Helpers
  const handleZoomIn = () => {
    setView(prev => {
      const k = Math.min(50, prev.k * 1.2);
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const worldX = (cx - prev.x) / prev.k;
      const worldY = (cy - prev.y) / prev.k;
      return { ...prev, k, x: cx - worldX * k, y: cy - worldY * k };
    });
  };

  const handleZoomOut = () => {
    setView(prev => {
      const k = Math.max(0.1, prev.k / 1.2);
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const worldX = (cx - prev.x) / prev.k;
      const worldY = (cy - prev.y) / prev.k;
      return { ...prev, k, x: cx - worldX * k, y: cy - worldY * k };
    });
  };

  const handleResetView = () => {
    setView({ x: window.innerWidth / 2, y: window.innerHeight / 2, k: 1 });
  };
  
  // Initialize view center once on mount
  useEffect(() => {
    handleResetView();
  }, []);

  // Keyboard shortcuts configuration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Prevent shortcuts when typing in inputs
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Undo / Redo Shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Tool Shortcuts
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
  }, [undo, redo]); 

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Tabs Bar */}
      <TabsBar 
        workspaces={workspaces}
        activeId={activeWorkspaceId}
        onSwitch={setActiveWorkspaceId}
        onAdd={addWorkspace}
        onClose={removeWorkspace}
        onRename={renameWorkspace}
      />

      <div className="flex-1 relative w-full h-full">
        <Toolbar 
          selectedTool={selectedTool} 
          onSelectTool={setSelectedTool}
          onClear={handleClear}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        
        {/* Right Toolbar */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 bg-white/90 backdrop-blur shadow-lg rounded-xl p-1.5 border border-slate-200 z-10">
           <button 
             onClick={() => setSnapToGrid(!snapToGrid)} 
             className={clsx(
               "p-2 rounded-lg transition-colors",
               snapToGrid ? "text-amber-600 bg-amber-50" : "text-slate-600 hover:bg-slate-100"
             )} 
             title="Ativar Imã (Grade + Interseções)"
           >
              <Magnet size={20} />
           </button>
           <button 
             onClick={() => setShowGrid(!showGrid)} 
             className={clsx(
               "p-2 rounded-lg transition-colors",
               showGrid ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-100"
             )} 
             title="Alternar Grade"
           >
              <Grid3x3 size={20} />
           </button>
           <div className="h-px bg-slate-200 mx-1 my-0.5" />
           <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="Zoom In">
              <ZoomIn size={20} />
           </button>
           <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="Zoom Out">
              <ZoomOut size={20} />
           </button>
           <button onClick={handleResetView} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="Reset View">
              <Maximize size={20} />
           </button>
           <div className="h-px bg-slate-200 mx-1 my-0.5" />
           <button 
             onClick={() => setIsChatOpen(!isChatOpen)}
             className={clsx(
               "p-2 rounded-lg transition-all",
               isChatOpen ? "bg-indigo-600 text-white shadow-md" : "text-indigo-600 hover:bg-indigo-50"
             )}
             title="O Geômetra"
           >
              <MessageSquare size={20} />
           </button>
        </div>

        <main className="absolute inset-0">
          {/* Key prop ensures Canvas remounts/resets view state when switching tabs */}
          {/* Actually we might want to preserve view state per workspace, but keeping it simple for now (global view) or let it reset */}
          <Canvas 
            key={activeWorkspace.id} 
            tool={selectedTool}
            points={activeWorkspace.points}
            shapes={activeWorkspace.shapes}
            setPoints={updatePoints}
            setShapes={updateShapes}
            view={view}
            setView={setView}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
          />
        </main>
      </div>

      <Chat 
        activeWorkspace={activeWorkspace}
        setPoints={updatePoints}
        setShapes={updateShapes}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
};

export default App;