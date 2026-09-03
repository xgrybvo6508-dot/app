// Supabase Edge Function (Deno) — the only place that calls the Claude API,
// per plan's "Финальные архитектурные решения": the Anthropic key never
// reaches the mobile client. Serves BOTH "Обращение" (mode: "chat") and
// "Мышление" (mode: "think") — same endpoint, different system prompt, per
// the plan's "Общий примитив: режим «Мышление»".
//
// Request body: { mode: 'chat' | 'think', userMessage: string,
//                 snapshot: GraphSnapshot, ragNodes: RagNode[], nodeTitle?: string }
// GraphSnapshot/RagNode mirror lib/graph's summarizeGraph()/findNeighbors() output —
// the client computes the cheap snapshot + RAG selection locally (from data already
// synced to Postgres) and sends only that slice, not the whole graph.

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
// Update to whichever current Claude model this project should call.
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5';

interface GraphSnapshot {
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  staleNodeTitles: string[];
  energyIndex: number;
}

interface RagNode {
  id: string;
  title: string;
  type: string;
  body?: string;
}

interface ChatRequestBody {
  mode: 'chat' | 'think';
  userMessage: string;
  snapshot: GraphSnapshot;
  ragNodes: RagNode[];
  nodeTitle?: string;
}

const CHAT_SYSTEM_PROMPT = `Ты — "второй мозг" пользователя внутри приложения "Мотор мышления".
Отвечай ТОЛЬКО на основе переданного снимка графа и найденных узлов — никогда не давай общих советов.
Каждый ответ должен ссылаться на конкретные названия узлов из контекста.
Если предлагаешь действие, формулируй его как конкретный шаг (создать задачу, связать узлы), а не абстракцию.`;

const THINK_SYSTEM_PROMPT = `Ты ведёшь пользователя через сократовский разбор одного узла его графа мыслей ("режим Мышление").
Задавай по одному вопросу за раз: зачем это, кому выгодно/невыгодно, какие есть альтернативы или контраргументы,
с чем это уже связано в графе. Не давай советов — только вопросы, которые помогают пользователю самому разобраться.`;

function buildUserContent(body: ChatRequestBody): string {
  const snapshotText = `Граф: ${JSON.stringify(body.snapshot)}`;
  const ragText = body.ragNodes.length
    ? `Релевантные узлы:\n${body.ragNodes.map((n) => `- [${n.type}] ${n.title}${n.body ? `: ${n.body}` : ''}`).join('\n')}`
    : 'Релевантных узлов не найдено.';
  const nodeText = body.nodeTitle ? `Разбираемый узел: ${body.nodeTitle}` : '';
  return [snapshotText, ragText, nodeText, `Сообщение пользователя: ${body.userMessage}`]
    .filter(Boolean)
    .join('\n\n');
}

Deno.serve(async (req: Request) => {
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
    });
  }

  const body = (await req.json()) as ChatRequestBody;
  const systemPrompt = body.mode === 'think' ? THINK_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: buildUserContent(body) }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(JSON.stringify({ error: errorText }), { status: response.status });
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '';
  return new Response(JSON.stringify({ text }), {
    headers: { 'content-type': 'application/json' },
  });
});
