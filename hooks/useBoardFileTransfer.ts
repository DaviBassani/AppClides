import { useCallback, useEffect, useRef, useState } from 'react';
import { Workspace } from '../types';
import { Language, t } from '../utils/i18n';
import { downloadBlob, downloadEuclidFile, renderBoardToPng } from '../utils/boardExport';
import { parseEuclidFileText } from '../utils/euclidFile';

interface UseBoardFileTransferProps {
  activeWorkspace: Workspace;
  /** Adds an imported workspace and activates it (from useWorkspaces). */
  addImportedWorkspace: (workspace: Workspace) => void;
  lang: Language;
}

/**
 * Board file transfer: PNG export, .euclid export/import and user feedback.
 * Owns all transient transfer state so App stays wiring-only.
 */
export const useBoardFileTransfer = ({
  activeWorkspace,
  addImportedWorkspace,
  lang
}: UseBoardFileTransferProps) => {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = globalThis.setTimeout(() => setFeedback(null), 2200);
    return () => globalThis.clearTimeout(timer);
  }, [feedback]);

  const handleExportImage = useCallback(async (svgElement: SVGSVGElement | null) => {
    if (!svgElement) return;
    const result = await renderBoardToPng(svgElement, activeWorkspace);
    if (!result) return;
    downloadBlob(result.blob, result.fileName);
    setFeedback(t[lang].menu.exportImage);
  }, [activeWorkspace, lang]);

  const handleExportEuclid = useCallback(() => {
    if (!downloadEuclidFile(activeWorkspace)) return;
    setFeedback(t[lang].menu.exportEuclid);
  }, [activeWorkspace, lang]);

  const handleImportEuclid = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so selecting the same file again re-triggers change.
    event.target.value = '';
    if (!file) return;

    const parsed = parseEuclidFileText(await file.text());
    if (!parsed) {
      setFeedback(t[lang].menu.importInvalid);
      return;
    }

    // Fresh IDs guarantee zero collision; the imported workspace is fully
    // native: editable, AI-readable, and shareable.
    addImportedWorkspace({
      id: crypto.randomUUID(),
      name: parsed.name,
      createdAt: parsed.createdAt,
      roomId: undefined,
      ...parsed.board
    });
    setFeedback(`${parsed.name} ✓`);
  }, [addImportedWorkspace, lang]);

  return { importInputRef, feedback, handleExportImage, handleExportEuclid, handleImportEuclid, handleImportFile };
};