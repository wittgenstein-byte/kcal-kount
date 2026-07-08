# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server (localhost:5173)
npm run build    # Build for production (outputs to dist/)
npm run preview  # Preview production build
```

No test runner, linter, or formatter is configured.

## Architecture

Vanilla JS SPA (no framework) — a single HTML page (`index.html`) with ES6 modules bundled by Vite.

### Data flow

A single mutable `state` object (`src/state.js`) holds all app data (entries, favorites, TDEE settings, theme, active view). Modules import `state` directly. Persistence is `localStorage` with `'kcal_tracker_*'` keys. Save functions (`saveEntries`, `saveFavorites`, etc.) write to `localStorage` — `saveEntries` and `saveFavorites` are debounced (300ms) to batch rapid writes.

On load, `app.js` calls `loadLocalStorage()` to hydrate state from localStorage, then renders all views. The root is `app.js` — it imports every module, wires DOM event listeners, and contains all CRUD dispatch logic (meal entries, favorites, TDEE calculation). The `src/` modules are utilities that operate on `state`.

### Key modules

| File | Role |
|---|---|
| `app.js` | Main controller — event listeners, CRUD dispatch, TDEE form handler, modal open/close logic |
| `src/state.js` | Mutable state object + localStorage persistence helpers |
| `src/ui.js` | DOM rendering (daily log, favorites list, progress ring, analytics stats), toast modals, HTML escaping for XSS prevention |
| `src/ai.js` | Food analysis via Gemini API proxy — sends base64 image, parses JSON from LLM response with multi-strategy fallback (markdown fences, brace extraction, truncated JSON repair, regex fallback, LLM repair call) |
| `src/camera.js` | Camera/gallery capture — starts video stream, captures frames, handles HEIC conversion (native `createImageBitmap` → `heic2any` fallback), compresses with `browser-image-compression`, manages camera modal steps (preview → confirm → loading) |
| `src/chart.js` | ApexCharts wrapper — renders area chart with gradient fill, goal annotation line, cached config to skip redundant re-renders |
| `src/calculator.js` | Mifflin-St Jeor BMR/TDEE calculation |
| `src/backup.js` | JSON export/import of all user data |

### API proxy

The Vite dev server runs a custom plugin (`vite-plugin-ai-proxy.js`) that proxies `/api/analyze` POST requests to `https://gen.ai.kku.ac.th/api/v1/chat/completions`. The AI API key is read from `.env` (`AI_API_KEY`) — see `.env.example`. On Vercel, `vercel.json` rewrites `/api/*` to serverless functions (if deployed) and everything else to `index.html` for SPA routing.

### Views

Two views switched via tabs in `app.js`:
- **Dashboard** — circular progress SVG ring, daily meal log list, favorites list with search
- **Analytics** — ApexCharts area chart + stat cards (average, compliance, max/min)

Four modals (meal entry, favorite, settings/TDEE, camera/AI scan) — opened/closed via `openModal`/`closeModal` in `ui.js`.

### Styling

All CSS is in `style.css` — CSS custom properties with dark/light themes (`[data-theme="dark"]`/`[data-theme="light"]`). Glassmorphism design with backdrop blur, gradient fills, and glow effects. No CSS framework.

### AI food scanning flow

1. User taps FAB → `openCameraModal()` starts video stream or shows upload prompt
2. User captures/selects an image → compressed to ~800px JPEG, stored as base64
3. User confirms → `analyzeFood()` sends POST to `/api/analyze` with vision prompt
4. Response JSON is parsed via multi-strategy extractor (`tryParseJSON`) that handles markdown fences, truncated JSON, single quotes, trailing commas, and field name variations
5. On success → meal modal pre-filled with name/kcal/macros via `prefillMealModalFromScan()`

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Codex sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to AGENTS.md
rtk init --global       # Add RTK to ~/.Codex/AGENTS.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->