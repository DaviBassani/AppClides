import React, { useState, useEffect, useCallback, useRef } from 'react';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import Chat from './components/Chat';
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
import { downloadBlob, downloadEuclidFile, renderBoardToPng } from './utils/boardExport';
import { parseEuclidFileText } from './utils/euclidFile';

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
  const importInputRef = useRef<HTMLInputElement>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const handleExportImage = useCallback(async () => {
    const svg = document.querySelector('main svg') as SVGSVGElement | null;
    if (!svg) return;
    const result = await renderBoardToPng(svg, activeWorkspace);
    if (!result) return;
    downloadBlob(result.blob, result.fileName);
    setExportFeedback(t[lang].menu.exportImage);
  }, [activeWorkspace, lang]);

  const handleExportEuclid = useCallback(() => {
    if (!downloadEuclidFile(activeWorkspace)) return;
    setExportFeedback(t[lang].menu.exportEuclid);
  }, [activeWorkspace, lang]);

  const handleImportEuclid = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-importing the same file
    if (!file) return;
    const parsed = parseEuclidFileText(await file.text());
    if (!parsed) {
      setExportFeedback(t[lang].menu.importInvalid);
      return;
    }
    // New IDs guarantee zero collision with existing boards; the imported
    // workspace is fully native: editable, AI-readable, and shareable.
    addImportedWorkspace({
      id: crypto.randomUUID(),
      name: parsed.name,
      createdAt: parsed.createdAt,
      roomId: undefined,
      ...parsed.board
    });
    setExportFeedback(`${parsed.name} ✓`);
  }, [addImportedWorkspace, lang]);

  useEffect(() => {
    if (!exportFeedback) return;
    const timer = globalThis.setTimeout(() => setExportFeedback(null), 2200);
    return () => globalThis.clearTimeout(timer);
  }, [exportFeedback]);

  const menuItems: MenuItem[] = [
    { id: 'export-image', label: t[lang].menu.exportImage, icon: () => <ImageIcon size={16} />, action: () => void handleExportImage() },
    { id: 'export-euclid', label: t[lang].menu.exportEuclid, icon: () => <Download size={16} />, action: handleExportEuclid },
    { id: 'import-euclid', label: t[lang].menu.importEuclid, icon: () => <FileUp size={16} />, action: handleImportEuclid }
  ];

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
        {/* Board menu: export/import and future entries */}
        <HamburgerMenu items={menuItems} lang={lang} />
        <input
          ref={importInputRef}
          type="file"
          accept=".euclid,application/x-euclid+json,application/json"
          onChange={e => void handleImportFile(e)}
          className="hidden"
          data-euclid-import-input
        />
        {exportFeedback && (
          <div
            className="absolute top-16 left-4 z-30 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-lg px-3 py-2 text-[12px] font-medium text-slate-600"
            data-menu-feedback
          >
            {exportFeedback}
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
          />
        </main>
      </div>

      <Chat 
        activeWorkspace={activeWorkspace}
        updateBoard={updateBoard}
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
