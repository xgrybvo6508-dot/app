export interface SuggestedAction {
  id: string;
  label: string;
  run: () => void;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions?: SuggestedAction[];
}
