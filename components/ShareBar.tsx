import React, { useEffect, useRef, useState } from 'react';
import { Share2, Users, Wifi, WifiOff, Loader2, Copy, X, Pencil } from 'lucide-react';
import clsx from 'clsx';
import { CollabStatus, PeerPresence } from '../services/collab';
import { MAX_PEER_NAME_LENGTH } from '../services/collabProtocol';
import { Language, t } from '../utils/i18n';

interface ShareBarProps {
  isSharing: boolean;
  status: CollabStatus;
  peers: PeerPresence[];
  localPeer: PeerPresence | null;
  onStart: () => void;
  onStop: () => void;
  onCopy: () => void;
  onRename: (name: string) => void | Promise<void>;
  lang: Language;
}

const ShareBar: React.FC<ShareBarProps> = ({
  isSharing, status, peers, localPeer, onStart, onStop, onCopy, onRename, lang
}) => {
  const [copied, setCopied] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const s = t[lang].share;

  useEffect(() => {
    if (!isProfileOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsProfileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProfileOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isProfileOpen]);

  useEffect(() => () => {
    if (copiedTimerRef.current !== null) globalThis.clearTimeout(copiedTimerRef.current);
  }, []);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    if (copiedTimerRef.current !== null) globalThis.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = globalThis.setTimeout(() => {
      copiedTimerRef.current = null;
      setCopied(false);
    }, 2000);
  };

  const isOnline = isSharing && status === 'online';

  const openProfile = () => {
    setDraftName(localPeer?.name || '');
    setIsProfileOpen(true);
  };

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    void onRename(name);
    setIsProfileOpen(false);
  };

  return (
    <div ref={rootRef} className="absolute top-4 md:top-20 xl:top-4 right-4 z-20">
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
            {localPeer && (
              <button
                type="button"
                onClick={openProfile}
                className="relative w-7 h-7 ml-0.5 rounded-lg border-2 border-white shadow-sm flex items-center justify-center text-white hover:ring-2 hover:ring-blue-200 transition-shadow"
                style={{ backgroundColor: localPeer.color }}
                title={s.editName}
                aria-label={s.editName}
              >
                <span className="text-[10px] font-bold">{localPeer.name.charAt(0).toUpperCase()}</span>
                <span className="absolute -right-1 -bottom-1 w-3.5 h-3.5 rounded-full bg-white text-slate-500 shadow flex items-center justify-center">
                  <Pencil size={8} />
                </span>
              </button>
            )}

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
              {(status === 'offline' || status === 'unavailable') && <WifiOff size={14} className={status === 'unavailable' ? 'text-amber-500' : 'text-slate-400'} />}
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
                    : status === 'unavailable' ? s.unavailable
                      : s.offline}
            </span>

            <span className="mx-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-[8px] leading-none font-bold uppercase tracking-wider text-slate-400 select-none">
              {s.beta}
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
            disabled={status === 'unavailable'}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors active:scale-95 disabled:cursor-not-allowed disabled:text-amber-600 disabled:hover:bg-transparent"
            title={status === 'unavailable' ? s.unavailableHint : s.button}
          >
            {status === 'unavailable' ? <WifiOff size={14} /> : <Share2 size={14} />}
            {status === 'unavailable' ? s.unavailable : s.button}
            <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 text-[8px] leading-none font-bold uppercase tracking-wider text-slate-400">
              {s.beta}
            </span>
          </button>
        )}
      </div>

      {isSharing && isProfileOpen && localPeer && (
        <form
          onSubmit={saveProfile}
          className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <label htmlFor="collab-display-name" className="block text-xs font-semibold text-slate-700 mb-2">
            {s.yourName}
          </label>
          <input
            id="collab-display-name"
            autoFocus
            maxLength={MAX_PEER_NAME_LENGTH}
            value={draftName}
            onChange={event => setDraftName(event.target.value)}
            placeholder={s.namePlaceholder}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{s.profileHint}</p>
          <button
            type="submit"
            disabled={!draftName.trim() || draftName.trim() === localPeer.name}
            className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {s.saveName}
          </button>
        </form>
      )}
    </div>
  );
};

export default ShareBar;
