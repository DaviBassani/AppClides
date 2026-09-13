import { Workspace } from "../types";
import { Language } from "../utils/i18n";

export interface GeminiResponse {
    text: string;
    functionCalls?: GeminiFunctionCall[];
    errorDetails?: string;
}

export interface GeminiFunctionCall {
    name: string;
    args: Record<string, unknown>;
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

        const data: unknown = await response.json();
        const record = data && typeof data === 'object' && !Array.isArray(data)
            ? data as Record<string, unknown>
            : {};
        const functionCalls = Array.isArray(record.functionCalls)
            ? record.functionCalls.flatMap(call => {
                if (!call || typeof call !== 'object' || Array.isArray(call)) return [];
                const candidate = call as Record<string, unknown>;
                if (typeof candidate.name !== 'string' || !candidate.args || typeof candidate.args !== 'object' || Array.isArray(candidate.args)) return [];
                return [{ name: candidate.name, args: candidate.args as Record<string, unknown> }];
            })
            : undefined;
        return {
            text: typeof record.text === 'string' ? record.text : '',
            functionCalls
        };

    } catch (error: unknown) {
        console.error("API Call Error:", error);
        
        const errorMessage = lang === 'pt' 
            ? "Perdoe-me, não consigo acessar a biblioteca de Alexandria no momento (Erro de Conexão)." 
            : "Forgive me, I cannot access the library of Alexandria at this moment (Connection Error).";

        return { 
            text: errorMessage, 
            errorDetails: import.meta.env.DEV && error instanceof Error ? error.message : undefined
        };
    }
};
