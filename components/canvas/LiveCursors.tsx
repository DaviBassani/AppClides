import React from 'react';
import { PeerPresence } from '../../services/collab';

interface LiveCursorsProps {
  peers: PeerPresence[];
  view: { x: number; y: number; k: number };
  activeWorkspaceId: string;
}

// Renders remote peers' cursors in world space (inside the transformed <g>)
const LiveCursors: React.FC<LiveCursorsProps> = ({ peers, view, activeWorkspaceId }) => {
  const visualScale = 1 / view.k;

  return (
    <>
      {peers.map(peer => {
        if (!peer.cursor || peer.activeWorkspaceId !== activeWorkspaceId) return null;
        return (
          <g key={peer.id} transform={`translate(${peer.cursor.x}, ${peer.cursor.y})`}>
            {/* Pointer arrow */}
            <path
              d="M 0 0 L 0 16 Q 0 18 2 16 L 5.5 11 L 12 11 Q 14 11 12.5 8.5 L 3 -1 Q 1 -2.5 0 0 Z"
              transform="scale(-1, -1) rotate(180)"
              fill={peer.color}
              stroke="white"
              strokeWidth={0.8 * visualScale}
            />
            {/* Name tag */}
            <g transform="translate(10, 18)">
              <rect
                x={0}
                y={0}
                rx={3 * visualScale}
                height={14 * visualScale}
                width={peer.name.length * 6.5 * visualScale + 8 * visualScale}
                fill={peer.color}
                opacity={0.9}
              />
              <text
                x={4 * visualScale}
                y={10 * visualScale}
                fontSize={9 * visualScale}
                fill="white"
                fontWeight={600}
                style={{ userSelect: 'none' }}
              >
                {peer.name}
              </text>
            </g>
          </g>
        );
      })}
    </>
  );
};

export default React.memo(LiveCursors);