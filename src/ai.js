import { state } from './state.js';

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 20000 } = options;
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

export async function analyzeFood(base64DataUrl) {
  const apiUrl = 'https://gen.ai.kku.ac.th/api/v1/chat/completions';
  const model = state.modelName || 'gemini-3.5-flash';

  // Strip the data URL prefix for the API
  const base64Image = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');

  const payload = {
    model,
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

  const response = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.apiKey}`
    },
    body: JSON.stringify(payload),
    timeout: 20000
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[AI Scan] API error response:', errText);
    throw new Error(`API error ${response.status}: ${errText.slice(0, 120)}`);
  }

  const data = await response.json();
  console.log('[AI Scan] Full API response:', JSON.stringify(data, null, 2));

  const rawContent = data?.choices?.[0]?.message?.content || '';
  console.log('[AI Scan] Raw content:', rawContent);

  // Try multiple strategies to extract JSON from the response
  let parsed = tryParseJSON(rawContent);

  // Strategy 4: If all JSON parsing failed, send a repair call asking the LLM to reformat
  if (!parsed && rawContent.trim().length > 0) {
    console.log('[AI Scan] JSON parse failed, attempting repair call...');
    try {
      parsed = await repairWithLLM(rawContent, model);
    } catch (e) {
      console.error('[AI Scan] Repair call also failed:', e);
    }
  }

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
  // Match key-value patterns: 'value' → "value"
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

function tryRepairTruncated(str) {
  let s = sanitizeJSONString(str.trim());

  // Count unmatched braces/brackets
  let braces = 0, brackets = 0;
  let inString = false, escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    if (ch === '}') braces--;
    if (ch === '[') brackets++;
    if (ch === ']') brackets--;
  }

  // If we're still inside a string, close it
  if (inString) s += '"';

  // Remove any trailing comma before we close
  s = s.replace(/,\s*$/, '');

  // Close open brackets/braces
  while (brackets > 0) { s += ']'; brackets--; }
  while (braces > 0) { s += '}'; braces--; }

  try { return JSON.parse(s); } catch (e) { return null; }
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

  // Strategy 1: Markdown code fences (```json ... ``` or ``` ... ```)
  const fenceRegex = /```(?:json|JSON|js|javascript)?\s*\n?([\s\S]*?)\n?\s*```/g;
  let fenceMatch;
  while ((fenceMatch = fenceRegex.exec(content)) !== null) {
    const parsed = tryParseSingle(fenceMatch[1]);
    if (parsed) {
      console.log('[AI Scan] Parsed via markdown fence strategy');
      return normalizeFields(parsed);
    }
  }

  // Strategy 2: Find JSON object(s) via balanced brace extraction
  const braceBlocks = extractBraceBlocks(content);
  for (const block of braceBlocks) {
    const parsed = tryParseSingle(block);
    if (parsed) {
      console.log('[AI Scan] Parsed via brace extraction strategy');
      return normalizeFields(parsed);
    }
  }

  // Strategy 3: Entire content as JSON
  {
    const parsed = tryParseSingle(content);
    if (parsed) {
      console.log('[AI Scan] Parsed entire content as JSON');
      return normalizeFields(parsed);
    }
  }

  // Strategy 4: Try to repair truncated JSON from brace blocks
  for (const block of braceBlocks) {
    const parsed = tryRepairTruncated(block);
    if (parsed) {
      console.log('[AI Scan] Parsed via truncated JSON repair');
      return normalizeFields(parsed);
    }
  }

  // Strategy 5: Regex extraction as last resort — pull key-value pairs directly
  {
    const parsed = regexExtractFields(content);
    if (parsed) {
      console.log('[AI Scan] Parsed via regex field extraction');
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

function regexExtractFields(text) {
  const menuMatch = text.match(/["']?(?:menu|name|food|dish)["']?\s*[:=]\s*["']([^"'\n]+)["']/i);
  const kcalMatch = text.match(/["']?(?:kcal|calories?|cal|energy)["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)["']?/i);
  const proteinMatch = text.match(/["']?(?:protein(?:_?g(?:rams)?)?|prot)["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)["']?/i);
  const fatMatch = text.match(/["']?(?:fat(?:_?g(?:rams)?)?|fats?)["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)["']?/i);
  const carbMatch = text.match(/["']?(?:carb(?:ohydrate)?s?(?:_?g(?:rams)?)?|carb_g)["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)["']?/i);

  // Need at least kcal or menu to consider it a valid extraction
  if (!kcalMatch && !menuMatch) return null;

  return {
    menu: menuMatch ? menuMatch[1].trim() : 'Unknown food',
    kcal: kcalMatch ? parseFloat(kcalMatch[1]) : 0,
    protein_g: proteinMatch ? parseFloat(proteinMatch[1]) : 0,
    fat_g: fatMatch ? parseFloat(fatMatch[1]) : 0,
    carb_g: carbMatch ? parseFloat(carbMatch[1]) : 0
  };
}

function normalizeNutrition(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const num = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const m = v.replace(',', '.').match(/\d+(\.\d+)?/); // extract first number
      return m ? parseFloat(m[0]) : 0;
    }
    return 0;
  };
  return {
    menu: (obj.menu || obj.name || obj.food || obj.dish || obj.food_name || 'Unknown food').toString().trim(),
    kcal: num(obj.kcal ?? obj.calories ?? obj.energy ?? obj.cal ?? 0),
    protein_g: num(obj.protein_g ?? obj.protein ?? obj.proteins ?? 0),
    fat_g: num(obj.fat_g ?? obj.fat ?? obj.fats ?? 0),
    carb_g: num(obj.carb_g ?? obj.carb ?? obj.carbohydrate ?? obj.carbs ?? obj.carbohydrates ?? 0),
  };
}

function stripLineComments(str) {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escape) {
      result += ch;
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      result += ch;
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    // If outside a string and we see //, skip to end of line
    if (!inString && ch === '/' && str[i + 1] === '/') {
      while (i < str.length && str[i] !== '\n' && str[i] !== '\r') i++;
      continue;
    }

    result += ch;
  }

  return result;
}

function extractAndParseJSON(text) {
  if (!text || typeof text !== 'string') return null;

  let s = text.trim();

  // 1) Strip markdown code fences: ```json ... ``` or ``` ... ```
  s = s.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

  // 2) Isolate the first { ... last } block (discard leading/trailing prose)
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  let json = s.slice(first, last + 1);

  // 3) Clean common LLM quirks
  json = json
    .replace(/[\u201C\u201D]/g, '"')       // smart double quotes → "
    .replace(/[\u2018\u2019]/g, "'")       // smart single quotes → '
    .replace(/,\s*([}\]])/g, '$1');        // trailing commas

  // Strip // comments only when outside of quoted strings
  json = stripLineComments(json);

  // 4) Try direct parse → normalizeNutrition forces numbers
  try {
    return normalizeNutrition(JSON.parse(json));
  } catch (_) { /* continue */ }

  // 5) Fallback: convert single-quoted keys/values → double quotes
  try {
    const fixed = json
      .replace(/'([^']*)'\s*:/g, '"$1":')       // 'key': → "key":
      .replace(/:\s*'([^']*)'/g, ': "$1"')       // : 'value' → : "value"
      .replace(/,\s*'([^']*)'/g, ', "$1"')       // , 'value' → , "value"
      .replace(/\[\s*'([^']*)'/g, '["$1"')        // ['value' → ["value"
      .replace(/'\s*]/g, '"]')                    // '] → "]
      .replace(/,\s*([}\]])/g, '$1');              // trailing commas
    return normalizeNutrition(JSON.parse(fixed));
  } catch (_) { /* continue */ }

  return null;
}

async function repairWithLLM(rawText, model) {
  const apiUrl = 'https://gen.ai.kku.ac.th/api/v1/chat/completions';

  const messages = [
    {
      role: 'system',
      content:
        'You are a JSON converter. Output ONLY a single valid JSON object. ' +
        'No markdown, no code fences, no explanation. ' +
        'All nutrition values must be plain numbers (no units).',
    },
    {
      role: 'user',
      content:
        'Convert this food analysis to JSON with EXACTLY these keys: ' +
        '{"menu": string, "protein_g": number, "fat_g": number, "carb_g": number, "kcal": number}\n\n' +
        'Analysis:\n' + rawText,
    },
  ];

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${state.apiKey}`,
  };

  // Try with response_format first; fall back without it if backend rejects (400)
  let resp = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages,
      max_tokens: 2048,
      temperature: 0,
    }),
    timeout: 15000
  });

  if (resp.status === 400) {
    console.warn('[AI Scan] Backend rejected response_format, retrying without it');
    resp = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2048,
        temperature: 0,
      }),
      timeout: 15000
    });
  }

  if (!resp.ok) throw new Error('Repair call failed');

  const repairData = await resp.json();
  const repairContent = repairData?.choices?.[0]?.message?.content || '';
  console.log('[AI Scan] Repair response:', repairContent);

  // Use the aggressive extractor, then force all values to numbers
  const parsed = extractAndParseJSON(repairContent);
  return normalizeNutrition(parsed);
}
