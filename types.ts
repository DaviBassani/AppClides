export enum ToolType {
  SELECT = 'SELECT',
  POINT = 'POINT',
  SEGMENT = 'SEGMENT',
  LINE = 'LINE',
  RAY = 'RAY',
  CIRCLE = 'CIRCLE',
  TEXT = 'TEXT',
  ERASER = 'ERASER'
}

export interface Point {
  id: string;
  x: number;
  y: number;
  label?: string;
  color?: string;
}

export interface TextLabel {
  id: string;
  x: number;
  y: number;
  content: string;
  color?: string;
}

export type ShapeType = 'segment' | 'line' | 'circle' | 'ray';

export interface GeometricShape {
  id: string;
  type: ShapeType;
  p1: string; // ID of first defining point (center for circle)
  p2: string; // ID of second defining point (radius point for circle)
  color?: string;
}

export interface BoardState {
  points: Record<string, Point>;
  shapes: GeometricShape[];
  texts: Record<string, TextLabel>;
}

export interface Workspace extends BoardState {
  id: string;
  name: string;
  createdAt: number;
  roomId?: string;
}
