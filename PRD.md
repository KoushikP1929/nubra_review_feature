# Nubra Trade Review — Product Requirements Document (As-Built)

Version: 2.0 (as-built) · Date: 2026-10-26 · Status: **Live in production**

This document reflects the product **exactly as implemented and deployed**, including every
scope change approved by the product owner during development. Where the original PRD
(2026 scope) and the final build differ, this document describes the final build.

- Live URL: https://nubrareviewfeature.vercel.app
- Repository: https://github.com/KoushikP1929/nubra_review_feature (branch `main`)
- Hosting: Vercel (auto-deploy on push to `main`) · Database: Neon PostgreSQL

---

## 1. Purpose

A monthly post-trade review web application for retail traders. After a trading month,
the trader inspects **what happened** in each completed trade — entry, exit, size, timing,
and the exit-versus-plan outcome — so patterns can be analysed. The product records and
presents **observable facts only**; it never judges decisions, never claims to know trader
intent, and never gives recommendations.

Illustrative Indian-market sample data (no broker integration, no live data feed) makes
the product demonstrable end-to-end.

## 2. Users and Goals

| User | Goal |
|---|---|
| Retail trader (single user, no auth in v1) | Review a month: "How did I trade? Which trades lost beyond plan? What should I re-check next month?" |

- **Monthly goal** — see the month at a glance: net ₹ outcome, win rate, distribution over days.
- **Trade-level goal** — replay one trade from record: timeline of orders and fills, the entry →
  exit price move, whether the recorded exit respected the trader's planned stop, and be given
  a reflective question plus a private note box.
- **Trust goal** — every analytical claim on screen is traceable to stored data (evidence given),
  with disclaimers where wording could be read as interpretation.

## 3. Golden Rules (decision constraints the build follows)

1. **Facts in, analytics in the backend.** The database stores raw facts (positions, orders,
   executions). Every aggregate and derived finding — monthly totals, win rate, cumulative
   P&L, outcome counts, stop-breach checks, narrative, timeline, prompts — is computed by the
   backend at request time. Nothing analytical is stored in the DB; nothing is computed on the
   frontend.
2. **Frontend is rendering-only.** Plain React + Tailwind, no client-side state library, no
   component library, no analytics, no filtering/sorting in the browser.
3. **No ORM.** Raw parameterized SQL via `@neondatabase/serverless` (HTTP driver).
4. **Non-judgemental review.** Findings are phrased as observable facts with disclaimers
   (e.g. the stop-breach card). Reflection prompts are general review questions, never
   data-derived conclusions about intent.
5. **Scope discipline.** No feature ships without product-owner approval (this document is
   that approval record).
6. **Secrets hygiene.** Credentials never enter the repo (`.env.local` git-ignored; every
   commit secret-scanned before push).

## 4. Explicitly Out of Scope (v1)

- Authentication, multi-user accounts, roles
- Live broker / trading-API integration (data is illustrative sample data)
- WhatsApp / popup-based review suggestions (the original "popup review idea" was replaced
  by this dedicated web app)
- Server-side storage of reflection notes; sync/sharing of notes
- SLAs, monetisation, real settlement/tax-grade P&L accounting, corporate-action handling

## 5. Functional Requirements

### 5.1 Screen 1 — Monthly Overview (`/`)

| # | Requirement | Status |
|---|---|---|
| F1.1 | Home shows a demo-data banner ("Demo data — not connected to Nubra; all trades are illustrative samples") | ✅ |
| F1.2 | App header: "N" logo mark, product name **Nubra Trade Review**, tab nav **Dashboard / Trades** with active state | ✅ |
| F1.3 | Month selector (dropdown) lists all months that have completed positions; choosing one re-renders the whole screen from the backend | ✅ |
| F1.4 | Headline "Monthly overview" with month label and trade count subtitle ("October 2026 · computed from 26 sample trades") | ✅ |
| F1.5 | Four KPI cards: **Net P&L** (₹, colour-coded, "Net profit"/"Net loss" caption), **Win rate** (%, with "n profitable · n losing" subtitle), **Completed trades**, **Avg P&L per trade** | ✅ |
| F1.6 | **Cumulative P&L** line chart (SVG) — running total by trading day; a sub-caption explains it | ✅ |
| F1.7 | **Daily P&L** bar chart (SVG) — bars grow up/down from a zero baseline, one per trading day | ✅ |
| F1.8 | Empty month (no trades) renders a graceful empty state, not an error | ✅ |
| F1.9 | Months with zero net deviation are handled (win rate/avg may be `null`) without NaN anywhere | ✅ |

### 5.2 Screen 2 — Trades List (`/trades`)

| # | Requirement | Status |
|---|---|---|
| F2.1 | Month label + outcome summary in subtitle (month's net ₹) | ✅ |
| F2.2 | Outcome tabs with live counts: **All (n) / Profit (n) / Loss (n)**; selecting a tab filters the list | ✅ |
| F2.3 | Search box ("Search instrument, direction…") — server-side search on instrument name and direction | ✅ |
| F2.4 | Rows show: close date, instrument name + type (Equity / Index Option), direction (Long/Short), quantity, outcome badge (▲ Profit / ▼ Loss), signed ₹ P&L | ✅ |
| F2.5 | Colour-coded left edge strip per row (green profit / red loss) | ✅ |
| F2.6 | Clicking a row opens that trade's review page (Screen 3) | ✅ |
| F2.7 | No-results state when the tab/search combination matches nothing | ✅ |
| F2.8 | Filtering, counting, searching, and sorting are executed by the backend API; frontend renders the response | ✅ |

### 5.3 Screen 3 — Individual Trade Review (`/positions/[id]`)

| # | Requirement | Status |
|---|---|---|
| F3.1 | "← Back to <Month> trades" link | ✅ |
| F3.2 | Review header card: "Trade review · #reference-code", instrument title, type · date · direction, outcome badge, large signed ₹ P&L, colour edge strip | ✅ |
| F3.3 | Six-item summary strip: **Quantity, Entry (price @ time), Exit (price @ time), Planned stop, Holding time (min), Direction** + times-in-UTC footnote | ✅ |
| F3.4 | **Execution timeline** — chronological events built from stored orders/fills: planned stop recorded, order placed, order filled, "Position added" (scale-in, with "Total position now n units"), exit placed, exit filled | ✅ |
| F3.5 | **"What happened" narrative** — sentences auto-constructed only from computed facts (hold time, price move %, ₹ result after fees, scaling), plus an **Evidence** bullet list each traceable to stored data | ✅ |
| F3.6 | **Stop-breach finding** — when the exit fill is beyond the stored planned stop (worse price, per direction), an amber "💡 Potential pattern to review" card states the fact with a non-judgemental disclaimer; when not breached, the evidence bullet says "exit stayed within the recorded stop" | ✅ |
| F3.7 | **Reflection prompt** — backend-selected review question (stop-breach-specific when applicable, otherwise general); **reflection note box** with "Save note" — the note is stored **only in the user's browser (localStorage)**, never sent to any server or database | ✅ |
| F3.8 | Full **Orders** and **Executions** tables (transparency: IDs, side, type, qty, status/price/fees, timestamps) | ✅ |
| F3.9 | "Position not found" and backend-failure states render a friendly error card | ✅ |

### 5.4 Sample Data & Setup

| # | Requirement | Status |
|---|---|---|
| F4.1 | `npm run db:setup` recreates the schema and loads illustrative trades deterministically (seeded RNG; re-running reproduces the same dataset) | ✅ |
| F4.2 | Sample months Aug 2026 (20 trades, 12W/8L), Sep 2026 (22 trades, 13W/9L), **Oct 2026 (exactly 26 trades, 15W/11L)** to match the approved UI reference | ✅ |
| F4.3 | Instruments: Indian equities (RELIANCE, HDFCBANK, INFY, TCS, ICICIBANK, SBIN, TATAMOTORS, WIPRO) and index options (NIFTY/BANKNIFTY CE & PE) | ✅ |
| F4.4 | Trade shapes: simple position (one limit entry fill, one market exit fill) and **scaled position** (two entry orders, the second adding units shortly after entry, **both fills at the same entry price** so P&L stays exactly `qty × (exit − entry) − fees`) | ✅ |
| F4.5 | Every position carries a **planned stop** chosen relative to entry/exit; roughly a third of trades exit beyond it | ✅ |
| F4.6 | Realized P&L and fees per position are ingested facts computed at generation time from raw prices | ✅ |

## 6. Analytics Rules (single source of truth)

| Rule | Definition |
|---|---|
| Winner / Loser | Realized P&L **strictly** > 0 / < 0. Break-even (= 0) is neither. |
| Net P&L (month) | Sum of realized P&L of closed positions closed within the calendar month (UTC). |
| Win rate | Winners ÷ completed positions × 100, rounded to 2 dp; `null` when zero trades. |
| Avg P&L per trade | Net P&L ÷ count, rounded to 2 dp; `null` when zero trades. |
| Daily P&L | Group closed positions by the UTC calendar day of `closed_at`; sum realized P&L; **cumulative** total computed in the backend across sorted days. |
| Price move % | (exit − entry) ÷ entry × 100, rounded to 2 dp, signed by arithmetic (**not** flipped to P&L sign). |
| Stop breach | `long` and exit price < planned stop, or `short` and exit price > planned stop → observable breach fact. |
| Hold duration | Minutes between `opened_at` and `closed_at`. |
| Rounding | Monetary figures and rates to 2 decimals; all rounding in the backend. |

## 7. Data Model (Neon PostgreSQL — raw SQL, no ORM)

```
positions                                   -- one closed trade
  id              TEXT PK                   -- pos_YYYYMM_nn
  instrument      TEXT NOT NULL
  instrument_type TEXT NOT NULL             -- 'Equity' | 'Index Option'
  side            TEXT NOT NULL             -- 'long' | 'short'
  quantity        DOUBLE NOT NULL > 0       -- total filled units
  status          TEXT NOT NULL             -- 'closed'
  opened_at       TIMESTAMPTZ NOT NULL
  closed_at       TIMESTAMPTZ NOT NULL
  planned_stop    DOUBLE                    -- trader's pre-set exit price (nullable)
  realized_pnl    DOUBLE NOT NULL           -- ingested fact
  fees_total      DOUBLE NOT NULL

orders                                      -- one row per order; scale-in = 2 entry orders
  id          TEXT PK                        -- ord_YYYYMM_nn_entry | _add | _exit
  position_id TEXT REFERENCES positions ON DELETE CASCADE
  instrument  TEXT, side ('buy'|'sell'), order_type ('market'|'limit'),
  quantity    > 0, status ('filled'), created_at TIMESTAMPTZ

executions                                  -- one fill per order in v1
  id          TEXT PK                        -- exec_YYYYMM_nn_entry | _add | _exit
  order_id    TEXT REFERENCES orders ON DELETE CASCADE
  position_id TEXT REFERENCES positions ON DELETE CASCADE
  instrument  TEXT, side, quantity > 0, price > 0, fees, executed_at TIMESTAMPTZ
```

Indexes: `positions(closed_at)`, `orders(position_id)`, `executions(position_id)`.

## 8. API Contract (all computed server-side; JSON)

| Endpoint | Purpose | Key fields |
|---|---|---|
| `GET /api/months` | Months that have closed positions | `months[]` |
| `GET /api/months/{month}/analytics` | Monthly aggregates | `netPnl, winRate, completedPositions, profitCount, lossCount, avgPnlPerTrade` |
| `GET /api/months/{month}/daily-pnl` | Per-day results | `days[]{date, netPnl, cumulativePnl, trades}` |
| `GET /api/months/{month}/positions?outcome=profit\|loss&q=…` | Filtered list | `positions[]{id, instrument, instrumentType, side, quantity, openedAt, closedAt, realizedPnl, feesTotal}` |
| `GET /api/positions/{id}` | Trade review payload | `position{…, plannedStop, holdDurationMinutes}`, `entry/exit` legs, `orders[]`, `executions[]`, `priceMovePct, stopBreached, narrative[], evidence[], timeline[]{time,title,lines[]}, reflectionPrompt`, observations + improvementPrompts |

Contract details: `month` must be `YYYY-MM` (400 otherwise); unknown position id → 404;
invalid `outcome` → 400; search input sanitised (wildcards escaped, limited to
instrument/direction); every payload carries `dataSource: "sample"`.

## 9. UI / Display Rules

- **Light design, permanently.** White page background, dark text on transparent/white
  surfaces, white cards with light borders. The app sets `color-scheme: light` and forbids
  dark-mode overrides so system theme cannot change rendering (bug found and fixed post-launch).
- Currency displayed as **₹ (Indian formatting, `en-IN`)**; signed values show +/− explicitly.
- Dates/times: UTC, `dd MMM yyyy` / `HH:mm`; a footnote discloses this on Screen 3.
- Green/red reserved strictly for profit/loss meaning; amber for safety-ish "worth reviewing"
  highlights; neutral slate tones otherwise.
- All SVG charts hand-rolled (no chart library) per the scope rules.

## 10. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Screens render on demand from the API (Next.js dynamic rendering); typical response in well under a second on the Neon HTTP driver |
| Correctness | Analytics recomputed per request from raw rows; no stale/cached aggregates |
| Privacy | Reflection notes: browser localStorage only, never transmitted |
| Security | Parameterized SQL only; input sanitisation; no secrets in repo; secret scan before every push |
| Robustness | Friendly error/empty states; graceful handling of transient Neon DNS failures (documented) |
| Accessibility | Semantic headings/tables, `aria` labels on decorative elements and live regions on the note-save confirmation |
| Stack | Next.js 16.4.3 (App Router, Turbopack), React 19, Tailwind 4, TypeScript; no ORM, no component/state/chart libraries |

## 11. Delivery & QA Record

- Milestones M1–M7 (scaffold → database → API → screens → Git/GitHub → Vercel →
  end-to-end verification) all completed and signed off by the product owner.
- Post-launch restyle to the approved visual mocks completed for all three screens,
  including four approved scope additions on Screen 3: **planned stop + breach check
  (S1), scaled positions + timeline (S2), facts-only narrative + evidence (S3),
  local reflection note (S4)**.
- Colour/contrast defect (system dark theme turning the page black) diagnosed, fixed, and
  verified with real-browser screenshots and live-bundle CSS inspection; fixes shipped in
  commits `e0c7950` and `739e0e5`.

## 12. Future Possibilities (not committed; would each need product-owner approval)

1. CSV import of real trades (replacing sample data as the source of facts).
2. Persistent (server-side) reflection notes, out of the current privacy-pure model.
3. Breach-pattern analytics across months (e.g. how often exits exceed planned stops).
4. Additional review prompts and month-over-month comparison views.

---

*Owner-approved scope changes from the original plan are recorded inline as ✅ items 5.1–5.4.
Everything listed as ✅ ships and is live-served today.*
