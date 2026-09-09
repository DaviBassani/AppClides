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

        // Detect mode from prompt
        const isDemonstrateMode = /\[(DEMONSTRAR|DEMONSTRATE)\]/i.test(prompt);
        const isExplainMode = /\[(EXPLICAR|EXPLAIN)\]/i.test(prompt);

        // Clean the prompt (remove mode markers)
        const cleanPrompt = prompt.replace(/\[(DEMONSTRAR|DEMONSTRATE|EXPLICAR|EXPLAIN)\]\s*/gi, '');

        const client = new GoogleGenAI({ apiKey });

        // --- Tool Definitions ---

        const createPointTool: FunctionDeclaration = {
            name: 'create_point',
            description: 'Creates a point at (x, y). ID required. Use color to differentiate GIVEN data from CONSTRUCTION steps.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    label: { type: Type.STRING },
                    id: { type: Type.STRING },
                    color: {
                        type: Type.STRING,
                        description: 'Hex color code. Use #3b82f6 (blue) for GIVEN/initial points, #22c55e (green) for CONSTRUCTION/demonstration points.'
                    }
                },
                required: ['x', 'y', 'id']
            }
        };

        const createShapeTool: FunctionDeclaration = {
            name: 'create_shape',
            description: 'Connects two points. CRITICAL: Distinguish between SEGMENT (finite), LINE (infinite both directions), and RAY (infinite one direction). Use color to differentiate GIVEN from CONSTRUCTION.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    type: {
                        type: Type.STRING,
                        enum: ['segment', 'line', 'ray', 'circle'],
                        description: 'Use "segment" for polygon sides (finite). Use "line" for infinite lines in both directions. Use "ray" for semi-infinite lines starting at p1 through p2. Use "circle" for circles.'
                    },
                    p1_id: { type: Type.STRING },
                    p2_id: { type: Type.STRING },
                    color: {
                        type: Type.STRING,
                        description: 'Hex color code. Use #3b82f6 (blue) for GIVEN/initial shapes, #22c55e (green) for CONSTRUCTION/demonstration shapes.'
                    }
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

        // Build mode-specific instruction
        let modeInstruction = '';

        if (isDemonstrateMode) {
            // DEMONSTRATE MODE: Focus on execution, minimal text
            modeInstruction = `
        ═══════════════════════════════════════════════════════════════
        🎯 MODE: DEMONSTRATION (Execute on Canvas)
        ═══════════════════════════════════════════════════════════════

        YOU ARE IN DEMONSTRATION MODE!

        **YOUR TASK:**
        - EXECUTE the construction on the canvas using function calls
        - Use MINIMAL text (just step numbers and brief labels)
        - MAXIMUM focus on calling create_point and create_shape
        - Proposition I.1 = 8 function calls (2 points + 1 segment + 2 circles + 1 point + 2 segments)

        **TEXT FORMAT:**
        DADO (blue):
        1. [call create_point for A]
        2. [call create_point for B]
        3. [call create_shape for segment AB]

        DEMONSTRAÇÃO (green):
        4. [call create_shape for circle A→B]
        5. [call create_shape for circle B→A]
        6. [call create_point for C]
        7. [call create_shape for segment AC]
        8. [call create_shape for segment BC]

        CONCLUSÃO: △ABC equilátero.

        **DO NOT write long explanations - JUST EXECUTE!**
        ═══════════════════════════════════════════════════════════════`;

        } else if (isExplainMode) {
            // EXPLAIN MODE: Focus on pedagogy, NO execution
            modeInstruction = `
        ═══════════════════════════════════════════════════════════════
        📚 MODE: EXPLANATION (Teach without Drawing)
        ═══════════════════════════════════════════════════════════════

        YOU ARE IN EXPLANATION MODE!

        **YOUR TASK:**
        - EXPLAIN the construction pedagogically
        - Use detailed text, LaTeX, and historical context
        - DO NOT call any functions (no create_point, no create_shape)
        - Focus on WHY and HOW, not on executing

        **EXAMPLE RESPONSE:**
        "A Proposição I.1 dos Elementos demonstra a construção de um triângulo equilátero.

        **Método:**
        1. Dado um segmento $AB$, traçamos um círculo com centro em $A$ e raio $AB$
        2. Traçamos outro círculo com centro em $B$ e raio $BA$
        3. Esses círculos se interceptam em dois pontos; escolhemos um e chamamos de $C$
        4. Conectamos $A$ a $C$ e $B$ a $C$ com segmentos

        **Por que funciona?**
        Pela definição de círculo, $AC = AB$ (raios do primeiro círculo) e $BC = BA$ (raios do segundo círculo).
        Portanto, $AC = AB = BC$, e o triângulo $ABC$ é equilátero por definição."

        **DO NOT execute anything - JUST EXPLAIN!**
        ═══════════════════════════════════════════════════════════════`;

        } else {
            // DEFAULT MODE
            modeInstruction = `
You are a geometry construction assistant. When the user asks to demonstrate or construct anything:
- MUST use create_point() and create_shape() function calls to draw on the canvas
- Explanations without function calls are worthless - always execute what you describe
- Minimum 5 function calls for any complete construction
- Use color='#3b82f6' (blue) for GIVEN geometry, color='#22c55e' (green) for construction steps

Shape types: segment (finite), line (infinite both ways), ray (semi-infinite), circle

CRITICAL: When referencing existing points in create_shape(p1_id, p2_id), use the actual Point IDs shown in the canvas state (e.g., abc123), NOT the labels.`;
        }

        // Common instructions for all modes
        const commonInstructions = `

        You are Euclid of Alexandria, the father of geometry and a wise teacher.

        **STRICT GEOMETRIC DEFINITIONS:**
        1. **SEGMENT (segmento):** Finite connection between two points. Used for triangles, squares, polygons, and radii.
           -> Tool: create_shape(type='segment', p1_id='...', p2_id='...')
        2. **LINE (reta):** Infinite line passing through two points in both directions. Used for extending sides or finding intersections.
           -> Tool: create_shape(type='line', p1_id='...', p2_id='...')
        3. **RAY (semi-reta):** Semi-infinite line starting at p1 and extending infinitely through p2. Used for angles and directed constructions.
           -> Tool: create_shape(type='ray', p1_id='start', p2_id='direction')
        4. **CIRCLE (círculo):** Defined by center point and radius point (point on circumference).
           -> Tool: create_shape(type='circle', p1_id='center', p2_id='radius_point')

        **COLOR USAGE:**
        - 🔵 BLUE (#3b82f6): DADO/GIVEN geometry
        - 🟢 GREEN (#22c55e): DEMONSTRAÇÃO/CONSTRUCTION steps

        **AVAILABLE TOOLS:**
        - create_point(x, y, label, id, color): Creates a point
        - create_shape(type, p1_id, p2_id, color): Creates shapes (segment, line, circle)
        - create_text(x, y, content): Creates text labels
        - clear_board(): Clears the canvas
        `;

        const systemInstruction = modeInstruction + commonInstructions;

        // --- Format Canvas State ---

        const formatCanvasState = () => {
            const pointsList = Object.values(points || {}).map(p =>
                `  • [${p.id}] ${p.label || 'Point'} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`
            ).join('\n');

            const shapesList = (shapes || []).map(s => {
                const p1Label = points?.[s.p1]?.label || points?.[s.p1]?.id || s.p1;
                const p2Label = points?.[s.p2]?.label || points?.[s.p2]?.id || s.p2;
                const typeMap = {
                    'segment': 'Segment',
                    'line': 'Line',
                    'circle': 'Circle'
                };
                return `  • ${typeMap[s.type] || s.type}: ${p1Label} → ${p2Label} (IDs: ${s.p1} → ${s.p2})`;
            }).join('\n');

            const textsList = Object.values(texts || {}).map(t =>
                `  • [${t.id}] Text at (${t.x.toFixed(1)}, ${t.y.toFixed(1)}): "${t.content}"`
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

CRITICAL: When calling create_shape(p1_id, p2_id), ALWAYS use the actual Point IDs (the [ID] shown above), NOT the labels!
`;
        };

        // --- Build Conversation History ---

        const conversationHistory: any[] = [];

        // Add previous messages from history
        if (messages && Array.isArray(messages)) {
            messages.forEach((msg: any) => {
                if (msg.role === 'user') {
                    conversationHistory.push({
                        role: 'user',
                        parts: [{ text: msg.text }]
                    });
                } else if (msg.role === 'assistant') {
                    const parts: any[] = [];
                    if (msg.text) {
                        parts.push({ text: msg.text });
                    }
                    if (msg.functionCalls && Array.isArray(msg.functionCalls)) {
                        msg.functionCalls.forEach((fc: any) => {
                            parts.push({ functionCall: fc });
                        });
                    }
                    conversationHistory.push({
                        role: 'model',
                        parts: parts.length > 0 ? parts : [{ text: '' }]
                    });
                }
            });
        }

        // Add current user message with canvas state
        conversationHistory.push({
            role: 'user',
            parts: [{ text: `${formatCanvasState()}\n\n**USER REQUEST:** ${cleanPrompt}` }]
        });

        const response = await client.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: conversationHistory,
            config: {
                tools: tools,
                systemInstruction: systemInstruction,
                temperature: 0.3, // Lower for better tool-calling adherence and deterministic responses
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