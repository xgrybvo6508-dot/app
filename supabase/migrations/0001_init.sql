-- Cloud mirror of the local expo-sqlite schema (see lib/db/schema.ts) plus
-- pgvector for RAG embeddings — the plan's "Финальные архитектурные решения"
-- deliberately puts the single vector store here instead of also running
-- sqlite-vec on-device, since chat/RAG already require network for the LLM call.

create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  status text not null default 'active',
  tags jsonb not null default '[]',
  attributes jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  embedding vector(1536)
);

create index if not exists idx_nodes_user on nodes(user_id);
create index if not exists idx_nodes_type on nodes(user_id, type);
create index if not exists idx_nodes_status on nodes(user_id, status);
create index if not exists idx_nodes_updated_at on nodes(user_id, updated_at);
-- cosine similarity search for RAG retrieval (see lib/graph "снимок графа" / RAG layer)
create index if not exists idx_nodes_embedding on nodes using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table nodes enable row level security;
create policy "nodes_owner_all" on nodes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_id uuid not null references nodes(id) on delete cascade,
  to_id uuid not null references nodes(id) on delete cascade,
  type text not null,
  created_at timestamptz not null default now(),
  weight real,
  note text
);

create index if not exists idx_edges_user on edges(user_id);
create index if not exists idx_edges_from on edges(from_id);
create index if not exists idx_edges_to on edges(to_id);
create index if not exists idx_edges_type on edges(user_id, type);

alter table edges enable row level security;
create policy "edges_owner_all" on edges for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  node_id uuid references nodes(id) on delete set null,
  edge_id uuid references edges(id) on delete set null,
  from_status text,
  to_status text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);

create index if not exists idx_activity_log_user ON activity_log(user_id);
create index if not exists idx_activity_log_created_at on activity_log(user_id, created_at);
create index if not exists idx_activity_log_type on activity_log(user_id, type);

alter table activity_log enable row level security;
create policy "activity_log_owner_all" on activity_log for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- last-write-wins sync (plan's "Финальные архитектурные решения"): bump
-- updated_at server-side on every UPDATE so client/server clocks agree.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger nodes_set_updated_at
  before update on nodes
  for each row execute function set_updated_at();

-- Output of the weekly-digest Edge Function (cron) — the client reads the
-- latest row instead of recomputing on-device, and "как я вообще" in chat
-- can also trigger a fresh on-demand computation (see plan's Insight-движок).
create table if not exists weekly_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  energy_index integer not null,
  funnel jsonb not null default '{}',
  stale_node_titles jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table weekly_digests enable row level security;
create policy "weekly_digests_owner_select" on weekly_digests for select
  using (auth.uid() = user_id);
