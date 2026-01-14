import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { GeometricShape, Point, Workspace } from "../types";
import { Language } from "../utils/i18n";

let client: GoogleGenAI | null = null;

// Helper to retrieve API Key from various environments (Node, Vite, etc.)
const getApiKey = (): string | undefined => {
    // 1. Try standard process.env (Node/Webpack/Polyfilled)
    try {
        if (process.env.API_KEY) return process.env.API_KEY;
    } catch (e) {}

    // 2. Try Vite environment (Standard for Vercel + React)
    try {
        // @ts-ignore - import.meta is valid in ES modules but TS might complain depending on config
        if (import.meta.env?.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
    } catch (e) {}

    return undefined;
};

const apiKey = getApiKey();

if (apiKey) {
    client = new GoogleGenAI({ apiKey });
} else {
    console.warn("API Key not found in process.env.API_KEY or VITE_API_KEY. AI features disabled.");
}

// --- Tool Definitions ---

const createPointTool: FunctionDeclaration = {
    name: 'create_point',
    description: 'Creates a point at specific (x, y) coordinates with an optional label. Use numeric coordinates. The screen center is usually around x=800, y=400, but varies.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            x: { type: Type.NUMBER, description: 'X Coordinate' },
            y: { type: Type.NUMBER, description: 'Y Coordinate' },
            label: { type: Type.STRING, description: 'Point Label (Ex: A, B, Center)' },
            id: { type: Type.STRING, description: 'A unique temporary ID to reference this point in subsequent calls (Ex: p1)' }
        },
        required: ['x', 'y', 'id']
    }
};

const createShapeTool: FunctionDeclaration = {
    name: 'create_shape',
    description: 'Creates a geometric shape (segment, line, or circle) connecting two existing points by their IDs.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ['segment', 'line', 'circle'], description: 'Shape type' },
            p1_id: { type: Type.STRING, description: 'ID of the first point (or circle center)' },
            p2_id: { type: Type.STRING, description: 'ID of the second point (or radius point)' },
        },
        required: ['type', 'p1_id', 'p2_id']
    }
};

const clearBoardTool: FunctionDeclaration = {
    name: 'clear_board',
    description: 'Clears the entire board, removing all points and shapes.',
    parameters: {
        type: Type.OBJECT,
        properties: {},
    }
};

const tools: Tool[] = [{
    functionDeclarations: [createPointTool, createShapeTool, clearBoardTool]
}];

// --- Service ---

export interface GeminiResponse {
    text: string;
    functionCalls?: any[];
}

export const askEuclides = async (prompt: string, currentWorkspace: Workspace, lang: Language): Promise<GeminiResponse> => {
    if (!client) {
        return { text: lang === 'pt' ? "A chave de API não foi configurada." : "API Key not configured." };
    }

    const instructionsPt = `
    ESTADO ATUAL DO QUADRO:
    Pontos: ${JSON.stringify(currentWorkspace.points)}
    Formas: ${JSON.stringify(currentWorkspace.shapes)}
    
    INSTRUÇÕES PARA A PERSONA (EUCLIDES):
    Você é Euclides de Alexandria, o "Pai da Geometria". 
    Seu tom deve ser:
    1. Culto e Sereno: Use um português claro e elegante. Fale como um mestre sábio.
    2. Analítico: ANALISE o "Estado Atual do Quadro".
    3. Didático: Cite os "Elementos" quando relevante.
    4. Auxiliador: Sugira propriedades ou desafios.
    
    REGRAS DE AÇÃO:
    1. Se lhe pedirem uma Proposição, construa-a passo a passo.
    2. Crie pontos primeiro, depois formas.
    3. Encerre demonstrações formais com "C.Q.D.".
    `;

    const instructionsEn = `
    CURRENT BOARD STATE:
    Points: ${JSON.stringify(currentWorkspace.points)}
    Shapes: ${JSON.stringify(currentWorkspace.shapes)}
    
    PERSONA INSTRUCTIONS (EUCLID):
    You are Euclid of Alexandria, the "Father of Geometry". 
    Your tone must be:
    1. Cultured and Serene: Use clear, elegant English. Speak like a wise master.
    2. Analytical: ANALYZE the "Current Board State".
    3. Didactic: Cite the "Elements" when relevant.
    4. Helpful: Suggest properties or challenges.
    
    ACTION RULES:
    1. If asked for a Proposition, build it step-by-step.
    2. Create points first, then shapes.
    3. End formal proofs with "Q.E.D.".
    `;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: (lang === 'pt' ? instructionsPt : instructionsEn) + "\n\nStudent: " + prompt,
            config: {
                tools: tools,
                systemInstruction: lang === 'pt' 
                    ? "Você é Euclides. Ensina geometria via construções e diálogo." 
                    : "You are Euclid. Teach geometry via constructions and dialogue.",
                temperature: 0.3 
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || "";
        const functionCalls = response.candidates?.[0]?.content?.parts
            ?.filter(p => p.functionCall)
            ?.map(p => p.functionCall);

        return { text, functionCalls };

    } catch (error) {
        console.error("Error asking Gemini:", error);
        return { text: lang === 'pt' 
            ? "Perdoe-me, nobre estudante. Minha conexão com a Biblioteca falhou." 
            : "Forgive me, noble student. My connection to the Library has failed." };
    }
};
