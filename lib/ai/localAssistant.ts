// Deterministic placeholder for the real assistant. The plan's "Механика
// «Обращения»" calls for a hybrid of (1) a cheap graph snapshot, (2) RAG over
// embeddings, (3) a background-updated thinking profile, and (4) an action
// layer — all served by the `chat` Supabase Edge Function calling Claude
// (see /supabase/functions/chat). That function needs a deployed Supabase
// project + Anthropic API key, neither of which exist yet in this repo, so
// this module fills the same *interface* with local, graph-only logic:
// it never invents advice, it only ever surfaces real nodes found by the
// insight engine — swapping this for a real network call later is a
// drop-in replacement of `generateAssistantReply`.
import { createEdge } from '../db/edges';
import { createNode, updateNode } from '../db/nodes';
import { findNodesMissingEdgeTypeInGraph } from '../graph';
import { computeAdaptiveStaleNodes } from '../insight/staleDetection';
import { computeWeeklyDigest } from '../insight';
import { listNodes } from '../db/nodes';
import type { GraphNode } from '../db/types';
import type { ChatMessage, SuggestedAction } from './types';

let actionCounter = 0;
function nextActionId(): string {
  actionCounter += 1;
  return `action-${actionCounter}`;
}

function findTopSignal(): { text: string; actions: SuggestedAction[] } | null {
  const staleIdeas = computeAdaptiveStaleNodes(listNodes({ type: 'idea', status: 'active' }));
  if (staleIdeas.length > 0) {
    const idea = staleIdeas[0];
    return {
      text: `У тебя idea «${idea.title}» давно без движения. Создать задачу и связать с ней?`,
      actions: [
        {
          id: nextActionId(),
          label: 'Создать задачу',
          run: () => {
            const task = createNode({ type: 'task', title: `Продвинуть: ${idea.title}` });
            createEdge({ fromId: task.id, toId: idea.id, type: 'part_of' });
          },
        },
      ],
    };
  }

  const orphanKnowledge = findNodesMissingEdgeTypeInGraph('knowledge_item', 'applies_to').filter(
    (n) => !(n.attributes as { curiosityOnly?: boolean }).curiosityOnly,
  );
  if (orphanKnowledge.length > 0) {
    const item = orphanKnowledge[0];
    return {
      text: `«${item.title}» выучено, но нигде не применено. Это просто из любопытства, или связать с задачей/темой?`,
      actions: [
        {
          id: nextActionId(),
          label: 'Это из любопытства',
          run: () => {
            updateNode(item.id, {
              attributes: { ...item.attributes, curiosityOnly: true },
            });
          },
        },
      ],
    };
  }

  return null;
}

export function generateAssistantReply(userText: string): ChatMessage {
  const lowered = userText.toLowerCase();

  if (lowered.includes('что') && (lowered.includes('делать') || lowered.includes('поделать'))) {
    const signal = findTopSignal();
    if (signal) {
      return { id: nextActionId(), role: 'assistant', text: signal.text, actions: signal.actions };
    }
    return {
      id: nextActionId(),
      role: 'assistant',
      text: 'Явных застрявших узлов не вижу — граф в порядке. Продолжай в том же темпе.',
    };
  }

  if (lowered.includes('как я') || lowered.includes('энерг') || lowered.includes('продуктив')) {
    const digest = computeWeeklyDigest();
    const funnelText = Object.entries(digest.funnel)
      .map(([stage, rate]) => `${stage}: ${Math.round(rate * 100)}%`)
      .join(', ');
    return {
      id: nextActionId(),
      role: 'assistant',
      text: `Energy Index: ${digest.energyIndex}/100. Воронка — ${funnelText}. Застряло узлов: ${digest.staleNodeTitles.length}${digest.staleNodeTitles.length ? ' (' + digest.staleNodeTitles.slice(0, 3).join(', ') + ')' : ''}.`,
    };
  }

  const signal = findTopSignal();
  if (signal) {
    return { id: nextActionId(), role: 'assistant', text: signal.text, actions: signal.actions };
  }

  return {
    id: nextActionId(),
    role: 'assistant',
    text: 'Пока не подключён реальный ИИ (нужен Supabase Edge Function + ключ Anthropic API) — но я уже вижу твой граф и отвечаю на его основе. Спроси «что мне делать» или «как я вообще».',
  };
}

const THINKING_QUESTIONS = [
  (title: string) => `Зачем тебе «${title}»?`,
  (title: string) => `Кто выиграет или проиграет от «${title}»?`,
  (title: string) => `Какие есть альтернативы или контраргументы к «${title}»?`,
  (title: string) => `С чем «${title}» уже связано в твоём графе?`,
];

/** Режим «Мышление» (п.6) — тот же чат-экран, другой system prompt (см. план). */
export function generateThinkingQuestions(node: GraphNode): string[] {
  return THINKING_QUESTIONS.map((q) => q(node.title));
}

export function saveThinkingAnswer(nodeId: string, answerText: string): void {
  const note = createNode({ type: 'note', title: answerText });
  createEdge({ fromId: note.id, toId: nodeId, type: 'derived_from' });
}
