export type Language = 'pt' | 'en';

export const getBrowserLanguage = (): Language => {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language.toLowerCase();
  return lang.startsWith('pt') ? 'pt' : 'en';
};

export const t = {
  pt: {
    tools: {
      SELECT: 'Mover',
      POINT: 'Ponto',
      SEGMENT: 'Segmento',
      LINE: 'Reta',
      CIRCLE: 'Círculo',
      TEXT: 'Texto',
      ERASER: 'Apagar'
    },
    toolbar: {
      undo: 'Desfazer',
      redo: 'Refazer',
      clear: 'Limpar'
    },
    canvas: {
      scale: 'Escala',
      instructions: {
        POINT: 'Clique para criar pontos',
        SELECT: 'Arraste objetos para mover, ou o fundo para navegar',
        SEGMENT: 'Selecione dois pontos',
        LINE: 'Selecione dois pontos',
        CIRCLE: 'Selecione centro e raio',
        TEXT: 'Clique para adicionar texto',
        ERASER: 'Clique em objetos para apagar'
      },
      support: 'Apoiar o projeto',
      version: 'Euclides Web v1.6'
    },
    chat: {
      title: 'O Geômetra',
      subtitle: 'Alexandria AI',
      placeholder: 'Pergunte ao mestre...',
      initialMessage: 'Saudações, estudante. Sou **Euclides**. O quadro está à vossa disposição. Desejas que eu demonstre a *Proposição 1* dos Elementos, ou preferes que eu analise vossas construções atuais?',
      thinking: 'Traçando as linhas necessárias no papiro digital...',
      error: 'Perdoe-me, houve uma perturbação no raciocínio lógico.',
      apiKeyMissing: 'A chave de API não foi configurada.'
    },
    view: {
      snap: 'Imã (Snap)',
      grid: 'Grade',
      zoomIn: 'Aumentar Zoom',
      zoomOut: 'Diminuir Zoom',
      reset: 'Resetar Visualização',
      chat: 'Conversar com IA'
    },
    tabs: {
      new: 'Nova Demonstração',
      untitled: 'Sem Título'
    }
  },
  en: {
    tools: {
      SELECT: 'Move',
      POINT: 'Point',
      SEGMENT: 'Segment',
      LINE: 'Line',
      CIRCLE: 'Circle',
      TEXT: 'Text',
      ERASER: 'Erase'
    },
    toolbar: {
      undo: 'Undo',
      redo: 'Redo',
      clear: 'Clear'
    },
    canvas: {
      scale: 'Scale',
      instructions: {
        POINT: 'Click to create points',
        SELECT: 'Drag objects to move, or background to pan',
        SEGMENT: 'Select two points',
        LINE: 'Select two points',
        CIRCLE: 'Select center and radius',
        TEXT: 'Click to add text',
        ERASER: 'Click objects to delete'
      },
      support: 'Support the project',
      version: 'Euclides Web v1.6'
    },
    chat: {
      title: 'The Geometer',
      subtitle: 'Alexandria AI',
      placeholder: 'Ask the master...',
      initialMessage: 'Greetings, student. I am **Euclid**. The board is at your disposal. Shall I demonstrate *Proposition 1* of the Elements, or would you prefer I analyze your current constructions?',
      thinking: 'Tracing the necessary lines on the digital papyrus...',
      error: 'Forgive me, there was a disturbance in the logical reasoning.',
      apiKeyMissing: 'API Key not configured.'
    },
    view: {
      snap: 'Magnet (Snap)',
      grid: 'Grid',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      reset: 'Reset View',
      chat: 'Chat with AI'
    },
    tabs: {
      new: 'New Demonstration',
      untitled: 'Untitled'
    }
  }
};