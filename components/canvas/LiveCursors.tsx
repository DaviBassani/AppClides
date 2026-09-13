import React from 'react';
import { PeerPresence } from '../../services/collab';

interface LiveCursorsProps {
  peers: PeerPresence[];
  view: { x: number; y: number; k: number };
}

// Screen-space rendering keeps cursors readable at every canvas zoom level.
const LiveCursors: React.FC<LiveCursorsProps> = ({ peers, view }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-[5]">
    {peers.map(peer => {
      if (!peer.cursor) return null;
      const left = peer.cursor.x * view.k + view.x;
      const top = peer.cursor.y * view.k + view.y;

      return (
        <div
          key={peer.id}
          data-live-cursor={peer.id}
          className="absolute left-0 top-0 flex items-start will-change-transform"
          style={{
            transform: `translate3d(${left}px, ${top}px, 0)`,
            transition: 'transform 480ms linear'
          }}
        >
          <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true">
            <path
              d="M2 2.5V20l4.8-4.7 3.5 7.2 3.6-1.8-3.4-6.9h6.8L2 2.5Z"
              fill={peer.color}
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="mt-4 -ml-1 px-2 py-1 rounded-md text-[11px] leading-none font-semibold text-white shadow-sm whitespace-nowrap"
            style={{ backgroundColor: peer.color }}
          >
            {peer.name}
          </span>
        </div>
      );
    })}
  </div>
);

export default React.memo(LiveCursors);
