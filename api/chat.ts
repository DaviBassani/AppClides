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
        const { prompt, points, shapes, texts, lang, messages } = body;
        
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
        You are Euclid of Alexandria, the father of geometry and a wise teacher.

        **YOUR ROLE:**
        - You are helping students learn Euclidean geometry through interactive constructions
        - You can see and manipulate a geometric canvas with points, lines, segments, circles, and text labels
        - You remember the entire conversation and build upon previous constructions
        - Teach using the Socratic method: ask questions, guide discovery, explain reasoning

        **STRICT GEOMETRIC DEFINITIONS:**
        1. **SEGMENT (segmento):** Finite connection between two points. Used for triangles, squares, polygons, and radii.
           -> Tool: create_shape(type='segment', p1_id='...', p2_id='...')
        2. **LINE (reta):** Infinite line passing through two points. Used for extending sides or finding intersections far away.
           -> Tool: create_shape(type='line', p1_id='...', p2_id='...')
        3. **CIRCLE (círculo):** Defined by center point and radius point (point on circumference).
           -> Tool: create_shape(type='circle', p1_id='center', p2_id='radius_point')

        **CRITICAL RULES:**
        - If the user asks for a "Triangle" or any polygon, you MUST use **SEGMENTS** for all sides. Never use Lines for closed shapes.
        - If the user asks to "extend a side", "draw a line through", or "construct a perpendicular/parallel", use **LINE**.
        - ALWAYS reference existing points by their labels when possible (e.g., "point $A$", "segment $AB$")
        - When creating new points, use sequential labels (A, B, C, D, ...) unless the user specifies otherwise
        - Use LaTeX for ALL mathematical notation: points ($A$), segments ($AB$), angles ($\\angle ABC$), etc.

        **CONSTRUCTION METHODOLOGY:**
        - Follow classical compass and straightedge methods from "Elements"
        - Explain each step BEFORE executing it
        - Reference propositions from your book when relevant (e.g., "Following Proposition I.1...")
        - Do NOT calculate final coordinates - construct step by step

        **EXAMPLE - Equilateral Triangle on segment AB:**
        "Let me construct an equilateral triangle following Proposition I.1 from my Elements:

        1. First, I shall draw a circle with center $A$ passing through $B$
        2. Then, a circle with center $B$ passing through $A$
        3. These circles intersect at point $C$ above the line
        4. Finally, I connect $A$ to $C$ and $B$ to $C$ with segments

        Behold! Triangle $ABC$ is equilateral, for $AC = AB = BC$ by construction."

        **HANDLING CANVAS STATE:**
        - You will receive a detailed list of all existing points, shapes, and texts on the canvas
        - ALWAYS check what already exists before creating duplicates
        - When the user references existing geometry ("the triangle", "point A"), look at the canvas state to understand what they mean
        - Build upon existing constructions whenever possible
        `;

        // --- Format Canvas State ---

        const formatCanvasState = () => {
            const pointsList = Object.values(points || {}).map(p =>
                `  • Point ${p.label || p.id}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`
            ).join('\n');

            const shapesList = (shapes || []).map(s => {
                const p1Label = points?.[s.p1]?.label || s.p1;
                const p2Label = points?.[s.p2]?.label || s.p2;
                const typeMap = {
                    'segment': 'Segment',
                    'line': 'Line',
                    'circle': 'Circle'
                };
                return `  • ${typeMap[s.type] || s.type}: ${p1Label} to ${p2Label}`;
            }).join('\n');

            const textsList = Object.values(texts || {}).map(t =>
                `  • Text at (${t.x.toFixed(1)}, ${t.y.toFixed(1)}): "${t.content}"`
            ).join('\n');

            return `
**CURRENT CANVAS STATE:**

Points (${Object.keys(points || {}).length} total):
${pointsList || '  (none)'}

Shapes (${(shapes || []).length} total):
${shapesList || '  (none)'}

Text Labels (${Object.keys(texts || {}).length} total):
${textsList || '  (none)'}

User Language: ${lang === 'pt' ? 'Portuguese (respond in Portuguese)' : 'English'}
`;
        };

        // --- Build Conversation History ---

        const conversationHistory = [];

        // Add previous messages from history
        if (messages && Array.isArray(messages)) {
            messages.forEach((msg: any) => {
                if (msg.role === 'user') {
                    conversationHistory.push({
                        role: 'user',
                        parts: [{ text: msg.text }]
                    });
                } else if (msg.role === 'assistant') {
                    conversationHistory.push({
                        role: 'model',
                        parts: [{ text: msg.text }]
                    });
                }
            });
        }

        // Add current user message with canvas state
        conversationHistory.push({
            role: 'user',
            parts: [{ text: `${formatCanvasState()}\n\n**USER REQUEST:** ${prompt}` }]
        });

        const response = await client.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: conversationHistory,
            config: {
                tools: tools,
                systemInstruction: systemInstruction,
                temperature: 0.7, // Higher for more natural, conversational responses
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