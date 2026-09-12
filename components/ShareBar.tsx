import React, { useState } from 'react';
import { Share2, Users, Wifi, WifiOff, Loader2, Copy, X } from 'lucide-react';
import clsx from 'clsx';
import { CollabStatus, PeerPresence } from '../services/collab';
import { Language, t } from '../utils/i18n';

interface ShareBarProps {
  isSharing: boolean;
  status: CollabStatus;
  peers: PeerPresence[];
  onStart: () => void;
  onStop: () => void;
  onCopy: () => void;
  lang: Language;
}

const ShareBar: React.FC<ShareBarProps> = ({
  isSharing, status, peers, onStart, onStop, onCopy, lang
}) => {
  const [copied, setCopied] = useState(false);
  const s = t[lang].share;

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOnline = isSharing && status === 'online';

  return (
    <div className="absolute top-4 right-4 z-20">
      <div
        className={clsx(
          "flex items-center gap-1 rounded-xl shadow-lg border backdrop-blur-md p-1 transition-all",
          isOnline
            ? "bg-emerald-50/95 border-emerald-200"
            : "bg-white/95 border-slate-200"
        )}
      >
        {isSharing ? (
          <>
            {peers.length > 0 && (
              <div className="flex -space-x-1.5 items-center pl-1 pr-1.5" aria-label={`${peers.length} ${s.collaborators}`}>
                {peers.slice(0, 4).map(peer => (
                  <div
                    key={peer.id}
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
                    style={{ backgroundColor: peer.color }}
                    title={peer.name}
                  >
                    <span className="text-[9px] font-bold text-white">{peer.name.charAt(0)}</span>
                  </div>
                ))}
                {peers.length > 4 && (
                  <span className="w-6 h-6 rounded-full border-2 border-white bg-slate-500 text-[9px] font-bold text-white flex items-center justify-center">
                    +{peers.length - 4}
                  </span>
                )}
              </div>
            )}

            {/* Status icon */}
            <div className="p-1.5" aria-hidden="true">
              {status === 'online' && <Wifi size={14} className="text-emerald-600" />}
              {(status === 'connecting' || status === 'reconnecting') && <Loader2 size={14} className="text-slate-400 animate-spin" />}
              {status === 'offline' && <WifiOff size={14} className="text-slate-400" />}
            </div>

            {/* Status text */}
            <span className={clsx(
              "text-xs font-medium select-none",
              status === 'online' ? "text-emerald-700" : "text-slate-500"
            )}>
              {status === 'online'
                ? `${s.online}${peers.length > 0 ? ` · ${peers.length + 1}` : ''}`
                : status === 'connecting' ? s.connecting
                  : status === 'reconnecting' ? s.reconnecting
                    : s.offline}
            </span>

            {/* Copy link */}
            <button
              onClick={handleCopy}
              className={clsx(
                "p-1.5 rounded-lg transition-colors active:scale-95",
                copied ? "text-emerald-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              )}
              title={copied ? s.copied : s.button}
              aria-label={copied ? s.copied : s.button}
            >
              {copied ? <Users size={14} /> : <Copy size={14} />}
            </button>

            {/* Stop sharing */}
            <button
              onClick={onStop}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors active:scale-95"
              title={s.stop}
              aria-label={s.stop}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors active:scale-95"
            title={s.button}
          >
            <Share2 size={14} />
            {s.button}
          </button>
        )}
      </div>
    </div>
  );
};

export default ShareBar;
