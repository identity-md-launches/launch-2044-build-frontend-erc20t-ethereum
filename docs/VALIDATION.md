# Validation record

Date: 2026-10-17. Status: **Complete for the stated frontend scope**, with the
integration limits below. This is the worker's recorded verification, not an
independent certification or a smart-contract audit.

## Scope and assumptions

Reviewed the production `dist/` export: Create's three steps and both launch
modes; Explore, token details and failed reads; Manage's launch and owner controls;
the protocol guide; wallet and transaction dialogs. The requested mainnet
addresses and verified ABIs are used. The default page is Create. Styling is a
single light theme with a dark preview component. No owner address, private key,
relay project ID, sample market data or backend was required or invented.

Dependencies and browser tools were installed outside the submission tree.
Manifest/lockfile dependency parity and byte-for-byte staging/export parity were
checked successfully after the final build.
Commands below ran in a temporary build copy of the delivered source, manifest
and lockfile. The resulting production directory was copied back in full after
removing its older build. Production browser tests served it at `/preview/`;
the browser tool also inspected the final export at `/dist/`.

## Executed checks

| Command / check                             | Actual outcome                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`                         | Exit 0; strict TypeScript check passed                                                                       |
| `npm test`                                  | Exit 0; 9/9 tests passed                                                                                     |
| `npm run build`                             | Exit 0; TypeScript and Vite production build passed; 1805 modules transformed                                |
| `npm run test:browser`                      | Exit 0; 23/23 recorded checks passed; Chromium and WebKit passed                                             |
| Pinned `taste.mjs --out test/scratch/taste` | Ran against final `dist/`; 15/16 checks passed, one reviewed false positive described below                  |
| `node scripts/check-export.mjs`             | Final byte, metadata and relative-asset integrity check; exact result retained in `docs/export-results.json` |

The last build produced one 682.29 kB main JS file, a 98.96 kB Coinbase SDK chunk,
a 2.84 kB auxiliary chunk and 27.31 kB CSS, plus local images and HTML. There are
no source maps, dependency archives, runtime font downloads or vendored registry.
The byte check includes source, public assets, editable artwork, export, lockfile,
documentation, tests and scripts; its ceiling is 8,388,608 bytes. The explicitly
budgeted `.gitignore` is under 1,024 bytes.

Browser dependencies initially lacked the WebKit graphics libraries. Required
libraries were installed into temporary tooling storage and WebKit subsequently
rendered the page and passed its interaction test. The runner actually created
a page, completed the launch preview, opened/dismissed the wallet dialog and
checked mobile overflow; launching the browser alone was not counted as success.

### Useful interaction coverage

- Exact decimal parsing, supply conservation and allocation rounding; 0–20%
  retention, 0.3–5% resting tax, decay interval bounds and fractional resting-tax
  clamping; included protocol component and fee-share conservation.
- Verified-ABI calldata for both factory methods; infrastructure addresses,
  explicit/default fee destinations and complete disabling of launch decay.
- Create inline errors, custom-base validation, unavailable RPC blocking writes,
  retry recovery, live base decimals and both address orderings in quoted previews.
  A changed base decimal count after review blocks signing until the user reviews again.
- Named EIP-6963 discovery, generic-wallet suppression, wrong-chain switching,
  mobile wallet links, account state, disconnect/non-owner gating.
- Lock acknowledgement; simulation and wallet-confirmation sequence; wallet
  rejection and retry; zero ETH/base deposit; receipt and created-token navigation.
- Separate regular/decay recipient writes, resting-tax changes and decay lock,
  distributor lookup/add/remove, global distributors, external liquidity and
  pairing permissions. Deployment first followed by the owner's launch uses
  `create` then `launch`, not the atomic method twice.
- Discovery event decoding, filters, search, token detail and failed-refresh
  stale-tax disclosure. Pagination is implemented; large real-chain histories
  were not available for an end-to-end pagination load test.
- Keyboard skip link, modal Tab/Shift+Tab wrapping, Escape and focus restoration;
  disabled controls, announced errors, 200% **text enlargement**, RTL reflow and
  reduced-motion behavior. This was not browser-native 200% zoom.
- Initial layout at 320×900, 390×844, 768×900 and 1440×900; mobile review and owner
  pages without horizontal overflow. No initial-page script errors or missing
  local resources under `/preview/`. Axe found zero violations on the initial
  page, wallet dialog, mobile review and mobile owner settings (46 passing rules
  on the initial page).
- WebKit at 390×844: launch economics with decay, verified preview, wallet dialog
  open/Escape close and reflow. The full transaction matrix ran in Chromium.

The fixture tests intercept RPC and wallet operations; they never send a real
transaction. Public deployment addresses/hashes are used only as deterministic
fixture identifiers. `tests/browser.mjs` and the fixture report are not runtime
data sources for the website.

## Better Interface coverage

All six pinned core-principle sections and the consolidated workflow informed
construction; the implemented design is documented in root `DESIGN.md`.

| Domain        | Coverage    | Evidence and remaining subchecks                                                                                                                                                                                                                                                                               |
| ------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility | **Checked** | Source semantics, visible labels/descriptions, keyboard navigation, dialog trapping/restoration, visible focus screenshot, native switches/radios, reduced motion and axe on four states. Screen-reader sessions, physical touch devices and manually rendered forced-colors mode **not reviewed**.            |
| Layout        | **Checked** | Final screenshots, four responsive widths, no horizontal overflow, no probe-detected overlaps/clipping, mobile review/settings, long address wrapping, text enlargement and basic RTL reflow. Browser-native zoom and every possible name/viewport combination **not reviewed**.                               |
| Writing       | **Checked** | Short product headline and plain explanation; clear step/action labels; explicit zero base deposit, permanent lock, fee split, exact-input restriction, direct-transfer nuance, honest loading/empty/stale/RPC states and recovery. Translation/localization **not applicable** to this English brief.         |
| Typography    | **Checked** | Six declared size tokens; five computed sizes at each probe width, two families and three requested weights; tabular data, exact review quantities, long-value wrapping, compact mobile hierarchy. System font availability varies; no claim that every platform supplies separate 500/600 faces.              |
| Colors        | **Checked** | Semantic palette and dark-preview pairs; the final probe reports all measured solid text/background pairs meet 4.5:1, or 3:1 for large text. Axe found no contrast violations in the inspected additional states. Every wallet-provided icon, overlay composite and forced-color combination **not reviewed**. |
| UI            | **Checked** | Default, hover/focus, disabled, invalid, loading, empty, stale, wallet rejection, pending and confirmed patterns. Flat page surfaces, one shadowed dialog, meaningful icons, 120ms opt-in motion and useful targets. Physical mobile-app handoffs and real passkey session **not reviewed**.                   |

### Findings, corrections and rechecks

Locations refer to the final source; original defects were repaired before the
last build. Related effects are grouped under their root cause.

| Severity / domain      | Source location                          | Observed issue and correction                                                                                                                                                                                                       | Recheck                                                                                                                        |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| High / layout          | `src/styles.css:1515`                    | Initial mobile spacing pushed part of Continue below the first screen. Reduced mobile heading, step and field spacing while retaining readable labels and input targets.                                                            | 390×844 screenshot: complete action bottom at 806.59px; no scroll needed for the first step.                                   |
| High / accessibility   | `src/App.tsx:33`                         | A normal `#main` skip link changed the hash router. It now prevents route mutation and focuses the main landmark.                                                                                                                   | Keyboard test confirms focus and unchanged route.                                                                              |
| Medium / accessibility | `src/ui.tsx:99`                          | Tab traversal could leave a native dialog for browser chrome. Added explicit first/last wrapping, retaining native inert background, Escape and focus return.                                                                       | Tab/Shift+Tab and Escape checks pass; focused wallet-row screenshot inspected.                                                 |
| Medium / accessibility | `src/ui.tsx:192`                         | Field units needed association with their input alongside hints/errors. `aria-describedby` now includes the visible suffix.                                                                                                         | Typecheck and final axe checks pass; source association reviewed.                                                              |
| High / writing and UI  | `src/Launch.tsx:373`, `src/model.ts:164` | Rounded review quantities and implementation-oriented price ordering labels could obscure economics. Review now preserves exact supply and shows an effective price/range with a plain explanation.                                 | Precision unit test and six-decimal base browser test pass; mobile review inspected.                                           |
| Medium / UI            | `src/Launch.tsx:631`                     | The initial tax-chart illustration was not tied to all actual interval steps. The path is generated from completed intervals and clamps to resting tax.                                                                             | Decay model tests pass; rendered decay preview inspected in WebKit.                                                            |
| High / UI              | `src/Explore.tsx:20`, `src/chain.ts:274` | Discovery batching could omit more than 24 entries, and initial reads could replace a manual lookup. Pending addresses now remain pageable; lookup additions persist until explicit refresh.                                        | Discovery/filter/lookup browser checks pass; remaining-address handling source-reviewed. Large live histories remain untested. |
| High / UI              | `src/transaction.tsx:55`                 | A cancelled/replaced transaction must not appear as successful completion of the requested action. The receipt handler distinguishes gas repricing from different operations and prevents resubmission while a hash needs checking. | Success/rejection fixture tests pass; replacement branch source-reviewed, not simulated end-to-end.                            |
| Medium / UI            | `src/wallet.tsx:24`                      | Rabby's app link needed its documented command and dapp parameters. Updated from current official handler source; switch errors are visible in the account dialog.                                                                  | Link assertion and wrong-chain test pass; physical app handoff remains unperformed.                                            |

A final pricing review added a pre-signing decimal-count comparison at
`src/Launch.tsx:131` and `src/Manage.tsx:246`. Mutable base metadata can otherwise
change the meaning of a previously reviewed price. Both launch paths now require
a new preview if the decimal count changes. The additional browser case changes
base decimals between review and submission and asserts that no wallet transaction
is sent. One test-run timing failure was corrected by awaiting the token-detail
refresh control before injecting an RPC outage; the earlier text assertion could
match the discovery list before navigation finished.

### Design probe result

The final probe passes render, layout, targets, contrast, casing, tracking,
type-sizes, type-faces, glyphs, slogans, repetition, copy-budget, chrome, motion and
share. First-screen prose is 25 words at 390px and 26 at 1440px. All 18 measured
mobile controls satisfy its 24px-or-spacing rule; six are below the advisory
44px comfortable size, principally inline/native control measurements. Main
buttons and input hit areas retain 44–48px minimum sizing.

The single `eyebrows` flag is `src/Launch.tsx:160`: the functional numbered step
circle **1**, above “Make it yours.” at 1440px. It is part of the ordered
Token/Economics/Review progress indicator, not a marketing kicker. It is retained
as a deliberate, reviewed exception; the raw failure is preserved in the report.
There are no unresolved observed first-screen clipping or repeated layout failures.

Measured submission: **1,597,647 bytes**, including **879,905 bytes** in `dist/`.

## Evidence

Retained evidence from the final export:

- [390px first screen](screenshots/create-390.png),
  [1440px creation page](screenshots/create-1440.png),
  [mobile wallet sheet](screenshots/wallet-390.png).
- [23 browser check results](browser-results.json).
- [All 16 design-probe results](design-probe-results.json).
- [Export integrity and size](export-results.json).

Additional screenshots were inspected from the temporary runner output:
`test/scratch/browser-validation/keyboard-focus.png`, `mobile-review.png`,
`mobile-manage.png`, `text-200-percent.png` and `webkit-review.png`.
These scratch files are intentionally excluded from the submission. The browser
tool also navigated the final export and returned an inspected screenshot.

## Integration limitations

Sourcify and Blockscout verified-source/ABI retrieval succeeded for all three
supplied contracts. Direct public mainnet RPC requests returned HTTP 403. Actual
live preview calls, funded transactions, a fork run, gas/fee-conversion behavior
on-chain, physical wallet-app handoff and Coinbase passkey creation were therefore
not verified. The public client, infrastructure checks, simulations and wallet
requests remain real in production and present recoverable errors when reads fail.

The app uses bounded log ranges and progressive token reads; public RPC history
limits still depend on the provider. Live tax refreshes every 15 seconds while
active and labels readings stale after failed/old reads. It does not imply that
an offline tax value is current. The owner controls expose permission changes;
there is no liquidity deposit screen or swap router. Exact-input swap and EOA
transfer restrictions are explained from verified source.

No manual screen-reader session, browser-native zoom, physical-device session,
mainnet submission or contract security audit is claimed. Open Graph metadata
and a local 1200×630 share image exist; third-party social crawler behavior under
each future IPFS gateway was not tested.
