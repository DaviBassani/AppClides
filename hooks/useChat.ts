import React, { useState, useEffect } from 'react';
import { askEuclides, GeminiResponse, ChatMessage as GeminiChatMessage } from '../services/gemini';
import { Workspace, Point, GeometricShape, TextLabel } from '../types';
import { generateId } from '../utils/geometry';
import { Language, t } from '../utils/i18n';

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    debugInfo?: string;
}

interface UseChatProps {
    activeWorkspace: Workspace;
    setPoints: React.Dispatch<React.SetStateAction<Record<string, Point>>>;
    setShapes: React.Dispatch<React.SetStateAction<GeometricShape[]>>;
    setTexts?: React.Dispatch<React.SetStateAction<Record<string, TextLabel>>>;
    lang: Language;
}

export const useChat = ({ activeWorkspace, setPoints, setShapes, setTexts, lang }: UseChatProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    
    useEffect(() => {
        setMessages([
            { role: 'assistant', text: t[lang].chat.initialMessage }
        ]);
    }, [lang]);

    const [isLoading, setIsLoading] = useState(false);

    const executeFunctionCalls = (functionCalls: any[]) => {
        if (!functionCalls || functionCalls.length === 0) return;
    
        const idMap: Record<string, string> = {};
        
        // Temporary batch containers
        const newPoints: Record<string, Point> = {};
        const newShapes: GeometricShape[] = [];
        const newTexts: Record<string, TextLabel> = {};
        let shouldClear = false;
    
        // 1. First Pass: Create Points and handle Clears
        // We process points first so IDs are available for shapes
        functionCalls.forEach(fc => {
            const args = fc.args;
            
            if (fc.name === 'clear_board') {
                shouldClear = true;
            }

            if (fc.name === 'create_point') {
                const realId = generateId();
                const aiId = args.id; 
                if (aiId) idMap[aiId] = realId;

                newPoints[realId] = {
                    id: realId,
                    x: Number(args.x),
                    y: Number(args.y),
                    label: args.label || ''
                };
            }

            if (fc.name === 'create_text') {
                const realId = generateId();
                newTexts[realId] = {
                    id: realId,
                    x: Number(args.x),
                    y: Number(args.y),
                    content: args.content
                };
            }
        });

        // 2. Second Pass: Create Shapes (now that we have Point IDs)
        functionCalls.forEach(fc => {
             if (fc.name === 'create_shape') {
                const args = fc.args;
                // Try to find ID in the new batch, otherwise check if it's a raw ID (unlikely from AI but possible)
                const p1 = idMap[args.p1_id] || args.p1_id; 
                const p2 = idMap[args.p2_id] || args.p2_id;

                // We don't check if p1 exists in 'activeWorkspace' here because React state 
                // hasn't updated yet. We trust the AI logic + our idMap.
                if (p1 && p2) {
                    newShapes.push({
                        id: generateId(),
                        type: args.type,
                        p1: p1,
                        p2: p2
                    });
                }
            }
        });

        // 3. Batch Updates
        if (shouldClear) {
            setPoints(newPoints);
            setShapes(newShapes);
            if (setTexts) setTexts(newTexts);
        } else {
            // Merge with previous state
            setPoints(prev => ({ ...prev, ...newPoints }));
            setShapes(prev => [...prev, ...newShapes]);
            if (setTexts) setTexts(prev => ({ ...prev, ...newTexts }));
        }
    };

    const sendMessage = async (input: string) => {
        if (!input.trim() || isLoading) return;

        setMessages(prev => [...prev, { role: 'user', text: input }]);
        setIsLoading(true);

        try {
          // Convert messages to Gemini format (exclude debugInfo, exclude initial greeting)
          const historyForGemini: GeminiChatMessage[] = messages
              .filter(msg => msg.text !== t[lang].chat.initialMessage) // Exclude initial greeting
              .map(msg => ({
                  role: msg.role,
                  text: msg.text
              }));

          const response: GeminiResponse = await askEuclides(input, activeWorkspace, lang, historyForGemini);
          
          if (response.text) {
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                text: response.text,
                debugInfo: response.errorDetails 
            }]);
          }
    
          if (response.functionCalls && response.functionCalls.length > 0) {
            executeFunctionCalls(response.functionCalls);
            
            if (!response.text) {
                 const doneMsg = lang === 'pt' 
                    ? "Realizei as construções solicitadas no quadro." 
                    : "I have performed the requested constructions on the board.";
                 setMessages(prev => [...prev, { role: 'assistant', text: doneMsg }]);
            }
          } else if (!response.text && !response.functionCalls) {
               setMessages(prev => [...prev, { role: 'assistant', text: "..." }]);
          }
    
        } catch (error) {
          setMessages(prev => [...prev, { role: 'assistant', text: t[lang].chat.error }]);
        } finally {
          setIsLoading(false);
        }
    };

    return { messages, isLoading, sendMessage };
};