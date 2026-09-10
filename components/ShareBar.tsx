import React, { useState } from 'react';
import { Share2, Users, Wifi, WifiOff, Loader2, Copy, X } from 'lucide-react';
import clsx from 'clsx';
import { PeerPresence } from '../services/collab';
import { Language, t } from '../utils/i18n';

interface ShareBarProps {
  isSharing: boolean;
  status: 'connecting' | 'online' | 'offline';
  peers: PeerPresence[];
  shareLink: string | null;
  onStart: () => void;
  onStop: () => void;
  onCopy: () => void;
  lang: Language;
}

const ShareBar: React.FC<ShareBarProps> = ({
  isSharing, status, peers, shareLink, onStart, onStop, onCopy, lang
}) => {
  const [copied, setCopied] = useState(false);
  const s = t[lang].share;

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
      {/* Peer avatars */}
      {isSharing && peers.length > 0 && (
        <div className="flex -space-x-1.5 items-center">
          {peers.slice(0, 5).map(peer => (
            <div
              key={peer.id}
              className="w-7 h-7 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
              style={{ backgroundColor: peer.color }}
              title={peer.name}
            >
              <span className="text-[10px] font-bold text-white">
                {peer.name.charAt(0)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className={clsx(
          "flex items-center gap-1.5 rounded-full shadow-lg border backdrop-blur-md pl-3 pr-1.5 py-1.5 transition-all",
          isSharing
            ? "bg-emerald-50/95 border-emerald-200"
            : "bg-white/95 border-slate-200"
        )}
      >
        {isSharing ? (
          <>
            {status === 'online' && <Wifi size={14} className="text-emerald-600" />}
            {status === 'connecting' && <Loader2 size={14} className="text-amber-500 animate-spin" />}
            {status === 'offline' && <WifiOff size={14} className="text-slate-400" />}

            <span className={clsx(
              "text-xs font-medium",
              status === 'online' ? "text-emerald-700" : status === 'connecting' ? "text-amber-600" : "text-slate-500"
            )}>
              {status === 'online'
                ? `${t[lang].share.online}${peers.length > 0 ? ` · ${peers.length + 1}` : ''}`
                : status === 'connecting' ? t[lang].share.connecting : t[lang].share.offline}
            </span>

            <button
              onClick={handleCopy}
              className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 transition-colors active:scale-95"
              title={copied ? t[lang].share.copied : t[lang].share.button}
            >
              {copied ? <Users size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>

            <button
              onClick={onStop}
              className="p-1.5 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors active:scale-95"
              title={t[lang].share.stop}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors active:scale-95"
            title={t[lang].share.button}
          >
            <Share2 size={14} />
            {t[lang].share.button}
          </button>
        )}
      </div>
    </div>
  );
};

export default ShareBar;