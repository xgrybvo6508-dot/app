// Cron-triggered Edge Function (schedule via Supabase's Scheduled Functions /
// pg_cron, e.g. weekly) — computes the same signals as lib/insight (kept as
// a separate implementation here since Deno edge functions and the Expo app
// don't share a bundler; if this drifts from lib/insight, port fixes both ways)
// and stores one row per user per week for the client to read, per plan's
// "Когда и как показывать: еженедельный дайджест, не ежедневный пуш".
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function startOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: users, error: usersError } = await supabase
    .from('activity_log')
    .select('user_id')
    .gte('created_at', thirtyDaysAgo);

  if (usersError) {
    return new Response(JSON.stringify({ error: usersError.message }), { status: 500 });
  }

  const userIds = [...new Set((users ?? []).map((u) => u.user_id as string))];
  const weekStart = startOfWeek(now);

  for (const userId of userIds) {
    const { data: events } = await supabase
      .from('activity_log')
      .select('type, created_at, from_status, to_status')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo);

    const all = events ?? [];
    const daysBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 86_400_000;
    const inWindow = (days: number) => all.filter((e) => daysBetween(now, new Date(e.created_at)) <= days);

    const recentPerDay = inWindow(7).length / 7;
    const baselinePerDay = inWindow(30).length / 30;
    const cadenceRatio = baselinePerDay === 0 ? (recentPerDay > 0 ? 1 : 0) : recentPerDay / baselinePerDay;

    const week = inWindow(7);
    const created = week.filter((e) => e.type === 'node_created').length;
    const completed = week.filter((e) => e.type === 'status_changed' && e.to_status === 'done').length;
    const completionVelocity = created === 0 ? (completed > 0 ? 1 : 0) : completed / created;

    const regressions = week.filter(
      (e) => e.type === 'status_changed' && e.to_status === 'active' && (e.from_status === 'done' || e.from_status === 'in_progress'),
    ).length;

    const activeDays = new Set(all.map((e) => new Date(e.created_at).toISOString().slice(0, 10)));
    let streakDays = 0;
    const cursor = new Date(now);
    while (activeDays.has(cursor.toISOString().slice(0, 10))) {
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const cadenceComponent = Math.min(cadenceRatio, 1.5) / 1.5;
    const velocityComponent = Math.min(completionVelocity, 1);
    const regressionPenalty = Math.min(regressions * 0.05, 0.3);
    const streakComponent = Math.min(streakDays / 14, 1);
    const energyIndex = Math.round(
      Math.max(
        0,
        Math.min(1, cadenceComponent * 0.35 + velocityComponent * 0.35 + streakComponent * 0.3 - regressionPenalty),
      ) * 100,
    );

    const { data: staleNodes } = await supabase
      .from('nodes')
      .select('title, updated_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .lt('updated_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .limit(5);

    await supabase.from('weekly_digests').upsert(
      {
        user_id: userId,
        week_start: weekStart,
        energy_index: energyIndex,
        // TODO: port computeFunnelRates from lib/insight/funnel.ts (idea/task/knowledge/research
        // edge-presence counts) — omitted here to keep this scaffold's first pass small.
        funnel: {},
        stale_node_titles: (staleNodes ?? []).map((n) => n.title),
      },
      { onConflict: 'user_id,week_start' },
    );
  }

  return new Response(JSON.stringify({ processedUsers: userIds.length }), {
    headers: { 'content-type': 'application/json' },
  });
});
