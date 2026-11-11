import { state, saveAiSettings } from './state.js';
import { showToast } from './ui.js';

const PROXY_URL = '/api/analyze';
const MODELS_PROXY_URL = '/api/models';

export const PREFERRED_VISION_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest'
];

let _cachedModels = null;
let _cachedModelsTimestamp = 0;
const MODELS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getAvailableModels(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _cachedModels && (now - _cachedModelsTimestamp < MODELS_CACHE_TTL_MS)) {
    return _cachedModels;
  }

  try {
    const response = await fetchWithTimeout(MODELS_PROXY_URL, {
      method: 'GET',
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: HTTP ${response.status}`);
    }

    const data = await response.json();
    let models = [];
    if (Array.isArray(data)) {
      models = data.map(m => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
    } else if (Array.isArray(data?.data)) {
      models = data.data.map(m => m.id || m.name).filter(Boolean);
    } else if (Array.isArray(data?.models)) {
      models = data.models.map(m => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
    }

    if (models.length > 0) {
      _cachedModels = models;
      _cachedModelsTimestamp = now;
      return models;
    }
  } catch (err) {
    console.warn('[AI Models] Could not load available models list:', err.message);
  }

  return _cachedModels || [];
}

export function resolveFallbackModel(currentModel, availableModels = []) {
  if (!availableModels || availableModels.length === 0) {
    return 'gemini-3.1-flash-lite';
  }

  // If current model is available, keep it
  if (currentModel && availableModels.includes(currentModel)) {
    return currentModel;
  }

  // Pick the first available model from our prioritized vision list
  for (const preferred of PREFERRED_VISION_MODELS) {
    if (availableModels.includes(preferred) && preferred !== currentModel) {
      return preferred;
    }
  }

  // Pick any model matching keywords
  const keywords = ['flash', 'gemini', 'claude', 'qwen', 'gpt'];
  for (const kw of keywords) {
    const match = availableModels.find(m => m.toLowerCase().includes(kw) && m !== currentModel);
    if (match) return match;
  }

  // Pick the first alternative model
  const alt = availableModels.find(m => m !== currentModel);
  return alt || availableModels[0] || 'gemini-3.1-flash-lite';
}

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 40000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out. Please check your connection and try again.');
    }
    throw error;
  }
}

async function sendAnalyzeRequest(base64Image, model) {
  const payload = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an expert nutritionist. When given a food image, respond with ONLY a JSON object. No math, no explanation, no text outside the JSON.

To estimate the weight of the food as accurately as possible, inspect the image for standard reference objects (such as spoons, forks, chopsticks, glasses, plates, table mats, or hands/fingers) to calibrate the visual scale. Base your macro and calorie estimation on this calibrated portion size.

Example response:
{"menu": "Grilled Chicken Rice", "protein_g": 35, "fat_g": 12, "carb_g": 55, "kcal": 470}`
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}` }
          },
          {
            type: 'text',
            text: 'Analyze the food in the image. Identify the dish, look for standard reference objects (e.g. cutlery, plates, cups, fingers) to calibrate portion sizes/dimensions, and estimate weights. Reply ONLY with JSON: {"menu": "name", "protein_g": number, "fat_g": number, "carb_g": number, "kcal": number}'
          }
        ]
      }
    ],
    max_tokens: 2048,
    temperature: 0.1
  };

  const response = await fetchWithTimeout(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    timeout: 45000
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[AI Scan] API error response (model: ${model}):`, errText);
    const err = new Error(`API error ${response.status}: ${errText.slice(0, 120)}`);
    err.status = response.status;
    err.body = errText;
    throw err;
  }

  return response.json();
}

export async function analyzeFood(base64DataUrl) {
  let model = state.modelName || 'gemini-3.1-flash-lite';
  const base64Image = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');

  let data;
  try {
    data = await sendAnalyzeRequest(base64Image, model);
  } catch (err) {
    // Check if the error indicates that the model is unavailable or invalid
    const isModelError = 
      (err.status === 401 && err.body && /invalid model/i.test(err.body)) ||
      err.status === 404 ||
      (err.body && /invalid model|model not found|unknown model|model unavailable/i.test(err.body));

    if (isModelError) {
      console.warn(`[AI Scan] Model "${model}" is unavailable (${err.message}). Fetching available models for fallback...`);
      const availableModels = await getAvailableModels(true);
      const fallbackModel = resolveFallbackModel(model, availableModels);

      if (fallbackModel && fallbackModel !== model) {
        console.log(`[AI Scan] Switching to fallback model "${fallbackModel}"...`);
        showToast(`Model "${model}" unavailable. Switched to "${fallbackModel}"`, 'info');

        // Persist the fallback model
        state.modelName = fallbackModel;
        saveAiSettings();

        // Retry analysis with the fallback model
        data = await sendAnalyzeRequest(base64Image, fallbackModel);
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  console.log('[AI Scan] Full API response:', JSON.stringify(data, null, 2));

  const rawContent = data?.choices?.[0]?.message?.content || '';
  console.log('[AI Scan] Raw content:', rawContent);

  // Try multiple strategies to extract JSON from the response
  const parsed = tryParseJSON(rawContent);

  if (!parsed) {
    console.error('[AI Scan] All parsing strategies failed. Raw:', rawContent);
    throw new Error(`Could not parse AI response. Raw: "${rawContent.slice(0, 200)}"`);
  }

  return {
    menu: parsed.menu || 'Unknown food',
    protein: Math.round(parsed.protein_g ?? 0),
    fat: Math.round(parsed.fat_g ?? 0),
    carb: Math.round(parsed.carb_g ?? 0),
    kcal: Math.round(parsed.kcal ?? 0)
  };
}

function sanitizeJSONString(str) {
  let s = str;

  // Strip BOM
  s = s.replace(/^\uFEFF/, '');

  // Replace smart/curly quotes with normal ones
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  // Remove JS-style line comments (// ...)
  s = s.replace(/\/\/[^\n]*/g, '');

  // Remove JS-style block comments (/* ... */)
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');

  // Strip control characters except \n \r \t
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Replace single-quoted values with double-quoted (simple heuristic)
  s = s.replace(/:\s*'([^']*)'/g, ': "$1"');
  // Match single-quoted keys: 'key': → "key":
  s = s.replace(/'([^']+)'\s*:/g, '"$1":');

  // Unquoted keys: { menu: → { "menu":
  s = s.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  return s;
}

function tryParseSingle(str) {
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Direct parse
  try { return JSON.parse(trimmed); } catch (e) { /* continue */ }

  // Sanitized parse
  try { return JSON.parse(sanitizeJSONString(trimmed)); } catch (e) { /* continue */ }

  return null;
}

function normalizeFields(obj) {
  if (!obj || typeof obj !== 'object') return null;

  // If it's an array, try the first element
  if (Array.isArray(obj)) {
    if (obj.length === 0) return null;
    return normalizeFields(obj[0]);
  }

  // Build a lowercase-key lookup
  const lc = {};
  for (const [k, v] of Object.entries(obj)) {
    lc[k.toLowerCase().replace(/[\s_-]+/g, '_')] = v;
  }

  const menu =
    lc['menu'] ?? lc['name'] ?? lc['food_name'] ?? lc['food'] ??
    lc['dish'] ?? lc['dish_name'] ?? lc['item'] ?? lc['food_item'] ?? 'Unknown food';

  const kcal =
    lc['kcal'] ?? lc['calories'] ?? lc['calorie'] ?? lc['cal'] ??
    lc['total_calories'] ?? lc['total_kcal'] ?? lc['energy'] ??
    lc['energy_kcal'] ?? 0;

  const protein_g =
    lc['protein_g'] ?? lc['protein'] ?? lc['proteins'] ??
    lc['protein_grams'] ?? lc['prot'] ?? 0;

  const fat_g =
    lc['fat_g'] ?? lc['fat'] ?? lc['fats'] ??
    lc['fat_grams'] ?? lc['total_fat'] ?? 0;

  const carb_g =
    lc['carb_g'] ?? lc['carb'] ?? lc['carbs'] ??
    lc['carbohydrate'] ?? lc['carbohydrates'] ??
    lc['carb_grams'] ?? lc['carbohydrate_g'] ?? lc['carbohydrates_g'] ?? 0;

  // Coerce string numbers → actual numbers
  const toNum = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/[^\d.\-]/g, ''));
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };

  return {
    menu: String(menu),
    protein_g: toNum(protein_g),
    fat_g: toNum(fat_g),
    carb_g: toNum(carb_g),
    kcal: toNum(kcal)
  };
}

function tryParseJSON(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return null;

  const content = rawContent.trim();
  if (!content) return null;

  // Strategy 1: Direct JSON parse (entire content as JSON, with sanitization)
  {
    const parsed = tryParseSingle(content);
    if (parsed) {
      console.log('[AI Scan] Parsed entire content as JSON');
      return normalizeFields(parsed);
    }
  }

  // Strategy 2: Balanced brace block extraction (handles surrounding prose/markdown)
  const braceBlocks = extractBraceBlocks(content);
  for (const block of braceBlocks) {
    const parsed = tryParseSingle(block);
    if (parsed) {
      console.log('[AI Scan] Parsed via brace extraction strategy');
      return normalizeFields(parsed);
    }
  }

  return null;
}

function extractBraceBlocks(str) {
  const blocks = [];
  let depth = 0, start = -1;
  let inString = false, escape = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        blocks.push(str.slice(start, i + 1));
        start = -1;
      }
    }
  }

  // If we found an opening brace but no closing, capture the partial block too
  if (start !== -1 && blocks.length === 0) {
    blocks.push(str.slice(start));
  }

  return blocks;
}
