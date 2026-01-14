import React, { useState, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import Chat from './components/Chat';
import TabsBar from './components/TabsBar';
import ViewControls from './components/ViewControls';
import { ToolType } from './types';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { EllipsisVertical, X } from 'lucide-react';
import clsx from 'clsx';

const App: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<ToolType>(ToolType.SELECT);
  
  // Canvas View State
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Custom Hook managing all workspace logic
  const {
    workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspaceId,
    addWorkspace, removeWorkspace, renameWorkspace,
    updatePoints, updateShapes, clearActiveWorkspace,
    undo, redo, canUndo, canRedo
  } = useWorkspaces();

  // Initialize view
  useEffect(() => {
    setView({ x: window.innerWidth / 2, y: window.innerHeight / 2, k: 1 });
  }, []);

  // Global Shortcuts
  useGlobalShortcuts({ onUndo: undo, onRedo: redo, onSelectTool: setSelectedTool });

  // --- View Handlers ---

  const handleClear = () => {
    clearActiveWorkspace();
    setSelectedTool(ToolType.SELECT);
  };

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
  
  // Combine view control props
  const viewControlsProps = {
    snapToGrid, setSnapToGrid,
    showGrid, setShowGrid,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetView: handleResetView,
    isChatOpen, setIsChatOpen
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans touch-none">
      
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
           <ViewControls {...viewControlsProps} layout="col" />
        </div>

        {/* MOBILE Right Toolbar: Collapsible Speed Dial */}
        <div className="md:hidden absolute bottom-28 right-4 z-20 flex flex-col items-center gap-3 pointer-events-none">
            <div className={clsx(
                "flex flex-col items-center gap-3 transition-all duration-300 origin-bottom pb-2",
                isMobileMenuOpen 
                    ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" 
                    : "opacity-0 translate-y-10 scale-90 pointer-events-none"
            )}>
               <ViewControls 
                {...viewControlsProps} 
                setIsChatOpen={(v) => {
                    setIsChatOpen(v);
                    setIsMobileMenuOpen(false);
                }}
                layout="col" 
               />
            </div>

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