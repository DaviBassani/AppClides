import { Workspace } from '../types';
import { buildEuclidFileName, buildImageFileName, serializeEuclidFile } from './euclidFile';

interface PngResult {
  blob: Blob;
  fileName: string;
}

/**
 * Export helpers for the board: PNG rasterization of the live SVG layer and
 * the native .euclid document download. No external dependencies.
 */
export const renderBoardToPng = async (
  svgElement: SVGSVGElement,
  workspace: Workspace,
  scale: number = 2
): Promise<PngResult | null> => {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Bake the live background color in (the app canvas is transparent over slate-50)
  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('width', '100%');
  background.setAttribute('height', '100%');
  background.setAttribute('fill', '#f8fafc');
  clone.insertBefore(background, clone.firstChild);

  const width = Math.max(1, Math.round(svgElement.clientWidth * scale));
  const height = Math.max(1, Math.round(svgElement.clientHeight * scale));
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    const loaded = await new Promise<boolean>(resolve => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = svgUrl;
    });
    if (!loaded || !image.naturalWidth) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return { blob, fileName: buildImageFileName(workspace.name) };
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const downloadEuclidFile = (workspace: Workspace): boolean => {
  try {
    const text = serializeEuclidFile(workspace);
    downloadBlob(new Blob([text], { type: 'application/x-euclid+json' }), buildEuclidFileName(workspace.name));
    return true;
  } catch {
    return false;
  }
};