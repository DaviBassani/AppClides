import React, { useState, useEffect } from 'react';
import { askEuclides, GeminiResponse, ChatMessage as GeminiChatMessage } from '../services/gemini';
import { Workspace, Point, GeometricShape, TextLabel } from '../types';
import { generateId } from '../utils/geometry';
import { Language, t } from '../utils/i18n';

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    debugInfo?: string;
    functionCalls?: any[];
}

interface UseChatProps {
    activeWorkspace: Workspace;
    setPoints: React.Dispatch<React.SetStateAction<Record<string, Point>>>;
    setShapes: React.Dispatch<React.SetStateAction<GeometricShape[]>>;
    setTexts?: React.Dispatch<React.SetStateAction<Record<string, TextLabel>>>;
    batchUpdate?: (updates: {
        points?: Record<string, Point>;
        shapes?: GeometricShape[];
        texts?: Record<string, TextLabel>;
    }) => void;
    lang: Language;
}

export const useChat = ({ activeWorkspace, setPoints, setShapes, setTexts, batchUpdate, lang }: UseChatProps) => {
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
        
        const newPoints: Record<string, Point> = {};
        const newShapes: GeometricShape[] = [];
        const newTexts: Record<string, TextLabel> = {};
        let shouldClear = false;
    
        // 1. First Pass: Create Points and handle Clears
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
                    label: args.label || '',
                    color: args.color
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
                const p1 = idMap[args.p1_id] || args.p1_id;
                const p2 = idMap[args.p2_id] || args.p2_id;

                // Validate that referenced points exist (either in current workspace or in the new batch)
                const p1Exists = activeWorkspace.points[p1] || newPoints[p1];
                const p2Exists = activeWorkspace.points[p2] || newPoints[p2];
                if (p1 && p2 && p1Exists && p2Exists) {
                    newShapes.push({
                        id: generateId(),
                        type: args.type,
                        p1: p1,
                        p2: p2,
                        color: args.color
                    });
                }
            }
        });

        // 3. Batch Updates
        if (shouldClear) {
            if (batchUpdate) {
                batchUpdate({ points: newPoints, shapes: newShapes, texts: newTexts });
            } else {
                setPoints(newPoints);
                setShapes(newShapes);
                if (setTexts) setTexts(newTexts);
            }
        } else {
            if (batchUpdate) {
                batchUpdate({
                    points: { ...activeWorkspace.points, ...newPoints },
                    shapes: [...activeWorkspace.shapes, ...newShapes],
                    texts: setTexts ? { ...(activeWorkspace.texts || {}), ...newTexts } : undefined
                });
            } else {
                setPoints(prev => ({ ...prev, ...newPoints }));
                setShapes(prev => [...prev, ...newShapes]);
                if (setTexts) setTexts(prev => ({ ...prev, ...newTexts }));
            }
        }
    };

    const sendMessage = async (input: string) => {
        if (!input.trim() || isLoading) return;

        setMessages(prev => [...prev, { role: 'user', text: input }]);
        setIsLoading(true);

        try {
          // Convert messages to Gemini format (exclude debugInfo, exclude initial greeting)
          const historyForGemini: GeminiChatMessage[] = messages
              .filter(msg => msg.text !== t[lang].chat.initialMessage)
              .map(msg => ({
                  role: msg.role,
                  text: msg.text,
                  functionCalls: msg.functionCalls
              }));

          const response: GeminiResponse = await askEuclides(input, activeWorkspace, lang, historyForGemini);
          
          // Store the AI response with its function calls for history
          const assistantMessage: ChatMessage = {
              role: 'assistant',
              text: response.text || '',
              functionCalls: response.functionCalls
          };
          
          if (response.text) {
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                text: response.text,
                debugInfo: response.errorDetails,
                functionCalls: response.functionCalls
            }]);
          }
     
          if (response.functionCalls && response.functionCalls.length > 0) {
            executeFunctionCalls(response.functionCalls);
            
            if (!response.text) {
                 const doneMsg = lang === 'pt' 
                    ? "Realizei as construções solicitadas no quadro." 
                    : "I have performed the requested constructions on the board.";
                 setMessages(prev => [...prev, { role: 'assistant', text: doneMsg, functionCalls: response.functionCalls }]);
            }
          } else if (!response.text && !response.functionCalls) {
               setMessages(prev => [...prev, { role: 'assistant', text: "...", functionCalls: [] }]);
          }
     
        } catch (error) {
          setMessages(prev => [...prev, { role: 'assistant', text: t[lang].chat.error }]);
        } finally {
          setIsLoading(false);
        }
    };

    return { messages, isLoading, sendMessage };
};