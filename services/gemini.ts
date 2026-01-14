import { Workspace } from "../types";
import { Language } from "../utils/i18n";

export interface GeminiResponse {
    text: string;
    functionCalls?: any[];
}

export const askEuclides = async (prompt: string, currentWorkspace: Workspace, lang: Language): Promise<GeminiResponse> => {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                points: currentWorkspace.points,
                shapes: currentWorkspace.shapes,
                lang
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Server Error:", errorData);
            
            if (response.status === 404) {
                // Helpful message for local development without vercel dev
                return { 
                    text: lang === 'pt' 
                        ? "Erro: API não encontrada. Se estiver rodando localmente, use `vercel dev` em vez de `npm run dev` para habilitar as Serverless Functions."
                        : "Error: API not found. If running locally, use `vercel dev` instead of `npm run dev` to enable Serverless Functions."
                };
            }
            
            throw new Error(`API responded with status ${response.status}`);
        }

        const data = await response.json();
        return data as GeminiResponse;

    } catch (error) {
        console.error("Error asking Euclides:", error);
        return { 
            text: lang === 'pt' 
                ? "Perdoe-me, nobre estudante. Minha conexão com a Biblioteca falhou (Verifique a API Key no servidor)." 
                : "Forgive me, noble student. My connection to the Library has failed (Check server API Key)." 
        };
    }
};