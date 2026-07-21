# Unfold — what’s implemented (product & logic)

This document describes **what exists in the product today** and **how the logic works** — flows, rules, and decisions — not code structure.

**Unfold** is a private journaling product: you write freely, seal entries, and the app helps you notice recurring *mental patterns* in how you think. It does not diagnose, coach, or give therapy-style advice. Observational voice only.

Repo package name is still `keeps`; the product brand is **Unfold**.

---

## 1. Product at a glance

| Area | Status |
|------|--------|
| Write & seal journal entries | Shipped |
| Local-first drafts + cloud sync when signed in | Shipped |
| Image attachments | Shipped (upload path); on-canvas image chrome is thin |
| AI titles on seal | Shipped |
| Pattern extraction & surfacing | Shipped |
| Living pattern “discovery” readings | Shipped |
| Auth (email + Google) | Shipped |
| Marketing landings | Shipped (3 concepts) |
| Guest mode | Not shipped (auth required) |
| Account wipe / export in-product | Not shipped (email request only) |
| Re-analysis after editing a sealed entry | Not shipped (one analysis per entry forever in V1) |

**End-to-end loop**

1. Write a journal entry (draft).
2. Seal it (or leave a long draft idle long enough).
3. AI may name the entry and extract mental patterns with quotes.
4. After a pattern appears in enough entries, it surfaces on Patterns.
5. Opening a pattern walks a guided reading built from your quotes + short AI lines.
6. Optional thumbs on the closing beat.

---

## 2. Auth & account

### How you get in

- **Clerk** owns identity (email/password or Google).
- Sign-in and sign-up are **one screen** (`/sign-in`). `/sign-up` redirects there.
- You must accept Terms + Privacy before continuing with email/password.
- Password rules: ≥8 characters, upper, lower, digit, special.

**Email flow logic**

1. Always try **sign-in** first.
2. If that fails in a way that could mean “no account” *or* “wrong password”, try **create account** (avoids leaking whether an email exists).
3. OTP verification when needed (6-digit code, resend cooldown).
4. If Clerk still needs profile fields, the app **silently fills** them (legal accepted, generated username, placeholder name) and sends you to the dashboard — no username form.

**Google**

- OAuth redirect → SSO callback → optional silent “continue” finish → dashboard.
- Cancelled/denied OAuth returns to sign-in.

### After auth

- First authenticated write ensures a **User** row whose id **is** the Clerk user id.
- All app data is scoped to that user.
- Post-auth destination: `/dashboard`.

### What is public vs protected

Public: landing pages, auth, terms, privacy, `/dev/*`.  
Everything else (dashboard, APIs) needs a signed-in session.

---

## 3. Journaling

### What an entry is

Two pieces of local data:

- **Metadata** — id, title, timestamps, sealed/deleted flags, searchable plain text.
- **Board content** — the full canvas snapshot (writing blocks, images, seal state).

Editing is **local-first**: changes hit the browser immediately. When signed in, sync mirrors that to the server.

### Draft

- No seal date → fully editable title and body.
- Autosave mirrors content quickly; after a longer idle, a “milestone” save updates the session stamp in the header.
- **At most one empty unsealed draft** — “New entry” reopens that empty one instead of spawning duplicates.
- Creating an entry: sidebar **+**, or landing on `/dashboard` (redirects to newest or a new id).

### Seal

- User presses the rubber-stamp control.
- Seal is **immediate and sticky**: content and title become read-only; `sealedAt` cannot be cleared by a late draft save.
- Persistence happens at stamp start so you can navigate away mid-animation.
- Background after seal:
  1. If title is empty and there are enough words → AI title (else “Untitled Entry”).
  2. Pattern analysis is notified.
- Re-sealing an already sealed entry does nothing new.
- Manual titles always win over AI.

### Implicit completion (patterns only)

An **unsealed** draft that has been idle **≥ 24 hours** and has **≥ 50 words** is eligible for pattern analysis. The UI still shows it as a draft. This does not set a seal date.

### Delete

- Trash in the sidebar soft-deletes: local removal + **tombstone** so sync cannot resurrect the entry.
- If you delete the open entry, you move to another entry (or a new empty draft).

### Lifecycle (behavioral)

```
empty / new → DRAFT ⇄ edit & autosave
                │
           seal stamp
                ↓
             SEALED (read-only; title & analysis async)
                │
          sidebar delete
                ↓
             DELETED (tombstone; sticky)
```

---

## 4. Editor / canvas

### Writing surface

- TipTap-based journal page: title + body + seal stamp.
- Body is a sequence of **blocks**: paragraph, bullet list, or checklist.
- Hard cap: **7 blocks**. Extra Enter becomes a hard break inside the current block.
- Select ≥4 characters → floating format bar (paragraph / list / checklist).
- Header time stamp is frozen for the visit (same calendar day reuses last edit time).
- Spellcheck and undo/redo on.
- Multi-column layouts are retired; old data still loads as one column.
- Seal stamp locks the page; no separate handwriting signature field.

### Seal stamp UX

- Corner control; imprint can show the user’s display name.
- Hover can prefetch an AI title.
- After seal, imprint stays; no re-animation.

### Images

- Drop (or pick) an image → show immediately as a local data URL → upload in the background → swap to a public blob URL on success.
- Max **10MB**, images only.
- Snapshot stores the URL (not the binary). Metadata lives in the attachments table.
- On-canvas polaroid chrome (captions, rearrange UI) is largely unwired; the upload path still works.

### Quote deep-link from Patterns

Opening a quote from a pattern can highlight that passage in the entry, scroll it into view, then fade after a hold — or clear if you scroll yourself.

### Word counts (gates, not a badge)

- **≥ 3 words** → AI title may run on seal.
- **≥ 50 words** → inactivity can trigger analysis.

---

## 5. Sync & storage

### Model

| Mode | Behavior |
|------|----------|
| Signed out | Pure localStorage |
| Signed in | Local remains the editing surface; server is the durable mirror |

Sync runs on sign-in/mount, about every **5 minutes**, on tab focus if due, and as a debounced push when local data is dirty.

### Conflict rules (entries)

- **Last-write-wins** on the client `updatedAt` clock (whole entry).
- **Deletes always win** over live content (tombstones).
- Soft-deleted server rows cannot be undeleted by a live push.
- Pull never resurrects a locally deleted id.
- Applying remote data does not mark the client dirty (no echo loop).

### Pull cursor

- Incremental pull uses a server clock watermark (`serverUpdatedAt`), separate from the client LWW clock.

### First-time import

- If the cloud is empty, local entries (and patterns) are uploaded once; data-URL images are rewritten to blob attachments.
- If the cloud already has data, skip upload and pull.

### What syncs

- **Entries:** metadata + full canvas JSON + search text / content hash.
- **Patterns (separate snapshot):** analyses, pattern states, passages, display titles, votes.

### Database (conceptual)

| Record | Role |
|--------|------|
| User | Clerk id, display name, preferences |
| Journal entry | Source of truth for writing; draft vs sealed; soft delete; canvas JSON |
| Attachment | Blob reference + display metadata |
| Entry analysis | One AI extraction per entry |
| Pattern state | Non-regenerable planner memory (lifecycle, signatures, epochs) |
| Pattern passage | Cached guided reading + AI voice fills |
| Pattern display | Cached curiosity title / summary |
| Pattern vote | Thumbs on closing beat |

**Not stored as source of truth:** which patterns surface, time hints, co-patterns, discovery arc UI structure — those are computed.

---

## 6. AI titles

**Job:** name a sealed page as a short memory anchor (a moment or unfinished thought), not a summary or mood label.

**When**

1. Warm-up request can hit the title route while drafting (compile only).
2. Prefetch on stamp hover / enough words.
3. On seal: if title empty and ≥3 words → generate; else “Untitled Entry”.
4. Existing non-empty title → skip AI.

**How (logic)**

- Short input cap; Haiku model; strict validation (length, banned shapes, no self-help voice).
- If the model fails validation → retry with a stricter prompt → stable hash fallback word list.
- Missing API key or errors → same fallbacks. Client also re-checks and can fall back.

---

## 7. Patterns system

Patterns are about **how** someone is thinking in an entry — not topics, events, or advice.

### Controlled vocabulary (V1)

Exactly **10** mental patterns. The model may not invent others.

| Name | Meaning |
|------|---------|
| Comparison | Measuring self against others |
| Self-doubt | Questioning ability / worth |
| Overthinking | Looping without resolution — **only when no more specific pattern fits** |
| Perfectionism | Standards so high nothing ships / feels done |
| Avoidance | Putting off or escaping what matters |
| Catastrophizing | Escalating to worst case |
| People-pleasing | Others’ comfort over own needs |
| Fear of judgment | Worry about how others evaluate them |
| Self-criticism | Harsh self-talk / blame |
| All-or-nothing | Black-and-white thinking |

Deferred (not in V1): need for control, guilt.

**Extraction caps**

- Confidence ≥ **0.5** or drop.
- Up to **3** patterns per entry.
- Up to **2** topics per entry (separate from patterns).
- Up to **2** verbatim evidence quotes per pattern.
- Prefer the **most specific** pattern; don’t use overthinking as a catch-all.

### When analysis runs

| Trigger | Effect on entry | Effect on patterns |
|---------|-----------------|--------------------|
| Explicit seal | Sealed, read-only | Analyze once |
| Idle ≥24h + ≥50 words | Still a draft in UI | Analyze once |
| Patterns page load | — | Backfill up to 5 missing analyses |

**V1 rule:** one analysis per entry id, ever. Content hash is stored for future stale detection, but edits do **not** re-run analysis yet. Failures store nothing so reconcile can retry.

**What gets extracted**

- Topics (what it’s about).
- Patterns with confidence + verbatim quotes from the text.
- Stance: observe only — empty patterns array is valid.
- Long entries are head+tail sampled so recent writing is favored.
- Quotes must appear verbatim in the source or the match is rejected.

### How patterns surface

Pure rollup — **no LLM**:

1. Each analysis votes its pattern names (one vote per entry per name).
2. Attach evidence: title, dates, quotes, confidence.
3. A pattern needs evidence from **≥ 3 distinct entries** to appear.
4. Deleted entries drop out.

Also computed (available on the aggregate; list UI mainly shows title + timeline + count):

- **Time hint** — e.g. “usually late evening” when enough evidence shares a day-part.
- **Co-patterns** — other patterns that often show up in the same entries.

### Lifecycle (living patterns)

Each surfaced pattern has a **stage of life**. Classification is deterministic and count-based, with hysteresis so stages don’t flicker.

| Stage | Meaning |
|-------|---------|
| Emerging | Young / thin evidence |
| Strengthening | Recent activity building |
| Strong | Steady presence |
| Weakening | Decline while journaling continues |
| Resting | No journaling activity for a while — **absence**, not “you improved” |
| Returning | Quiet gap, then fresh evidence after prior history |

**Honesty rule:** resting is checked before weakening so silence never reads as progress.

**Memory:** pattern state is kept even if a pattern temporarily disappears — that history enables “returning.”

Thresholds are tunable (recent window, return gap, min dwell before stage change, etc.).

### Composition: the guided reading

**App owns structure; model fills words.**

1. From evidence + lifecycle + memory of recent compositions, pick a **shape** from a fixed catalog.
2. Bind journal quotes into evidence slots (up to ~6 quotes, ranked for felt/tension language, with entry diversity).
3. Detect useful structures (e.g. pair across a long gap, echo of a shared word).
4. Voice slots (mechanism line, reflection question, optional short line) start empty.
5. Claude fills those slots under strict “no advice / no therapy / no pattern labels” rules.
6. Cache the full passage; regenerate only when evidence, lifecycle, or cache policy requires it.

**Depth by life stage (simplified)**

- Emerging / resting → evidence-heavy, less voice.
- Strengthening / strong → richer compositions.
- Preferred guided shape when eligible: **discovery** (moments → mechanism → reflection).

**Cache key idea:** evidence fingerprint + lifecycle + composition signature (+ version). Same-evidence re-plans try to preserve voice; don’t downgrade a healthy discovery reading to quotes-only.

### Landing titles (pattern list)

Separate from passages. Purpose: make the writer **want to open** the pattern before knowing what it means.

- AI: short curiosity/tension title (not psychology labels, not coaching).
- Optional short observational summary.
- Fallback titles per pattern if AI fails.
- List and sidebar only show patterns whose display title is **ready** (no skeleton tease).

### Patterns UI

**List**

- Intro: patterns that have been returning.
- Accordion: curiosity title + date range · entry count.
- One open at a time → embedded detail.
- Nothing surfaced → redirect to dashboard.
- Sidebar badge = count of patterns with ready display titles.

**Detail (discovery canvas)**

1. **Evidence** — quote cards; tap opens the journal focused on that quote.
2. **Mechanism** — AI event chain as stepped sentences (how they kept arriving here).
3. **Reflection** — one observational question (or a featured quote for some endings).

Interaction: open on evidence → “Show the pattern” / “Continue” through beats → **Done** on the last. Previous beats stay on the page and recede. CTA waits until voice fills are ready.

**Closing vote**

- Quiet thumbs (“Was this helpful?”).
- Stored with which evidence entries were involved.
- Persistence/sync only — no product logic beyond capture.

### Not shipped / deferred

- Content-hash re-analysis after edits (hash is stored; re-run is not wired).
- Guest mode (auth required for dashboard).

---

## 8. Marketing landings

Shared narrative voice: observational, no diagnosis/coaching. Shared CTA: Get started → sign-in.

| Route | Experience |
|-------|------------|
| `/` | **Living canvas** — scroll-driven fake workspace: tagline → write demo → quote chips → pattern reveal → CTA |
| `/homepage2` | **Reading journey** — two sample entries → highlight bridge → pattern → CTA |
| `/homepage3` | **Infinite workspace** — pan-able desk of moments → pattern → CTA |

Prototype interactions on `/` (open fake entries, search, patterns) are local UI only — not real account data.

---

## 9. Legal & privacy (product claims)

- Age ≥13; you own your content; limited license to operate Unfold.
- Writing syncs to the database; images to blob storage; pattern features may send excerpts to Anthropic.
- Not medical/therapeutic/diagnostic.
- Soft-delete entries clear writing for sync; full account deletion / export via email (`hello@unfold.app`).
- No separate analytics/ads SDK claimed in privacy copy.
- Processors called out: Clerk, Postgres host, Vercel Blob, Anthropic, Google (sign-in + fonts).

---

## 10. Dev & tooling

- `/dev/editor` — TipTap sandbox.
- `/dev/stamp` — seal stamp layout playground.
- Scripts for reviewing pattern shapes, regenerating voice fills, re-running extractions fixtures.
- AI routes expose lightweight GET warm-ups that don’t call the model.

---

## 11. Tech stack (snapshot)

| Layer | Choice |
|-------|--------|
| App | Next.js (App Router), React, TypeScript |
| Auth | Clerk (custom UI, not hosted SignIn widget) |
| DB | PostgreSQL + Prisma |
| AI | Anthropic Claude (Haiku) for titles, extraction, slots, display |
| Editor | TipTap |
| Files | Vercel Blob |
| Client cache | localStorage + window events (no global journal store library) |

---

## 12. Route map (user-facing)

| Path | Purpose |
|------|---------|
| `/` | Primary landing |
| `/homepage2`, `/homepage3` | Alternate landings |
| `/sign-in` | Auth |
| `/sign-in/sso-callback`, `/sign-in/continue` | OAuth finish |
| `/terms`, `/privacy` | Legal |
| `/dashboard` | Redirect into journal |
| `/dashboard/journal/[id]` | Entry canvas |
| `/dashboard/patterns` | Patterns list |
| `/dashboard/patterns/[pattern]` | Pattern deep link / detail |

---

## 13. Mental model cheat sheet

```
Write (local) → Seal (or idle long draft)
        ↓
   AI title (if needed)     AI extraction (patterns + quotes)
        ↓                            ↓
   Sealed entry              Analyses accumulate
                                     ↓
                         Pattern appears in ≥3 entries
                                     ↓
                    Lifecycle stage + curiosity title
                                     ↓
              Plan reading shape → fill mechanism/reflection
                                     ↓
                 Patterns UI: evidence → mechanism → reflection
                                     ↓
                              Optional thumbs vote
```

**Durable memory:** entries, analyses, pattern state, votes.  
**Disposable AI cache:** passages, display titles.  
**Always recomputed:** aggregation, surfacing, most UI structure.
