import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const apiKey = process.env.API_KEY;

    if (!apiKey) {
        console.error("[API] Error: API_KEY is missing");
        return new Response(JSON.stringify({ 
            error: "Server Configuration Error: API_KEY is missing." 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const { prompt, points, shapes, texts, lang } = body;
        
        const client = new GoogleGenAI({ apiKey });

        // --- Tool Definitions ---

        const createPointTool: FunctionDeclaration = {
            name: 'create_point',
            description: 'Creates a point at (x, y). ID required.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    label: { type: Type.STRING },
                    id: { type: Type.STRING }
                },
                required: ['x', 'y', 'id']
            }
        };

        const createShapeTool: FunctionDeclaration = {
            name: 'create_shape',
            description: 'Connects two points. CRITICAL: Distinguish between SEGMENT (finite) and LINE (infinite).',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    type: { 
                        type: Type.STRING, 
                        enum: ['segment', 'line', 'circle'],
                        description: 'Use "segment" for polygon sides (finite). Use "line" for infinite construction lines.'
                    },
                    p1_id: { type: Type.STRING },
                    p2_id: { type: Type.STRING },
                },
                required: ['type', 'p1_id', 'p2_id']
            }
        };

        const createTextTool: FunctionDeclaration = {
            name: 'create_text',
            description: 'Creates a label at (x,y).',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    content: { type: Type.STRING },
                },
                required: ['x', 'y', 'content']
            }
        };

        const clearBoardTool: FunctionDeclaration = {
            name: 'clear_board',
            description: 'Clears the board.',
            parameters: { type: Type.OBJECT, properties: {} }
        };

        const tools: Tool[] = [{
            functionDeclarations: [createPointTool, createShapeTool, createTextTool, clearBoardTool]
        }];

        // --- System Instruction ---

        const systemInstruction = `
        You are Euclid of Alexandria.
        
        **STRICT GEOMETRIC DEFINITIONS:**
        1. **SEGMENT (segmento):** Finite connection between two points. Used for triangles, squares, polygons, and radii. 
           -> Tool: create_shape(type='segment', ...)
        2. **LINE (reta):** Infinite line passing through two points. Used for extending sides or finding intersections far away.
           -> Tool: create_shape(type='line', ...)
        
        **RULES:**
        - If the user asks for a "Triangle", you MUST use **SEGMENTS**. Never use Lines for a closed shape.
        - If the user asks to "extend a side" or "draw a line through A and B", use **LINE**.
        - Explain your steps elegantly as you draw.
        - Use LaTeX for math labels ($A$, $AB$).
        
        **EXECUTION:**
        - Do not calculate the final answer immediately. Simulate the construction steps (Compass & Straightedge).
        - To make an Equilateral Triangle on AB:
          1. Draw Segment AB.
          2. Draw Circle center A radius B.
          3. Draw Circle center B radius A.
          4. Find intersection C.
          5. Draw Segment AC and Segment BC.
        `;

        const context = `
        Current Board State: ${Object.keys(points || {}).length} points, ${shapes?.length || 0} shapes.
        User Language: ${lang}.
        User Request: ${prompt}
        `;

        const response = await client.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: context,
            config: {
                tools: tools,
                systemInstruction: systemInstruction,
                temperature: 0.2, // Low temp for precision
                maxOutputTokens: 2048,
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || "";
        const functionCalls = response.candidates?.[0]?.content?.parts
            ?.filter(p => p.functionCall)
            ?.map(p => p.functionCall);

        return new Response(JSON.stringify({ text, functionCalls }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("[API] Error:", error);
        return new Response(JSON.stringify({ 
            error: "Internal Server Error", 
            details: error.message 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}