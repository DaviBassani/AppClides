import React, { useRef, useState, useEffect } from 'react';
import { TOOLS, ICONS } from '../constants';
import { ToolType } from '../types';
import clsx from 'clsx';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface ToolbarProps {
  selectedTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  selectedTool, 
  onSelectTool, 
  onClear, 
  onUndo, 
  onRedo, 
  canUndo, 
  canRedo 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position to toggle fade indicators
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  // Mouse Drag Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll-fast multiplier
    scrollRef.current.scrollLeft = scrollLeft - walk;
    checkScroll();
  };

  return (
    <div className="absolute z-20 left-1/2 -translate-x-1/2 w-full max-w-[95vw] md:w-auto bottom-6 md:top-4 md:bottom-auto transition-all duration-300">
      <div className="relative group rounded-2xl shadow-xl border border-slate-200 bg-white/95 backdrop-blur-md">
        
        {/* Left Fade Indicator */}
        <div 
            className={clsx(
                "absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 rounded-l-2xl pointer-events-none transition-opacity duration-300",
                canScrollLeft ? "opacity-100" : "opacity-0"
            )}
        >
            <div className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-400">
                <ChevronLeft size={16} />
            </div>
        </div>

        {/* Scrollable Container */}
        <div 
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onScroll={checkScroll}
          className="flex gap-1 p-1.5 overflow-x-auto mx-auto w-fit max-w-full cursor-grab active:cursor-grabbing select-none
                     [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
        >
          {/* Undo / Redo Group */}
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-3 md:p-3 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              title="Desfazer"
            >
              <ICONS.Undo size={22} />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-3 md:p-3 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              title="Refazer"
            >
              <ICONS.Redo size={22} />
            </button>
          </div>

          <div className="w-px bg-slate-200 my-1 shrink-0" />

          {/* Tools Group */}
          <div className="flex gap-1 shrink-0">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isSelected = selectedTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => onSelectTool(tool.id)}
                  className={clsx(
                    "p-3 rounded-xl flex flex-col items-center justify-center transition-all duration-200 group relative active:scale-95",
                    isSelected
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  )}
                  title={tool.label}
                >
                  <Icon size={24} strokeWidth={isSelected ? 2.5 : 2} />
                </button>
              );
            })}
          </div>
          
          <div className="w-px bg-slate-200 mx-1 shrink-0" />
          
          <button
            onClick={onClear}
            className="p-3 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium text-sm shrink-0 whitespace-nowrap active:scale-95"
          >
            Limpar
          </button>
        </div>

        {/* Right Fade Indicator */}
        <div 
            className={clsx(
                "absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 rounded-r-2xl pointer-events-none transition-opacity duration-300",
                canScrollRight ? "opacity-100" : "opacity-0"
            )}
        >
             <div className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400">
                <ChevronRight size={16} />
            </div>
        </div>

      </div>
    </div>
  );
};

export default Toolbar;