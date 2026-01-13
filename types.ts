export enum ToolType {
  SELECT = 'SELECT',
  POINT = 'POINT',
  SEGMENT = 'SEGMENT',
  LINE = 'LINE',
  CIRCLE = 'CIRCLE',
  ERASER = 'ERASER'
}

export interface Point {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export type ShapeType = 'segment' | 'line' | 'circle';

export interface GeometricShape {
  id: string;
  type: ShapeType;
  p1: string; // ID of first defining point (center for circle)
  p2: string; // ID of second defining point (radius point for circle)
}

export interface Workspace {
  id: string;
  name: string;
  points: Record<string, Point>;
  shapes: GeometricShape[];
  createdAt: number;
}

export interface AppState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  selectedTool: ToolType;
}