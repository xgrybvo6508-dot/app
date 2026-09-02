# Мотор мышления

Мобильное приложение для организации мыслей, планирования, придумывания идей, обучения и ресерча —
единый граф заметок/идей/задач/знаний с ИИ поверх него. Полный продуктовый план и обоснования
архитектурных решений — в `/root/.claude/plans/wise-growing-micali.md` (см. историю разработки).

## Стек

- **Клиент**: React Native + Expo (Expo Router), `expo-sqlite` для локального графа.
- **Бэкенд**: Supabase — Postgres + pgvector + Auth + Edge Functions. Auth (email+пароль) и
  синхронизация данных (`lib/sync`) подключены; сами Edge Functions ещё не задействованы клиентом.
- **ИИ**: Claude API, будет вызываться только из Supabase Edge Functions (`/supabase/functions`) —
  пока не подключено (см. "Известные ограничения").

## Подключение своего Supabase-проекта

1. Примени миграцию `supabase/migrations/0001_init.sql` к своему проекту — либо вставь её в
   SQL Editor на supabase.com, либо `supabase login && supabase link --project-ref <ref> && supabase db push`.
2. Скопируй `.env.example` в `.env` и впиши `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`
   из Project Settings → API своего проекта. `.env` в `.gitignore` — секреты никуда не коммитятся.
3. Зарегистрируйся в приложении на вкладке «Настройки» (email+пароль) и нажми «Синхронизировать сейчас».

## Модель данных

Один граф: таблица `nodes` (`note` / `idea` / `task` / `plan_item` / `knowledge_item` /
`research_finding` / `life_domain`) + таблица `edges` (`derived_from`, `supports`, `contradicts`,
`part_of`, `blocks`, `applies_to`, `learned_for`) + append-only `activity_log` для insight-движка.
Локальная схема — `lib/db/schema.ts`; облачное зеркало — `supabase/migrations/0001_init.sql`.

## Структура

```
/app/(tabs)        — экраны: Заметки, Карта, Планирование, Обращение, Обучение, Ресерч, Настройки
/lib/db            — expo-sqlite схема + CRUD (nodes, edges, activity_log, sync_meta)
/lib/graph         — чистые графовые алгоритмы (соседи, part_of-цепочка, декомпозиция)
/lib/insight       — Energy Index, воронка продуктивности, детект застоя (юнит-тесты есть)
/lib/learning      — SM-2 spaced repetition
/lib/ai            — локальная заглушка ассистента (см. ниже)
/lib/supabase      — клиент Supabase (URL/anon key из EXPO_PUBLIC_* env)
/lib/sync          — push/pull синхронизация с Supabase, last-write-wins по updated_at
/supabase          — миграции + Edge Functions (chat, embed, extract-candidates, weekly-digest)
```

## Что реализовано

- Полный локальный граф (offline CRUD) и все 8 модулей как проекции этого графа.
- Canvas-карта (WebView + Cytoscape.js) с режимом связывания и декомпозицией узлов.
- Kanban-планирование с breadcrumb `part_of` до цели (drag пока через тап-стрелки — см. ниже).
- Insight-движок (Energy Index, воронка, адаптивный детект застоя) — чистые функции с тестами.
- Обучение: SM-2 + адаптивный путь простой/сложный материал + `life_domain` для нерабочих целей.
- Ресерч: наивный локальный экстрактор утверждений + учёт подтверждений.
- Режим «Мышление» (сократовский разбор) — общий с «Обращением» интерфейс чата.
- Auth (email+пароль) и двусторонняя синхронизация nodes/edges/activity_log с Supabase.

## Известные ограничения / что дальше

- **Реального вызова Claude нет** — `lib/ai/localAssistant.ts` детерминированно отвечает на основе
  графа (без сети), полностью соответствуя контракту `/supabase/functions/chat`, который его заменит,
  как только появится ключ Anthropic API (и Voyage AI для эмбеддингов) в секретах Supabase.
- **Kanban использует тап-стрелки вместо жеста drag-and-drop** — осознанное упрощение v1 (см. комментарий
  в `app/(tabs)/planning.tsx`), чтобы поведение было проверяемым без запуска на устройстве/симуляторе.
- Sync запускается один раз при старте (если есть сессия) и вручную кнопкой в Настройках — фоновой/
  периодической синхронизации нет.
- Функции в `/supabase/functions` написаны, но не развёрнуты и не подключены клиентом.

## Разработка

```
npm install
npm run start       # Expo dev server
npm run typecheck   # tsc по приложению + по тестам
npm test            # unit-тесты чистых функций (lib/graph, lib/insight, lib/learning)
```
