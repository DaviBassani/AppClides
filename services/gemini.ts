import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { GeometricShape, Point, Workspace } from "../types";

let client: GoogleGenAI | null = null;

// Initialize client only if key is available
try {
    if (process.env.API_KEY) {
        client = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
} catch (e) {
    console.error("Failed to initialize Gemini client", e);
}

// --- Tool Definitions ---

const createPointTool: FunctionDeclaration = {
    name: 'create_point',
    description: 'Cria um ponto em uma coordenada específica (x, y) com um rótulo opcional (label). Use coordenadas numéricas. O centro da tela geralmente é próximo de x=800, y=400, mas varia.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            x: { type: Type.NUMBER, description: 'Coordenada X' },
            y: { type: Type.NUMBER, description: 'Coordenada Y' },
            label: { type: Type.STRING, description: 'Rótulo do ponto (Ex: A, B, Centro)' },
            id: { type: Type.STRING, description: 'Um ID único temporário para referenciar este ponto em chamadas subsequentes (Ex: p1)' }
        },
        required: ['x', 'y', 'id']
    }
};

const createShapeTool: FunctionDeclaration = {
    name: 'create_shape',
    description: 'Cria uma forma geométrica (segmento, reta ou círculo) conectando dois pontos existentes pelos seus IDs.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ['segment', 'line', 'circle'], description: 'Tipo da forma' },
            p1_id: { type: Type.STRING, description: 'ID do primeiro ponto (ou centro do círculo)' },
            p2_id: { type: Type.STRING, description: 'ID do segundo ponto (ou ponto do raio)' },
        },
        required: ['type', 'p1_id', 'p2_id']
    }
};

const clearBoardTool: FunctionDeclaration = {
    name: 'clear_board',
    description: 'Limpa todo o quadro, removendo todos os pontos e formas.',
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

export const askEuclides = async (prompt: string, currentWorkspace: Workspace): Promise<GeminiResponse> => {
    if (!client) {
        return { text: "A chave de API não foi configurada." };
    }

    // Contextualize the AI with the current board state
    const boardStateDescription = `
    ESTADO ATUAL DO QUADRO:
    Pontos existentes: ${JSON.stringify(currentWorkspace.points)}
    Formas existentes: ${JSON.stringify(currentWorkspace.shapes)}
    
    INSTRUÇÕES DE AGENTE:
    Você é Euclides, pai da geometria. Você tem controle total sobre este quadro (whiteboard).
    Você PODE e DEVE usar as ferramentas disponíveis para demonstrar visualmente o que o usuário pede.
    
    1. Se o usuário pedir para desenhar, construir ou demonstrar algo (ex: "Faça um triângulo equilátero"), USE AS FERRAMENTAS para criar os pontos e formas.
    2. Ao criar formas compostas, primeiro crie os pontos (definindo IDs para eles) e depois conecte-os usando esses IDs na mesma resposta.
    3. Responda em Português do Brasil de forma didática.
    4. Explique o axioma ou teorema enquanto desenha.
    `;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: boardStateDescription + "\n\nUsuário: " + prompt,
            config: {
                tools: tools,
                systemInstruction: "Você é um professor de Geometria Euclidiana interativo. Use o quadro para ensinar.",
                temperature: 0.4 // Lower temperature for more precise tool usage
            }
        });

        // Extract text
        const text = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || "";
        
        // Extract function calls
        const functionCalls = response.candidates?.[0]?.content?.parts
            ?.filter(p => p.functionCall)
            ?.map(p => p.functionCall);

        return { text, functionCalls };

    } catch (error) {
        console.error("Error asking Gemini:", error);
        return { text: "Desculpe, ocorreu um erro ao processar sua solicitação geométrica." };
    }
};