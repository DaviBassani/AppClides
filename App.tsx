import React, { useState, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import Chat from './components/Chat';
import TabsBar from './components/TabsBar';
import { ToolType } from './types';
import { useWorkspaces } from './hooks/useWorkspaces';
import { ZoomIn, ZoomOut, Maximize, Grid3x3, Magnet, MessageSquare, EllipsisVertical, X } from 'lucide-react';
import clsx from 'clsx';

const App: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<ToolType>(ToolType.SELECT);
  
  // Canvas View State
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Custom Hook managing all workspace logic
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
  
  useEffect(() => {
    handleResetView();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

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

  // --- Buttons Component (Reused for Mobile and Desktop) ---
  const ActionButtons = ({ layout = 'col' }: { layout?: 'col' | 'row' }) => {
    // Defines fixed dimensions for buttons to ensure perfect centering
    const btnSize = layout === 'col' ? "w-10 h-10 md:w-9 md:h-9" : "w-12 h-12";
    // Added p-0 to explicitly remove padding and rely on flex centering
    const baseClass = "rounded-lg transition-colors active:scale-95 flex items-center justify-center shadow-sm p-0";

    return (
      <>
        <button 
          onClick={() => setSnapToGrid(!snapToGrid)} 
          className={clsx(
            baseClass, btnSize,
            snapToGrid ? "text-amber-600 bg-amber-50" : "text-slate-600 hover:bg-slate-100 bg-white"
          )} 
          title="Imã (Snap)"
        >
           <Magnet size={20} />
        </button>
        <button 
          onClick={() => setShowGrid(!showGrid)} 
          className={clsx(
            baseClass, btnSize,
            showGrid ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-100 bg-white"
          )} 
          title="Grade"
        >
           <Grid3x3 size={20} />
        </button>
        
        {layout === 'col' && <div className="h-px bg-slate-200 mx-1 my-0.5 md:block hidden w-6 self-center" />}
        
        <button onClick={handleZoomIn} className={clsx(baseClass, btnSize, "text-slate-600 hover:bg-slate-100 bg-white")}>
           <ZoomIn size={20} />
        </button>
        <button onClick={handleZoomOut} className={clsx(baseClass, btnSize, "text-slate-600 hover:bg-slate-100 bg-white")}>
           <ZoomOut size={20} />
        </button>
        <button onClick={handleResetView} className={clsx(baseClass, btnSize, "text-slate-600 hover:bg-slate-100 bg-white")}>
           <Maximize size={20} />
        </button>
  
        {layout === 'col' && <div className="h-px bg-slate-200 mx-1 my-0.5 md:block hidden w-6 self-center" />}
        
        <button 
          onClick={() => {
              setIsChatOpen(!isChatOpen);
              if (isMobileMenuOpen) setIsMobileMenuOpen(false);
          }}
          className={clsx(
            baseClass, btnSize,
            isChatOpen ? "bg-indigo-600 text-white shadow-md" : "text-indigo-600 hover:bg-indigo-50 bg-white"
          )}
        >
           <MessageSquare size={20} />
        </button>
      </>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans touch-none">
      
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
        
        {/* DESKTOP Right Toolbar: Static Column */}
        <div className="hidden md:flex absolute top-6 right-6 flex-col items-center gap-2 bg-white/90 backdrop-blur shadow-lg rounded-xl p-1.5 border border-slate-200 z-10">
           <ActionButtons layout="col" />
        </div>

        {/* MOBILE Right Toolbar: Collapsible Speed Dial */}
        {/* Changed items-end to items-center to align stack with trigger button center */}
        <div className="md:hidden absolute bottom-28 right-4 z-20 flex flex-col items-center gap-3 pointer-events-none">
            {/* The list of actions (expands upwards) */}
            <div className={clsx(
                "flex flex-col items-center gap-3 transition-all duration-300 origin-bottom pb-2",
                isMobileMenuOpen 
                    ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" 
                    : "opacity-0 translate-y-10 scale-90 pointer-events-none"
            )}>
               <ActionButtons layout="col" />
            </div>

            {/* The Trigger Button */}
            <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={clsx(
                    "pointer-events-auto w-14 h-14 rounded-full shadow-xl transition-all duration-300 active:scale-90 flex items-center justify-center border border-slate-100 p-0",
                    isMobileMenuOpen ? "bg-slate-800 text-white rotate-90" : "bg-white text-slate-700"
                )}
            >
                {isMobileMenuOpen ? <X size={24} /> : <EllipsisVertical size={24} />}
            </button>
        </div>

        <main className="absolute inset-0 z-0">
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