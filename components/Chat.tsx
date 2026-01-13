import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { askEuclides } from '../services/gemini';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const Chat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Olá! Sou seu assistente de geometria. Pergunte-me sobre teoremas, definições ou ajuda com demonstrações.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await askEuclides(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', text: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Desculpe, tive um problema ao pensar na resposta.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={clsx(
      "fixed bottom-4 right-4 z-20 transition-all duration-300 flex flex-col shadow-2xl rounded-2xl border border-slate-200 bg-white",
      isOpen ? "w-96 h-[500px]" : "w-14 h-14 rounded-full overflow-hidden hover:scale-110 cursor-pointer"
    )}>
      {/* Header */}
      <div 
        className={clsx(
          "bg-indigo-600 text-white p-4 flex items-center justify-between cursor-pointer",
          isOpen ? "rounded-t-2xl" : "h-full w-full justify-center rounded-full"
        )}
        onClick={() => !isOpen && setIsOpen(true)}
      >
        <div className="flex items-center gap-2">
          {isOpen ? <Sparkles size={20} className="text-yellow-300" /> : <MessageSquare size={24} />}
          {isOpen && <span className="font-semibold">Oráculo Geométrico</span>}
        </div>
        {isOpen && (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            className="hover:bg-indigo-500 p-1 rounded-full transition-colors"
          >
            <ChevronDown size={20} />
          </button>
        )}
      </div>

      {/* Body */}
      {isOpen && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={clsx(
                  "max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                  msg.role === 'user' 
                    ? "ml-auto bg-indigo-600 text-white rounded-br-none" 
                    : "mr-auto bg-white text-slate-800 border border-slate-100 rounded-bl-none"
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
          <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Pergunte sobre geometria..."
              className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors flex items-center justify-center w-10 h-10"
            >
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Chat;
