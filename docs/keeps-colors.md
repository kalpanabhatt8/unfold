# Keeps — color tokens

Source of truth: `src/app/global.css` (`:root`).

---

## Semantic roles (edit these)

| Role | Token | Hex |
| --- | --- | --- |
| **Accent** | `--accent` | `#430F24` |
| Accent hover | `--accent-hover` | mix accent 86% + black |
| Accent active | `--accent-active` | mix accent 72% + black |
| Accent on fill | `--accent-foreground` | `#fff8f2` |
| **Surface canvas** | `--surface-canvas` | `#FCFCFC` |
| **Surface chrome** | `--surface-chrome` | `#FAF8F9` |
| Chrome hover | `--surface-chrome-hover` | `#F6F3F5` |
| Chrome active | `--surface-chrome-active` | `#F0EAED` |
| **Surface raised** | `--surface-raised` | `#FFFFFF` |
| **Text primary** | `--text-primary` | `#141314` |
| **Text secondary** | `--text-secondary` | `#544E52` |
| **Text muted** | `--text-muted` | `#928A90` |
| Text disabled | `--text-color-disabled` | `#C2BBBF` |

### Kept distinct (not near-white fills)

| Token | Hex | Use |
| --- | --- | --- |
| `--sidebar-border` | `#E4D8DE` | chrome border |
| `--sidebar-tab-track` | `#EDE4E9` | tab track |
| `--sidebar-tab-selected-bg` | `#E7DDE2` | selected tab |
| `--journal-quote-highlight` | `#F9E7EB` | quote tint |
| `--canvas-recess` | `#F2EFEB` | recessed UI |
| `--canvas-brown` | `#7E675F` | toolbar icon |

### Base gray ramp (unchanged)

`--gray-25` … `--gray-900` — see `:root` in `global.css`.

---

## 1. Merged / removed tokens → what they point to now

| Former token (unique hex before) | Now |
| --- | --- |
| `--button-primary` `#684050` | → `--accent` `#430F24` |
| `--canvas-title-ink` `#421024` | → `--accent` `#430F24` |
| `--button-primary-hover` / `-active` | → `--accent-hover` / `--accent-active` |
| `--button-primary-foreground` | → `--accent-foreground` |
| `--auth-primary` / `--auth-ring` | → `--accent` |
| `--app-bg` `#FCFCFC` | → `--surface-canvas` |
| `--bg` | → `--surface-canvas` |
| `--canvas-bg-gradient` `#FCFCFC` | → `--surface-canvas` |
| `--surface-0` / `--surface-solid` | → `--surface-canvas` |
| `--discovery-canvas-bg` (mix) | → `--surface-canvas` |
| `--auth-page-bg` | → `--surface-canvas` |
| `--canvas-bg` `#FEFCFD` | → `--surface-raised` `#FFFFFF` |
| `--sidebar-bg-lightest` `#FEFCFD` | → `--surface-raised` |
| `--auth-card-bg` `#FFFFFF` | → `--surface-raised` |
| `--auth-input-bg` | → `--surface-raised` |
| Accordion hardcodes `#FEFCFD` / `#FEFDFE` | → `--surface-raised` |
| `--sidebar-bg` `#FAF8F9` | → `--surface-chrome` |
| `--sidebar-hover-bg` `#F6F3F5` | → `--surface-chrome-hover` |
| `--sidebar-active-bg` `#F0EAED` | → `--surface-chrome-active` |
| `--auth-muted` | → `--surface-chrome` |
| `--text-color-active` `#2C282A` | → `--text-primary` |
| `--sidebar-ink` `#38343A` | → `--text-primary` |
| `--sidebar-active-ink` `#443C42` | → `--text-primary` |
| `--canvas-ink` | → `--text-primary` |
| `--fg` | → `--text-primary` |
| `--text-secondary` (was `#3F3A3D`) | **role value** `#544E52` |
| `--text-color-secondary` `#544E52` | → `--text-secondary` |
| `--text-color-sealed` `#726C70` | → `--text-secondary` |
| `--canvas-ink-secondary` `#85766B` | → `--text-secondary` |
| `--canvas-date-time` `#6D6D6D` | → `--text-secondary` |
| `--muted-2` | → `--text-secondary` |
| `--text-color-tertiary` `#8F888D` | → `--text-muted` |
| `--sidebar-ink-soft` `#928A90` | → `--text-muted` |
| `--sidebar-icon` `#827A80` | → `--text-muted` |
| `--canvas-muted` `#85766B` | → `--text-muted` |
| `--canvas-title-placeholder` `#9F9B9C` | → `--text-muted` |
| `--canvas-writing-placeholder` `#9F9B9C` | → `--text-muted` |
| `--text-tertiary` / `--muted` | → `--text-muted` |
| `--auth-neutral` / `--auth-muted-foreground` | → muted / secondary |

---

## 2. Spot-check (no broken aliases)

| Surface | Expected after merge |
| --- | --- |
| **Sidebar** | Still warm `#FAF8F9`; hover/active steps unchanged; brand/title ink is wine `#430F24` |
| **Pattern cards** | Raised white `#FFFFFF` via `--surface-raised` |
| **CTA buttons** | Fill `#430F24` (darker than old mauve `#684050`); hover/active still darken via `color-mix` |
| **Page / Patterns main** | Neutral `#FCFCFC` via `--surface-canvas` |
| **Writing canvas** | `--canvas-bg` → raised white (was pink-white `#FEFCFD`) — slight warm→neutral shift by design |

Legacy variable **names** remain so components do not need renames.

---

## 3. Unique hex dump (semantic + chrome accents + text)

**Before (scattered semantic whites/near-blacks):** ~25+ unique semantic hexes  
**After (roles + kept accents):**

```
#141314  #430F24  #544E52  #7E675F  #928A90  #C2BBBF
#E4D8DE  #E7DDE2  #EDE4E9  #F0EAED  #F2EFEB  #F6F3F5
#F9E7EB  #FAF8F9  #FCFCFC  #FFFFFF  #FFF8F2
```

Plus unchanged `--gray-*` ramp (`#FDFCFC` … `#121212`).

Dropped as unique semantic values (now aliased):  
`#421024`, `#684050`, `#2C282A`, `#38343A`, `#443C42`, `#3F3A3D`, `#726C70`, `#85766B`, `#6D6D6D`, `#8F888D`, `#827A80`, `#9F9B9C`, `#FEFCFD`, and discovery mix.
