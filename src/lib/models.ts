// Single source of truth for the Broomy model catalogue.
// Public API ids are 'sensei' and 'image'; engine ids stay internal.

export interface ModelEntry {
  id: string;           // public API id
  display: string;      // UI display name
  backendId: string;    // id the upstream engine expects
  contextLength: number;
  pricePerMTok: { input: number; output: number }; // USD per 1M tokens
  isImage?: boolean;
}

export const MODELS: ModelEntry[] = [
  {
    id: 'sensei',
    display: 'sensei (qwen3.8)',
    backendId: 'qwen3.8-flash-next-ud-q4_k_xl',
    contextLength: 262144,
    pricePerMTok: { input: 0.1, output: 0.2 },
  },
  {
    id: 'image',
    display: 'image (realvisxl v5)',
    backendId: 'realvisxl-v5',
    contextLength: 0,
    pricePerMTok: { input: 0, output: 0 },
    isImage: true,
  },
];

// Legacy/alias ids still accepted on chat completions.
const ALIASES: Record<string, string> = {
  'qwen3.8-flash-next-ud-q4_k_xl': 'sensei',
  'qwen3.8-flash': 'sensei',
  'qwen3.8-flash-next-iq3_s': 'sensei',
  'sensei-qwen3.8-flash': 'sensei',
  'sensei-qwen3.8': 'sensei',
  'qwen3.8': 'sensei',
  'qwen3.8-flash-next': 'sensei',
  'sd-1.5': 'image',
  'sd1.5': 'image',
  'dall-e': 'image',
  'dalle': 'image',
  'image': 'image',
};

export function resolveModelId(model: string): string {
  const m = (model || '').trim().toLowerCase();
  if (ALIASES[m]) return ALIASES[m];
  if (m.startsWith('bonsai')) return 'sensei'; // retired model: route to the main brain
  if (m.startsWith('image') || m.startsWith('sd') || m.startsWith('dall')) return 'image';
  return 'sensei'; // unknown ids default to the main model
}

// Engine model id for a requested public id.
export function backendModelFor(model: string): string {
  const id = resolveModelId(model);
  return MODELS.find((x) => x.id === id)!.backendId;
}

// Friendly display name for logs/UI; unknown ids fall back to the raw string.
export function displayModel(model: string | null | undefined): string {
  if (!model) return '—';
  const m = model.trim().toLowerCase();
  if (ALIASES[m]) return MODELS.find((x) => x.id === ALIASES[m])!.display;
  const hit = MODELS.find((x) => x.id === m);
  return hit ? hit.display : model;
}
