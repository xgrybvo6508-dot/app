// Computes an embedding for one node's text and stores it on `nodes.embedding`
// (pgvector) — this is the RAG index the `chat` function's retrieval step reads.
// The Claude API has no native embeddings endpoint, so this uses Voyage AI
// (Anthropic's recommended embeddings partner) — swap the provider here if
// the project chooses differently, the rest of the pipeline is unaffected.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const VOYAGE_API_KEY = Deno.env.get('VOYAGE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface EmbedRequestBody {
  nodeId: string;
  text: string;
}

Deno.serve(async (req: Request) => {
  if (!VOYAGE_API_KEY) {
    return new Response(JSON.stringify({ error: 'VOYAGE_API_KEY not configured' }), {
      status: 500,
    });
  }

  const { nodeId, text } = (await req.json()) as EmbedRequestBody;

  const embedResponse = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: [text], model: 'voyage-3' }),
  });

  if (!embedResponse.ok) {
    const errorText = await embedResponse.text();
    return new Response(JSON.stringify({ error: errorText }), { status: embedResponse.status });
  }

  const embedData = await embedResponse.json();
  const embedding: number[] = embedData.data[0].embedding;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from('nodes').update({ embedding }).eq('id', nodeId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
});
