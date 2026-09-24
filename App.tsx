import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import TabsBar from './components/TabsBar';
import ViewControls from './components/ViewControls';
import ShareBar from './components/ShareBar';
import HamburgerMenu, { MenuItem } from './components/HamburgerMenu';
import { ToolType } from './types';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useCollab } from './hooks/useCollab';
import { Download, EllipsisVertical, FileUp, Image as ImageIcon, X } from 'lucide-react';
import clsx from 'clsx';
import { getBrowserLanguage, Language, t } from './utils/i18n';
import { useBoardFileTransfer } from './hooks/useBoardFileTransfer';
import { useElementAlignment } from './hooks/useElementAlignment';

// Chat is loaded lazily so katex, react-markdown and the markdown pipeline
// stay out of the initial bundle; the chunk is fetched on first open.
const Chat = lazy(() => import('./components/Chat'));

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
    addWorkspace, addImportedWorkspace, removeWorkspace, renameWorkspace,
    updatePoints, updateShapes, updateTexts, updateBoard, clearActiveWorkspace, deleteSelection,
    setLocalOpsHandler, setWorkspaceRoom, joinRoom,
    applyRemoteOpsToRoom, applyRemoteStateToRoom,
    undo, redo, canUndo, canRedo
  } = useWorkspaces();

  // Realtime collaboration session
  const {
    peers, status, isSharing, localPeer,
    startSharing, stopSharing, copyShareLink, renamePeer, updateCursor
  } = useCollab({
    workspaces,
    activeWorkspace,
    setLocalOpsHandler,
    setWorkspaceRoom,
    joinRoom,
    applyRemoteOpsToRoom,
    applyRemoteStateToRoom,
    lang
  });

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

  // --- Board export / import (hamburger menu) ---
  const svgRef = useRef<SVGSVGElement | null>(null);
  const {
    importInputRef, feedback: transferFeedback,
    handleExportImage, handleExportEuclid, handleImportEuclid, handleImportFile
  } = useBoardFileTransfer({ activeWorkspace, addImportedWorkspace, lang });

  const menuItems: MenuItem[] = [
    { id: 'export-image', label: t[lang].menu.exportImage, icon: () => <ImageIcon size={16} />, action: () => void handleExportImage(svgRef.current) },
    { id: 'export-euclid', label: t[lang].menu.exportEuclid, icon: () => <Download size={16} />, action: handleExportEuclid },
    { id: 'import-euclid', label: t[lang].menu.importEuclid, icon: () => <FileUp size={16} />, action: handleImportEuclid }
  ];

  // Keep the ShareBar aligned with the toolbar row on desktop (measured live).
  const shareBarTop = useElementAlignment('[data-toolbar]', '[data-ui-layer]');

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

      <div className="flex-1 relative w-full h-full" data-ui-layer>
        {/* Board menu: export/import and future entries */}
        <HamburgerMenu items={menuItems} ariaLabel={t[lang].menu.label} />
        <input
          ref={importInputRef}
          type="file"
          accept=".euclid,application/x-euclid+json,application/json"
          onChange={e => void handleImportFile(e)}
          className="hidden"
          data-euclid-import-input
        />
        {transferFeedback && (
          <div
            className="absolute top-16 left-4 z-30 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-lg px-3 py-2 text-[12px] font-medium text-slate-600"
            data-menu-feedback
          >
            {transferFeedback}
          </div>
        )}

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

        {/* Share / presence bar */}
        <ShareBar
          isSharing={isSharing}
          status={status}
          peers={peers}
          localPeer={localPeer}
          onStart={startSharing}
          onStop={stopSharing}
          onCopy={copyShareLink}
          onRename={renamePeer}
          lang={lang}
          topOffset={shareBarTop}
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
            updateBoard={updateBoard}
            view={view}
            setView={setView}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
            lang={lang}
            // Pass selection state down
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            // Collaboration
            peers={peers}
            onCursorMove={updateCursor}
            svgRef={svgRef}
          />
        </main>
      </div>

      {isChatOpen && (
        <Suspense
          fallback={
            <div className="fixed z-30 bg-white shadow-2xl border-slate-200 md:bottom-6 md:right-24 md:w-96 md:h-[600px] md:rounded-2xl md:border w-full h-[60vh] bottom-0 rounded-t-2xl" />
          }
        >
          <Chat
            activeWorkspace={activeWorkspace}
            updateBoard={updateBoard}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            lang={lang}
          />
        </Suspense>
      )}
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
