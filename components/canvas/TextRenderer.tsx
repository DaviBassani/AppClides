import React from 'react';
import { TextLabel } from '../../types';
import { COLORS } from '../../constants';

interface TextRendererProps {
  text: TextLabel;
  visualScale: number;
  isSelected: boolean;
}

const TextRenderer: React.FC<TextRendererProps> = React.memo(({ text, visualScale, isSelected }) => {
  const fontSize = 16 * visualScale;
  const color = text.color || COLORS.text;
  
  return (
    <g 
        className="cursor-pointer select-none" 
        style={{ pointerEvents: 'none' }} // Let bounding box handle events or pass through
    >
        {isSelected && (
            <rect 
                x={text.x - 4 * visualScale}
                y={text.y - fontSize}
                width={Math.max(20 * visualScale, text.content.length * fontSize * 0.6 + 8 * visualScale)}
                height={fontSize + 8 * visualScale}
                fill="transparent"
                stroke={COLORS.selection}
                strokeWidth={2 * visualScale}
                strokeDasharray={`${4 * visualScale},${4 * visualScale}`}
                rx={4 * visualScale}
            />
        )}
        <text 
            x={text.x} 
            y={text.y} 
            fontSize={fontSize}
            fill={color}
            fontFamily="Inter, sans-serif"
            fontWeight="500"
            // Simple text rendering, no wrapping for MVP
        >
            {text.content}
        </text>
    </g>
  );
});

export default TextRenderer;