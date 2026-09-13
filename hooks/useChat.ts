import React, { useState, useEffect } from 'react';
import { askEuclides, GeminiFunctionCall, GeminiResponse, ChatMessage as GeminiChatMessage } from '../services/gemini';
import { BoardState, Workspace } from '../types';
import { generateId } from '../utils/geometry';
import { Language, t } from '../utils/i18n';
import { MAX_CHAT_HISTORY_MESSAGES } from '../utils/chatLimits';
import { applyGeminiFunctionCalls } from '../services/geminiActions';

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    debugInfo?: string;
    functionCalls?: GeminiFunctionCall[];
}

interface UseChatProps {
    activeWorkspace: Workspace;
    updateBoard: React.Dispatch<React.SetStateAction<BoardState>>;
    lang: Language;
}

export const useChat = ({ activeWorkspace, updateBoard, lang }: UseChatProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    
    useEffect(() => {
        setMessages([
            { role: 'assistant', text: t[lang].chat.initialMessage }
        ]);
    }, [lang]);

    const [isLoading, setIsLoading] = useState(false);

    const executeFunctionCalls = (functionCalls: GeminiFunctionCall[]) => {
        if (!functionCalls || functionCalls.length === 0) return;
        updateBoard(current => applyGeminiFunctionCalls(current, functionCalls, generateId));
    };

    const sendMessage = async (input: string) => {
        if (!input.trim() || isLoading) return;

        setMessages(prev => [...prev, { role: 'user', text: input }]);
        setIsLoading(true);

        try {
          // Convert messages to Gemini format (exclude debugInfo, exclude initial greeting)
          const historyForGemini: GeminiChatMessage[] = messages
              .filter(msg => msg.text !== t[lang].chat.initialMessage) // Exclude initial greeting
              .slice(-MAX_CHAT_HISTORY_MESSAGES)
              .map(msg => ({
                  role: msg.role,
                  text: msg.text,
                  functionCalls: msg.functionCalls
              }));

          const response: GeminiResponse = await askEuclides(input, activeWorkspace, lang, historyForGemini);
          
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
