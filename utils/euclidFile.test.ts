import { describe, expect, it } from 'vitest';
import {
  buildEuclidFileName,
  buildImageFileName,
  parseEuclidFile,
  parseEuclidFileText,
  serializeEuclidFile,
  EUCLID_FILE_EXTENSION
} from './euclidFile';
import { Workspace } from '../types';

const workspace = (): Workspace => ({
  id: 'ws-1',
  name: 'My Construction',
  createdAt: 1_700_000_000_000,
  points: {
    'point-a': { id: 'point-a', x: -140, y: 0, label: 'A' },
    'point-b': { id: 'point-b', x: 140, y: 0, label: 'B' }
  },
  shapes: [{ id: 'seg-1', type: 'segment', p1: 'point-a', p2: 'point-b' }],
  texts: {}
});

describe('.euclid file format', () => {
  it('round-trips a workspace losslessly', () => {
    const text = serializeEuclidFile(workspace());
    const parsed = parseEuclidFile(JSON.parse(text));

    expect(parsed?.name).toBe('My Construction');
    expect(parsed?.createdAt).toBe(1_700_000_000_000);
    expect(parsed?.board.points['point-a'].label).toBe('A');
    expect(parsed?.board.shapes[0].type).toBe('segment');
  });

  it('keeps the marker fields for forward compatibility', () => {
    const file = JSON.parse(serializeEuclidFile(workspace()));
    expect(file.format).toBe('euclides-web');
    expect(file.version).toBe(1);
    expect(typeof file.exportedAt).toBe('string');
  });

  it('rejects foreign formats and wrong versions', () => {
    expect(parseEuclidFile({ format: 'other-app', version: 1 })).toBeNull();
    expect(parseEuclidFile({ format: 'euclides-web', version: 999, workspace: {} })).toBeNull();
  });

  it('rejects malformed boards instead of importing broken state', () => {
    expect(parseEuclidFile({
      format: 'euclides-web',
      version: 1,
      workspace: { name: 'X', createdAt: 1, board: { points: { p: { id: 'p', x: Infinity, y: 0 } }, shapes: [], texts: {} } }
    })).toBeNull();
  });

  it('rejects missing or oversized names', () => {
    const base = { format: 'euclides-web', version: 1, workspace: { createdAt: 1, board: { points: {}, shapes: [], texts: {} } } };
    expect(parseEuclidFile({ ...base, workspace: { ...base.workspace, name: '' } })).toBeNull();
    expect(parseEuclidFile({ ...base, workspace: { ...base.workspace, name: 'x'.repeat(101) } })).toBeNull();
  });

  it('builds safe file names from workspace names', () => {
    expect(buildEuclidFileName('My Construction!')).toBe('my-construction.euclid');
    expect(buildEuclidFileName('Construção Ação')).toBe('construcao-acao.euclid');
    expect(buildEuclidFileName('   ')).toBe('untitled.euclid');
    expect(buildImageFileName('My Construction')).toBe('my-construction.png');
    expect(buildEuclidFileName('My Construction')).toContain(EUCLID_FILE_EXTENSION);
  });

  it('refuses to parse oversized file text', () => {
    expect(parseEuclidFileText('x'.repeat(6_000_000))).toBeNull();
  });
});