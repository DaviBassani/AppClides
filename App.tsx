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
import { getBrowserLanguage, Language, t } from './utils/i18n';

const App: React.FC = () => {
  // Localization State
  const [lang, setLang] = useState<Language>(getBrowserLanguage());

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
    updatePoints, updateShapes, updateTexts, clearActiveWorkspace, deleteSelection,
    undo, redo, canUndo, canRedo
  } = useWorkspaces();

  // Initialize view
  useEffect(() => {
    setView({ x: window.innerWidth / 2, y: window.innerHeight / 2, k: 1 });
  }, []);

  // Update document language and title metadata
  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    document.title = lang === 'pt' ? 'Euclides Web - Geometria' : 'Euclides Web - Geometry';
  }, [lang]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Wrap deleteSelection to pass current selection
  const handleDelete = () => {
      deleteSelection(selectedIds);
      setSelectedIds([]); // Clear selection after delete
  };

  const handleClear = () => {
      clearActiveWorkspace();
      setSelectedIds([]);
  };

  const viewControlsProps = {
      snapToGrid,
      setSnapToGrid,
      showGrid,
      setShowGrid,
      onZoomIn: () => setView(prev => ({ ...prev, k: Math.min(50, prev.k * 1.2) })),
      onZoomOut: () => setView(prev => ({ ...prev, k: Math.max(0.1, prev.k / 1.2) })),
      onResetView: () => setView({ x: window.innerWidth / 2, y: window.innerHeight / 2, k: 1 }),
      isChatOpen,
      setIsChatOpen,
      lang
  };

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans touch-none">
      
      {/* Global Shortcuts Listener with access to App State */}
      <GlobalShortcutsHandler 
         onUndo={undo} 
         onRedo={redo} 
         onSelectTool={setSelectedTool} 
         onDelete={handleDelete}
      />

      <TabsBar 
        workspaces={workspaces}
        activeId={activeWorkspaceId}
        onSwitch={setActiveWorkspaceId}
        onAdd={() => addWorkspace(t[lang].tabs.untitled)}
        onClose={removeWorkspace}
        onRename={renameWorkspace}
        lang={lang}
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
          lang={lang}
        />
        
        {/* DESKTOP Right Toolbar: Static Column */}
        <div className="hidden md:flex absolute bottom-6 right-6 flex-col items-center gap-2 bg-white/90 backdrop-blur shadow-lg rounded-xl p-1.5 border border-slate-200 z-10">
           <ViewControls {...viewControlsProps} layout="col" />
        </div>

        {/* MOBILE Right Toolbar: Collapsible Speed Dial */}
        <div className="md:hidden absolute bottom-24 right-4 z-20 flex flex-col items-center gap-3 pointer-events-none mb-safe">
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
                    "pointer-events-auto w-12 h-12 rounded-full shadow-xl transition-all duration-300 active:scale-90 flex items-center justify-center border border-slate-100 p-0",
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
            texts={activeWorkspace.texts}
            setPoints={updatePoints}
            setShapes={updateShapes}
            setTexts={updateTexts}
            view={view}
            setView={setView}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
            lang={lang}
            // Pass selection state down
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
          />
        </main>
      </div>

      <Chat 
        activeWorkspace={activeWorkspace}
        setPoints={updatePoints}
        setShapes={updateShapes}
        setTexts={updateTexts}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        lang={lang}
      />
    </div>
  );
};

// Extracted to avoid hook rules issues inside conditional returns or loops, 
// and to clearly separate the key listener from the render logic.
const GlobalShortcutsHandler: React.FC<{
    onUndo: () => void;
    onRedo: () => void;
    onSelectTool: (t: ToolType) => void;
    onDelete: () => void;
}> = (props) => {
    useGlobalShortcuts(props);
    return null;
}

export default App;