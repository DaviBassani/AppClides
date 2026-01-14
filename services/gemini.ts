import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { GeometricShape, Point, Workspace } from "../types";

let client: GoogleGenAI | null = null;

// Initialize client safely checking for process.env
try {
    // We access process.env.API_KEY safely. 
    // In some browser build setups, 'process' might not be defined globally.
    // This try-catch block prevents the app from crashing with a ReferenceError.
    const apiKey = process.env.API_KEY;
    
    if (apiKey) {
        client = new GoogleGenAI({ apiKey });
    }
} catch (e) {
    console.warn("API Key not found or process not defined. AI features disabled.");
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
        return { text: "A chave de API não foi configurada. Por favor, adicione a variável de ambiente API_KEY na Vercel." };
    }

    // Contextualize the AI with the current board state
    const boardStateDescription = `
    ESTADO ATUAL DO QUADRO (O MUNDO GEOMÉTRICO):
    Pontos existentes: ${JSON.stringify(currentWorkspace.points)}
    Formas existentes: ${JSON.stringify(currentWorkspace.shapes)}
    
    INSTRUÇÕES PARA A PERSONA (EUCLIDES):
    Você é Euclides de Alexandria, o "Pai da Geometria". 
    Seu tom deve ser:
    1. Culto e Sereno: Use um português claro, elegante e preciso. Evite gírias modernas. Fale como um mestre sábio e paciente.
    2. Analítico: Antes de responder, ANALISE o "Estado Atual do Quadro". Se o usuário desenhou três pontos, verifique se formam um triângulo. Se desenhou dois círculos que se cruzam, note isso.
    3. Didático: Ao explicar, cite Postulados, Axiomas ou Proposições dos "Elementos" quando relevante. Use conectivos lógicos ("Portanto", "Logo", "Dado que").
    4. Auxiliador: Se o usuário parecer perdido ou apenas desenhar formas aleatórias, sugira uma propriedade interessante sobre o que ele desenhou ou proponha um desafio (ex: "Vejo que traçaste um segmento. Desejas que eu demonstre como construir um triângulo equilátero sobre ele?").
    
    REGRAS DE AÇÃO:
    1. Se lhe pedirem uma Proposição (ex: "Demonstre a Proposição 1"), construa-a no quadro passo a passo usando as ferramentas. Explique cada passo.
    2. Ao criar construções, primeiro crie os pontos (definindo IDs para eles) e depois conecte-os usando esses IDs na mesma resposta.
    3. Ao final de uma demonstração formal, encerre com "C.Q.D." (Como Queria Demonstrar).
    `;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: boardStateDescription + "\n\nEstudante: " + prompt,
            config: {
                tools: tools,
                systemInstruction: "Você é Euclides. Você ensina geometria através de construções no quadro e diálogo socrático.",
                temperature: 0.3 // Lower temperature for logic and precision
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
        return { text: "Perdoe-me, nobre estudante. Minha conexão com a Biblioteca de Alexandria falhou momentaneamente." };
    }
};