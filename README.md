# ERC20T

A static Ethereum mainnet launch application, built with React, TypeScript, Vite,
wagmi and viem. `dist/` is the complete publishing artifact and is included with
the source and lockfile. No server, account, API key or WalletConnect project ID
is needed to build the site.

## Install, preview and rebuild

Use Node.js 24 and npm. Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run dev
```

To check and serve the production export:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Open the local URL printed by Vite. Publish the **contents of `dist/`** on a static
host. Vite uses `base: './'`, navigation uses hashes, and images and scripts use
relative URLs, so the export works under a gateway subpath without route rewrites.
Use HTTP(S) to preview it; browser module and wallet policies do not support
opening `index.html` as a `file://` page.

The browser checks start and stop their own server under `/preview/`. They use
isolated RPC and EIP-6963 fixtures and never sign or send real transactions:

```sh
npx playwright install --with-deps chromium webkit
npm run test:browser
node scripts/check-export.mjs
```

The interaction runner writes screenshots and JSON results to `test/scratch/`.
WebKit unavailability is recorded explicitly; it is never counted as a pass.
The pinned design probe, when the assignment inputs are available, is:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

## What is implemented

- **Create:** three steps for token identity/base, supply allocation/taxes, and
  review. Deploy and launch atomically with `createAndLaunchAtPrice`, or deploy
  only with `create`. Supply has 18 decimals; creator retention is 0–20%.
- **Preview:** immediate local allocation/fee illustration, then verified
  contract previews. Prices use the selected base's live decimals. Non-native
  launches check both possible new-token address orderings and display the
  resulting effective price or range. Extra decimal places are rejected.
- **Discover:** factory `TokenCreated` events, batches of 24 token reads, older
  block pagination, status filters, name/symbol search and direct address lookup.
  The interface labels the scanned range and partial reads. There is no seeded
  token list, fabricated volume, price feed or cached sample market data.
- **Token details:** block-stamped buy/sell tax, resting/decay fee split, recipients
  and permissions. Reads refresh every 15 seconds while active; failed or old
  readings are marked stale. The next-step timing is relative to the fetched
  block, not an invented live countdown.
- **Manage:** owner-only launch of previously deployed tokens, independent fee
  recipients, resting tax, local distributors, shared registry participation,
  external liquidity and pairing permissions. The current owner is reread before
  a write. Active decay locks tax editing; only ETH-paired tokens can enable new
  pairings.
- **Wallets:** EIP-6963 browser discovery, MetaMask/Coinbase/Rabby/Phantom mobile
  app links and Coinbase Smart Wallet. One header control handles connect,
  network switch and disconnect. No relay or project ID is used.
- **Transactions:** mainnet/infrastructure checks, fresh base or owner checks (including changed decimals),
  simulation, wallet confirmation, pending receipt, rejection/error/retry and
  confirmed-state links. All creation/launch requests send zero base value.
  Recipient defaults resolve to the connected wallet; a zero address is never
  used as an owner or recipient fallback.

The supplied hook supports exact-input swaps. This application exposes launch
and management transactions, not a swap router. The protocol guide and token
pages explain swap and transfer restrictions. The initial liquidity position is
permanently locked; external liquidity permission does not unlock it.

## Configuration and research

Mainnet addresses, public RPC transports and base-picker entries live in
[`src/config.ts`](src/config.ts). The three complete verified ABIs are in
[`src/contracts/`](src/contracts). The factory deployment block is sourced from
Sourcify, not guessed. See [`docs/CONTRACTS.md`](docs/CONTRACTS.md) and the
machine-readable [provenance record](docs/contract-provenance.json) for sources,
configuration semantics and research limitations.

ETH's zero currency address is the documented Uniswap native-currency sentinel.
IMD/FWA addresses come from the hook constructor. Picker labels are not used as
evidence of decimals or eligibility: both are checked from contracts before a
deployment. Fee destinations are entered by the visitor or taken from their
connected wallet. There are no private keys or owner credentials in the app.

Changing chain addresses requires researching the new deployment and refreshing
the ABIs and tests. Do not point these ABIs at an unrelated token. `readToken`
checks the supplied implementation's 145-byte clone runtime and shared hook.

## Validation and limits

Actual command results, browser coverage, fixed findings, measured design checks
and the final artifact footprint are recorded in
[`docs/VALIDATION.md`](docs/VALIDATION.md). The implemented visual system is in
[`DESIGN.md`](DESIGN.md).

During this task, direct public Ethereum RPC requests were refused with HTTP 403.
Contract source/ABI research succeeded through Sourcify and Blockscout. Production
wallet and chain flows were therefore validated with isolated browser fixtures;
no funded mainnet transaction, physical mobile-wallet launch or Coinbase passkey
session was performed. The production app still uses real public RPCs, displays
errors when unavailable, and requires wallet approval for every write. The public
RPCs can have availability and historical-log limits.

Draft form state lasts for the current Create page visit. Wallet reconnection uses
wagmi's local browser storage. There is no backend, analytics, token price oracle,
or external-liquidity deposit interface. The owner control changes permission;
it does not deposit liquidity.

## Assets and attribution

The share card's editable vector is [`assets/share.svg`](assets/share.svg); its
1200×630 PNG is bundled in `public/`. The favicon and wallet marks are local.
Typography uses the system Arial/Helvetica stack and system monospace for data.
There are no remotely fetched fonts or marketing images.

The layout takes visual cues from [TokenWorks](https://www.token.works/) and
[S02](https://www.s02.works/), without copying their assets. Better Interface and
Impeccable design/documentation attribution is preserved in
[`docs/ATTRIBUTION.md`](docs/ATTRIBUTION.md) and
[`docs/DESIGN-LICENSES.txt`](docs/DESIGN-LICENSES.txt). Wallet marks are from
RainbowKit, with its [MIT notice](docs/WALLET-LICENSE.txt).

Generated dependencies, caches and browser scratch files are ignored at every
nesting level. `dist/` is intentionally included. The explicit `.gitignore`
budget and complete 8 MiB submission ceiling are documented in
[`BUDGET.md`](BUDGET.md).
