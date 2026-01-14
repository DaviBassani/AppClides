# Technical Documentation & Architecture 🏗️

This document is intended for developers who wish to understand, maintain, or expand **Euclides Web**. The project has recently undergone refactoring focused on **Clean Architecture**, **SOLID**, and **Separation of Concerns**.

## 1. Stack Overview

*   **Core:** React 19 (Hooks-heavy architecture).
*   **Language:** TypeScript (Strict typing).
*   **Rendering:** SVG Manipulated via React (Virtual DOM). We do not use HTML5 Canvas (bitmap) to maintain infinite scalability and vector sharpness at any zoom level.
*   **Styling:** Tailwind CSS.
*   **AI:** Google Gemini API (`@google/genai`) via `flash-preview`.
*   **Icons:** Lucide React.

## 2. Architectural Principles

The code has been restructured to avoid "God Components" (giant components that do everything).

### Separation of Concerns (SRP)
*   **Presentation Layer (View):** Dumb components (`Grid.tsx`, `PointRenderer.tsx`) that only receive props and render SVG. They contain no business logic.
*   **Logic Layer (Hooks/Controllers):** Custom hooks (`useCanvasInteraction`, `useChat`) that manage state, mouse events, mathematical calculations, and business rules.
*   **Service Layer (Infra):** External communication (`services/gemini.ts`) and persistence (`utils/storage.ts`).

---

## 3. Directory Structure

```
/
├── components/          # React Components (UI)
│   ├── canvas/          # Canvas Sub-components (Grid, Shapes)
│   ├── Canvas.tsx       # Visual "Container" of the geometric world
│   ├── Toolbar.tsx      # Floating toolbar
│   ├── Chat.tsx         # Chat interface
│   └── ...
├── hooks/               # Business Logic (The "Brain" of the app)
│   ├── useCanvasInteraction.ts  # The most complex hook (Input, Pan, Zoom, Snap)
│   ├── useWorkspaces.ts         # Global state management, undo/redo, tabs
│   └── useChat.ts               # Logic for messages and AI function calls
├── services/            # External integrations
│   └── gemini.ts        # Google API Client and Tool Definitions
├── types.ts             # Type Definitions (Shape, Point, Workspace)
└── utils/               # Pure math functions and helpers
    ├── geometry.ts      # Heavy math (intersections, distances)
    └── storage.ts       # LocalStorage Wrapper
```

---

## 4. Key Concepts

### 4.1. Coordinate System (World vs. Screen)
The app operates in two coordinate spaces:
1.  **Screen Space:** Pixels on the browser screen (mouse/touch events).
2.  **World Space:** Infinite Cartesian coordinates where geometry exists.

The transformation is managed by the `view` state ({ x, y, k }):
```typescript
WorldX = (ScreenX - view.x) / view.k
WorldY = (ScreenY - view.y) / view.k
```
*All SVG rendering logic applies a transformation matrix `transform="translate(x,y) scale(k)"` so React can think solely in World coordinates.*

### 4.2. Interaction Loop (`useCanvasInteraction`)
This hook encapsulates the user input complexity. It implements an implicit finite state machine:
1.  **Idle:** Waiting for input.
2.  **Drafting:** User clicked once (e.g., start of a segment) and is moving the mouse (renders "Ghost Shape").
3.  **Dragging:** User is dragging an existing point (Select mode).
4.  **Panning/Zooming:** User is moving the camera (middle button or two fingers).

**Snapping (Magnet):**
The "magnet" system is hierarchical and prioritized:
1.  Snap to Existing Points.
2.  Snap to Shape Intersections (calculated in real-time in `geometry.ts`).
3.  Snap to Grid.

### 4.3. AI Integration (Function Calling)
The AI doesn't "see" pixels. We serialize the board state (JSON of points and shapes) and send it as text to Gemini.

Gemini responds in two ways:
1.  **Text:** Natural language (Euclid persona).
2.  **Function Calls:** Structured commands to modify the app state.
    *   `create_point(x, y, label)`
    *   `create_shape(type, p1_id, p2_id)`

The `useChat` hook intercepts these calls and executes React setters (`setPoints`, `setShapes`), creating a feedback loop where the AI manipulates the UI.

### 4.4. State Management and Undo/Redo (`useWorkspaces`)
We use a manual **Immutability** approach for history.
*   Every user action creates a *Snapshot* (Deep Copy) of the previous state.
*   History is stored in memory (runtime) for performance.
*   Persistence in `LocalStorage` saves only the current state of all workspaces.

---

## 5. Canvas Rendering Flow

To ensure high performance (60fps) even with many elements:
1.  **Grid:** Rendered via SVG `pattern` (much lighter than thousands of individual lines). Line thickness is recalculated inversely to zoom to maintain a hairline width (`visualScale`).
2.  **Memoization:** Components like `Grid`, `ShapeRenderer`, and `PointRenderer` are wrapped in `React.memo` to avoid unnecessary re-renders when only the mouse moves (but geometry doesn't change).
3.  **Ghost Rendering:** The "draft" of what is being drawn is rendered separately, avoiding recreating objects in the main list until the action is finalized.

---

## 6. Extension Guide

### Adding a new tool (e.g., Polygon)
1.  Add the type in `types.ts` (`ShapeType`).
2.  Add the constant and icon in `constants.ts`.
3.  Update creation logic in `useCanvasInteraction.ts`.
4.  Create rendering logic in `ShapeRenderer.tsx`.
5.  (Optional) Add a `FunctionDeclaration` in `gemini.ts` so the AI knows how to use the new tool.