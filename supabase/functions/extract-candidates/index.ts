// Shared "массовый ввод" extractor reused by both Обучение (bulk vocab/notes
// paste) and Ресерч (source text → candidate claims) — one endpoint, per the
// plan's "не два разных парсера". Replaces the naive sentence-split stand-in
// used locally in lib/ai / app/(tabs)/research.tsx once this is deployed.

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5';

interface ExtractRequestBody {
  text: string;
  /** Tunes the extraction prompt: standalone facts/vocab vs. discrete claims to fact-check. */
  purpose: 'learning' | 'research';
}

const PROMPTS: Record<ExtractRequestBody['purpose'], string> = {
  learning:
    'Разбей текст на отдельные единицы знания для заучивания (термин+определение, факт, формула). Верни JSON-массив строк, каждая — одна единица.',
  research:
    'Разбей текст на отдельные проверяемые утверждения (claims). Верни JSON-массив строк, каждая — одно утверждение.',
};

Deno.serve(async (req: Request) => {
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
    });
  }

  const { text, purpose } = (await req.json()) as ExtractRequestBody;

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
      system: `${PROMPTS[purpose]} Отвечай ТОЛЬКО валидным JSON-массивом строк, без пояснений.`,
      messages: [{ role: 'user', content: text }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(JSON.stringify({ error: errorText }), { status: response.status });
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text ?? '[]';
  let candidates: string[] = [];
  try {
    candidates = JSON.parse(raw);
  } catch {
    candidates = raw.split('\n').filter(Boolean);
  }

  return new Response(JSON.stringify({ candidates }), {
    headers: { 'content-type': 'application/json' },
  });
});
