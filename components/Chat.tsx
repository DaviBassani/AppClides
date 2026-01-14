import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import { Workspace, Point, GeometricShape } from '../types';
import { useChat } from '../hooks/useChat';
import { Language, t } from '../utils/i18n';

interface ChatProps {
  activeWorkspace: Workspace;
  setPoints: React.Dispatch<React.SetStateAction<Record<string, Point>>>;
  setShapes: React.Dispatch<React.SetStateAction<GeometricShape[]>>;
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

const Chat: React.FC<ChatProps> = ({ activeWorkspace, setPoints, setShapes, isOpen, onClose, lang }) => {
  const { messages, isLoading, sendMessage } = useChat({ activeWorkspace, setPoints, setShapes, lang });
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen]);

  const handleSend = () => {
      sendMessage(input);
      setInput('');
  }

  return (
    <div className={clsx(
      "fixed z-30 transition-transform duration-300 flex flex-col bg-white shadow-2xl border-slate-200",
      // Desktop Styles
      "md:bottom-6 md:right-24 md:w-96 md:h-[600px] md:rounded-2xl md:border",
      // Mobile Styles
      "w-full h-[60vh] bottom-0 rounded-t-2xl",
      isOpen ? "translate-y-0" : "translate-y-[120%]"
    )}>
      {/* Header */}
      <div 
        className="bg-indigo-900 text-white p-4 flex items-center justify-between rounded-t-2xl cursor-default shrink-0"
        onClick={() => { if(window.innerWidth < 768) onClose() }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-amber-200" />
          <div>
            <span className="font-semibold block leading-tight">{t[lang].chat.title}</span>
            <span className="text-[10px] text-indigo-200 uppercase tracking-widest">{t[lang].chat.subtitle}</span>
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="hover:bg-indigo-800 p-1 rounded-full transition-colors"
        >
          <ChevronDown size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 overscroll-contain">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={clsx(
              "max-w-[90%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
              msg.role === 'user' 
                ? "ml-auto bg-indigo-600 text-white rounded-br-none" 
                : "mr-auto bg-white text-slate-800 border border-slate-200 rounded-bl-none font-serif"
            )}
          >
            <ReactMarkdown>{msg.text}</ReactMarkdown>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-1 items-center ml-2 text-slate-400 text-xs">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-slate-100 flex gap-2 shrink-0 pb-safe">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={t[lang].chat.placeholder}
          className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-900 focus:outline-none placeholder:text-slate-400"
        />
        <button 
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="bg-indigo-900 hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors flex items-center justify-center w-12 h-12"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

export default Chat;
