import React from 'react';
import { Magnet, Grid3x3, ZoomIn, ZoomOut, Maximize, MessageSquare } from 'lucide-react';
import clsx from 'clsx';

interface ViewControlsProps {
    snapToGrid: boolean;
    setSnapToGrid: (v: boolean) => void;
    showGrid: boolean;
    setShowGrid: (v: boolean) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetView: () => void;
    isChatOpen: boolean;
    setIsChatOpen: (v: boolean) => void;
    layout?: 'col' | 'row';
}

const ViewControls: React.FC<ViewControlsProps> = ({
    snapToGrid, setSnapToGrid,
    showGrid, setShowGrid,
    onZoomIn, onZoomOut, onResetView,
    isChatOpen, setIsChatOpen,
    layout = 'col'
}) => {
    const btnSize = layout === 'col' ? "w-10 h-10 md:w-9 md:h-9" : "w-12 h-12";
    const baseClass = "rounded-lg transition-colors active:scale-95 flex items-center justify-center shadow-sm p-0";

    return (
        <>
            <button 
                onClick={() => setSnapToGrid(!snapToGrid)} 
                className={clsx(
                    baseClass, btnSize,
                    snapToGrid ? "text-amber-600 bg-amber-50" : "text-slate-600 hover:bg-slate-100 bg-white"
                )} 
                title="Imã (Snap)"
            >
                <Magnet size={20} />
            </button>
            <button 
                onClick={() => setShowGrid(!showGrid)} 
                className={clsx(
                    baseClass, btnSize,
                    showGrid ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-100 bg-white"
                )} 
                title="Grade"
            >
                <Grid3x3 size={20} />
            </button>
            
            {layout === 'col' && <div className="h-px bg-slate-200 mx-1 my-0.5 md:block hidden w-6 self-center" />}
            
            <button onClick={onZoomIn} className={clsx(baseClass, btnSize, "text-slate-600 hover:bg-slate-100 bg-white")}>
                <ZoomIn size={20} />
            </button>
            <button onClick={onZoomOut} className={clsx(baseClass, btnSize, "text-slate-600 hover:bg-slate-100 bg-white")}>
                <ZoomOut size={20} />
            </button>
            <button onClick={onResetView} className={clsx(baseClass, btnSize, "text-slate-600 hover:bg-slate-100 bg-white")}>
                <Maximize size={20} />
            </button>
    
            {layout === 'col' && <div className="h-px bg-slate-200 mx-1 my-0.5 md:block hidden w-6 self-center" />}
            
            <button 
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={clsx(
                    baseClass, btnSize,
                    isChatOpen ? "bg-indigo-600 text-white shadow-md" : "text-indigo-600 hover:bg-indigo-50 bg-white"
                )}
            >
                <MessageSquare size={20} />
            </button>
        </>
    );
};

export default ViewControls;