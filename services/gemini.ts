import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

// Initialize client only if key is available
try {
    if (process.env.API_KEY) {
        client = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
} catch (e) {
    console.error("Failed to initialize Gemini client", e);
}

export const askEuclides = async (prompt: string): Promise<string> => {
    if (!client) {
        return "A chave de API não foi configurada. Por favor, configure a API_KEY para usar o assistente.";
    }

    try {
        const response = await client.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: "Você é Euclides, o pai da geometria. Você ajuda estudantes a entender conceitos de geometria euclidiana de forma clara, didática e concisa. Responda sempre em Português do Brasil. Use formatação Markdown para deixar a resposta bonita.",
            }
        });
        return response.text || "Não consegui gerar uma resposta.";
    } catch (error) {
        console.error("Error asking Gemini:", error);
        return "Desculpe, ocorreu um erro ao consultar o oráculo geométrico.";
    }
};
