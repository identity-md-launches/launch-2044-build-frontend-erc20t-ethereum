# ERC20T design system

## Overview

ERC20T is a working token launch and management interface for Ethereum creators.
The visual direction follows the brief's minimalist references: a warm neutral
canvas, strong alignment, thin rules, generous desktop spacing and plain controls.
The first page opens directly into creation. A short headline and one explanatory
sentence establish the product; there is no separate marketing hero to scroll past.

The shared shell is in `src/App.tsx`; the visual source of truth is
`src/styles.css`. Create uses a form beside a dark economic preview. Explore uses
rows, and Manage uses divided settings sections. These arrangements serve their
different tasks rather than forcing every page into the same card grid.

## Colors

Canonical CSS variables are declared at `src/styles.css:2`.

| Token                       | Value     | Implemented role                                  |
| --------------------------- | --------- | ------------------------------------------------- |
| `--neutral-0` / `--surface` | `#ffffff` | Inputs, wallet options, primary-button text       |
| `--neutral-50` / `--bg`     | `#f5f5f1` | Page and dialog canvas                            |
| `--neutral-100` / `--hover` | `#ebebe6` | Quiet hover surfaces                              |
| `--neutral-200` / `--line`  | `#d4d5cd` | Dividers, input and secondary-button borders      |
| `--neutral-500` / `--muted` | `#65665e` | Hints, secondary copy and inactive navigation     |
| `--neutral-900` / `--text`  | `#191a18` | Main text, primary actions and active navigation  |
| `--lime-200` / `--accent`   | `#dcf7a0` | Allocation bar, preview chart and completed steps |
| `--green-700` / `--success` | `#355b20` | Confirmed and successful-check text               |
| `--red-700` / `--error`     | `#a52b25` | Validation and recoverable-error text             |
| `--focus`                   | `#365fbb` | Keyboard focus outline                            |
| `--dark-bg`                 | `#20221e` | Launch preview                                    |
| `--dark-text`               | `#f3f5eb` | Preview primary text                              |
| `--dark-muted`              | `#b6bcae` | Preview labels and explanation                    |
| `--dark-line`               | `#484d42` | Preview separators and chart grid                 |

Primary hover is `#35372f`. The modal backdrop is `#1119`. The preview is a
specific component treatment, not a second site theme. Success, failure, selection
and freshness also have text, icons, borders or native control state; color is
never the sole explanation. Measured contrast coverage is in `docs/VALIDATION.md`.

## Typography

The main stack is `Arial, Helvetica, sans-serif`. Addresses and selected data use
`"SFMono-Regular", Consolas, "Liberation Mono", monospace` with tabular numerals.
There are no font downloads. CSS requests weights 400, 500 and 600, with
`font-synthesis: none`; a system font can map intermediate weights to its nearest
available face. Exact font glyphs and weight availability vary by operating system.

| Token            | Size at the default 16px root | Use                                             |
| ---------------- | ----------------------------- | ----------------------------------------------- |
| `--text-xs`      | 12px                          | Hints, secondary data, step numbers             |
| `--text-sm`      | 14px                          | Labels, navigation, actions and compact prose   |
| `--text-base`    | 16px                          | Inputs, body text and section labels            |
| `--text-lg`      | 24px                          | Section headings, token identity and wordmark   |
| `--text-xl`      | 32px                          | Narrow-screen page heading and preview quantity |
| `--text-display` | 56px                          | Desktop page heading and preview quantity       |

Body line height is 1.5. H1 uses 1.05 and `-0.055em` tracking on desktop;
at 800px and below it uses 32px and `-0.04em`. H2 uses 1.25 and `-0.03em`;
H3 uses 1.4. Headings balance, prose uses pretty wrapping where supported, and the
intro has a 66-character maximum measure, reduced to 38 characters on phones.
Full addresses and long token names can wrap anywhere. Compact quantities are
reserved for previews; final review preserves the exact supplied quantity and
all effective-price decimal places.

## Layout

`.main-shell` is centered, with a 1280px maximum including 48px side padding.
The header is full width. Main navigation, form headings and input edges align.
The common spacing choices are 4, 8, 12, 16, 20, 24, 28, 32, 40, 48 and 56px;
these are component CSS values rather than a separate spacing-token API.

Create's `.launch-layout` uses `1.15fr 1fr`, a 56px gap and top alignment.
The preview follows the form in DOM order. Native fields and flexible grid columns
use `min-width: 0`; content is allowed to grow instead of being clipped.

| Breakpoint   | Actual adaptation                                                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Up to 1100px | Shell padding 32px, create gap 32px, decorative heading note removed                                                                                                                                            |
| Up to 800px  | Shell padding 24px, 32px H1, one-column creation, form max-width 580px; preview moves below                                                                                                                     |
| Up to 600px  | Shell padding 20px; compact heading/form spacing; 44px navigation; network label and secondary top-nav guide link hidden; guide remains in footer; token rows and settings reflow; dialogs become bottom sheets |
| Up to 359px  | Shell padding 16px; smaller wordmark; compact step gaps; mode labels retain native radio behavior with a visible focus outline                                                                                  |

The header has a 64px minimum on phones. Primary buttons and inputs have a 48px
minimum height; wallet and icon controls have 44px minimum targets. At 390×844,
the complete first-step Continue action is visible without scrolling. Long
reviews and management settings scroll normally. Modal sheets use `100dvh`,
internal overflow and safe-area bottom padding. No fixed CTA obscures content.

Rendered reflow was checked at 320, 390, 768 and 1440px; text enlargement and
experimental RTL direction were also checked. RTL is a robustness check, not a
translated product. See validation for the exact states and browser coverage.

## Elevation & Depth

The page is flat: thin rules divide navigation, rows and settings. Inputs use a
white fill and border, and the preview uses tonal separation without a shadow.
Only `.modal` has elevation: `0 16px 64px #0003`, with no border. Native `dialog`
puts overlays in the browser top layer; the background becomes inert. The skip
link has z-index 100 and appears when keyboard-focused.

## Shapes

Inputs, buttons and wallet rows use 4px corners. The wallet header control and
mode group use 5px; the preview uses 6px. Desktop dialogs use 8px; mobile sheets
use 12px top corners. Brand marks, step indicators and token glyphs are circular.
Switches use a rounded track with a circular thumb. There is no universal pill
treatment for headings or promotional labels.

## Components

| Component / pattern                                                    | Source                | Behavior and reuse                                                                                                                                               |
| ---------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Icon`                                                                 | `src/ui.tsx`          | Consistent 1.5px SVG strokes; decorative icons are hidden from assistive technology                                                                              |
| `Field`                                                                | `src/ui.tsx`          | Visible label, optional hint/error/unit, 16px input text, associated descriptions and `aria-invalid`                                                             |
| `Toggle`                                                               | `src/ui.tsx`          | Native checkbox with switch role, visible explanatory label, disabled and keyboard-focus states                                                                  |
| `Modal`                                                                | `src/ui.tsx`          | Named native dialog, explicit Tab wrapping, scroll lock, Escape/backdrop dismissal and focus restoration; pending transactions prevent dismissal                 |
| `ErrorNote`, `Stat`, `AddressLink`                                     | `src/ui.tsx`          | Alert/recovery copy, aligned review data, full contract addresses linked to Etherscan                                                                            |
| `.button.primary`, `.button.secondary`, `.text-button`, `.icon-button` | `src/styles.css`      | One primary action per step; secondary/back actions, inline recovery, and named icon controls; hover, focus, disabled and busy labels                            |
| `WalletControl`                                                        | `src/wallet.tsx`      | Single connect/switch/account entry; named browser wallets, mobile app links, Coinbase wallet, errors and disconnect                                             |
| `TransactionStatus`                                                    | `src/transaction.tsx` | Polite progress text; confirmation, wallet rejection, simulation failure, pending receipt and receipt retry; transaction link remains available                  |
| Launch stepper and preview                                             | `src/Launch.tsx`      | Three labeled stages with current/completed state; allocation bar, calculated stepped decay and included fee split; final review requires a lock acknowledgement |
| Discovery rows and token detail                                        | `src/Explore.tsx`     | Search, filters, explicit empty/loading/error states, pagination, full token identity and block-stamped tax with stale disclosure                                |
| Settings sections                                                      | `src/Manage.tsx`      | Owner/network gating, independent updates, explanations beside switches and a transaction-review dialog                                                          |

`src/styles.css` opts into 120ms background/transform transitions only when
`prefers-reduced-motion: no-preference`. Active buttons scale to 0.96 only under
that preference. There is no looping animation. Focus-visible uses a 2px blue
outline with 4px offset. Forced-colors rules retain control borders and selected
navigation cues; that mode was source-reviewed, not manually rendered.

## Do's and Don'ts

- Start another page inside the existing shell and hash navigation. Reuse the
  section hierarchy, fields and divided rows before adding another surface.
- Use a clear verb for the next action and put its prerequisites beside it.
  Keep the product and first action visible on a phone.
- Reuse semantic color variables. Keep the lime accent for preview data and
  completed state, and keep all error/recovery explanations visible in text.
- Preserve full addresses and exact economic values in consequential reviews.
  Label data freshness and distinguish a local illustration from a contract check.
- Add loading, empty, disabled, error and successful states with a new interaction.
  Reuse `Modal` for owner-write review and `TransactionStatus` for transaction life cycle.
- Do not add remote fonts, a decorative hero, nested cards, a seventh type size or
  arbitrary motion to an otherwise equivalent page. Recheck narrow reflow and
  keyboard focus whenever the shared components change.
