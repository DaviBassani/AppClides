import { Workspace } from "../types";
import { Language } from "../utils/i18n";

export interface GeminiResponse {
    text: string;
    functionCalls?: any[];
    errorDetails?: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
}

export const askEuclides = async (
    prompt: string,
    currentWorkspace: Workspace,
    lang: Language,
    messages: ChatMessage[] = []
): Promise<GeminiResponse> => {
    try {
        // We now call the Vercel Serverless Function instead of the SDK directly
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                points: currentWorkspace.points,
                shapes: currentWorkspace.shapes,
                texts: currentWorkspace.texts,
                lang,
                messages // Send conversation history
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.details || `Server error: ${response.status}`);
        }

        const data = await response.json();
        return {
            text: data.text,
            functionCalls: data.functionCalls
        };

    } catch (error: any) {
        console.error("API Call Error:", error);
        
        const errorMessage = lang === 'pt' 
            ? "Perdoe-me, não consigo acessar a biblioteca de Alexandria no momento (Erro de Conexão)." 
            : "Forgive me, I cannot access the library of Alexandria at this moment (Connection Error).";

        return { 
            text: errorMessage, 
            errorDetails: error.message 
        };
    }
};