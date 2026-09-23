import { BoardState, Workspace } from '../types';
import { parseBoardState } from '../services/collabProtocol';

/**
 * .euclid file format — the app's portable document format.
 *
 * A .euclid file carries one complete workspace: geometry (points, shapes,
 * texts) with all metadata, so an import yields a fully editable board that
 * the AI, collaboration and every tool recognize as native state.
 *
 * JSON is the container (diffable, no vendor lock-in, gzip-friendly).
 */

export const EUCLID_FILE_EXTENSION = '.euclid';
export const EUCLID_MIME_TYPE = 'application/x-euclid+json';
const FORMAT_VERSION = 1;
const MAX_FILE_BYTES = 5_000_000;
const MAX_NAME_LENGTH = 100;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export interface EuclidFile {
  format: 'euclides-web';
  version: number;
  exportedAt: string;
  workspace: {
    name: string;
    createdAt: number;
    board: BoardState;
  };
}

export const serializeEuclidFile = (workspace: Workspace): string => {
  const file: EuclidFile = {
    format: 'euclides-web',
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: {
      name: workspace.name,
      createdAt: workspace.createdAt,
      board: {
        points: workspace.points,
        shapes: workspace.shapes,
        texts: workspace.texts
      }
    }
  };
  return JSON.stringify(file, null, 2);
};

export const parseEuclidFile = (value: unknown): { name: string; createdAt: number; board: BoardState } | null => {
  if (!isRecord(value)) return null;
  if (value.format !== 'euclides-web') return null;
  if (value.version !== FORMAT_VERSION) return null;
  if (!isRecord(value.workspace)) return null;

  const workspace = value.workspace;
  if (typeof workspace.name !== 'string' || !workspace.name.trim() || workspace.name.length > MAX_NAME_LENGTH) return null;
  if (typeof workspace.createdAt !== 'number' || !Number.isFinite(workspace.createdAt)) return null;

  // Imports are all-or-nothing: a single invalid entity rejects the whole file
  // (unlike LocalStorage recovery, which salvages what it can).
  const board = parseBoardState(workspace.board);
  if (!board) return null;

  return { name: workspace.name.trim(), createdAt: workspace.createdAt, board };
};

export const parseEuclidFileText = (text: string): { name: string; createdAt: number; board: BoardState } | null => {
  if (text.length > MAX_FILE_SIZE_BYTES) return null;
  try {
    return parseEuclidFile(JSON.parse(text));
  } catch {
    return null;
  }
};

export const EUCLID_FILE_SIZE_LIMIT = 5_000_000;
const MAX_FILE_SIZE_BYTES = EUCLID_FILE_SIZE_LIMIT;

export const buildEuclidFileName = (workspaceName: string): string => {
  const safeStem = workspaceName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
  return `${safeStem}${EUCLID_FILE_EXTENSION}`;
};

export const buildImageFileName = (workspaceName: string): string => {
  const stem = buildEuclidFileName(workspaceName).replace(EUCLID_FILE_EXTENSION, '');
  return `${stem}.png`;
};