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
                texts: currentWorkspace.texts,
                lang
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("API Error details:", errorData);
            throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        return data as GeminiResponse;

    } catch (error) {
        console.error("Error asking Gemini via API:", error);
        return { 
            text: lang === 'pt' 
                ? "Perdoe-me, nobre estudante. Minha conexão com a Biblioteca falhou (Erro de Servidor)." 
                : "Forgive me, noble student. My connection to the Library has failed (Server Error)." 
        };
    }
};