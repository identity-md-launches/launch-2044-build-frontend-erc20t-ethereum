# Contract integration research

Research performed 2026-10-17 against Ethereum mainnet (chain ID 1). The three
addresses in the assignment are used exactly. Sourcify returned matching creation
and runtime verification records for each; Blockscout independently returned
verified source and ABI. Etherscan's direct automated reads were refused, so it
was not the primary ABI source. Full ABI exports live in `src/contracts/`.

| Role                 | Address                                      | Verified source / ABI                                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared hook          | `0xed9a04fa6693e754661a22502524df9b1857e544` | [Sourcify](https://sourcify.dev/server/v2/contract/1/0xed9a04fa6693e754661a22502524df9b1857e544?fields=abi,metadata,sources,creationMatch,runtimeMatch), [Blockscout](https://eth.blockscout.com/api/v2/smart-contracts/0xed9a04fa6693e754661a22502524df9b1857e544) |
| Factory              | `0x801411c6acec4fa80c75c5d3c0eae13c84f8a173` | [Sourcify](https://sourcify.dev/server/v2/contract/1/0x801411c6acec4fa80c75c5d3c0eae13c84f8a173?fields=abi,metadata,sources,creationMatch,runtimeMatch), [Blockscout](https://eth.blockscout.com/api/v2/smart-contracts/0x801411c6acec4fa80c75c5d3c0eae13c84f8a173) |
| Token implementation | `0x2df7dcf4d19a7924e00ae96629cc1d1261670eee` | [Sourcify](https://sourcify.dev/server/v2/contract/1/0x2df7dcf4d19a7924e00ae96629cc1d1261670eee?fields=abi,metadata,sources,creationMatch,runtimeMatch), [Blockscout](https://eth.blockscout.com/api/v2/smart-contracts/0x2df7dcf4d19a7924e00ae96629cc1d1261670eee) |

[`contract-provenance.json`](contract-provenance.json) records source and ABI
SHA-256 hashes, URLs and returned verification states. ABI hashes are over compact
JSON serialization, independent of TypeScript formatting. Verification is source
provenance, not a security audit.

## Infrastructure

The factory [deployment record](https://sourcify.dev/server/v2/contract/1/0x801411c6acec4fa80c75c5d3c0eae13c84f8a173?fields=deployment)
gives block **26,208,074**, transaction
`0xdf27d0960e641cfa4b2715a27a37860c022592484feab22ff53977e242ccfd5a`.
Discovery never scans before that block.

The [official Uniswap v4 Ethereum deployment list](https://developers.uniswap.org/docs/protocols/v4/deployments#ethereum-1)
supplies PoolManager `0x000000000004444c5dc75cb358380d2e3de08a90`,
PositionManager `0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e`, and Permit2
`0x000000000022d473030f116ddee9f6b43ac78ba3`. The hook constructor independently
names that PoolManager. `verifyInfrastructure()` compares factory implementation
and hook PoolManager at review and before sending. Initialization itself verifies
the PositionManager's PoolManager and Permit2.

The verified hook constructor registers these external bases:

| Picker | Address                                      | Constructor ETH conversion pool                                          |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------ |
| IMD    | `0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7` | fee 10000, spacing 60, hook `0xc6c965bd164c483e87d0b550671798e9a3602840` |
| FWA    | `0xa0df17b5ac76ababa36e1450e2cbcd18a620c845` | fee 0, spacing 60, hook `0x2c67eba8a50af0db5fba55f725247a75cbda6444`     |

These are deployment registrations, not a claim that either permission remains
enabled. `eligibleBase` reads `externalBases`, `symbol` and `decimals` at review
and rechecks eligibility before a write. The IMD base has mutable metadata in its
[verified BridgedFP source](https://sourcify.dev/server/v2/contract/1/0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7?fields=abi,sources);
the picker retains the brief's IMD label, while review displays the returned
symbol. FWA's name/address is also visible in its
[verified token contract](https://etherscan.io/address/0xa0df17b5ac76ababa36e1450e2cbcd18a620c845#code).

## Factory and price mapping

The verified `ERC20T.Config` tuple contains, in order: `name`, `symbol`, `supply`,
`lpSupply`, `owner`, `hook`, `quoteToken`, `positionManager`, `permit2`, `taxBps`,
`feeRecipient`, `launchTaxBps`, `taxDecayIntervalSeconds`, `feeDecayRecipient`.

| UI action             | Contract method                                                                    | Mapping                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Deploy & launch       | Factory `createAndLaunchAtPrice(config, creatorAllocationBps, startingPriceQuote)` | Supply in 18-decimal units; retention in basis points; price in quote base units per whole new token; value 0 |
| Deploy first          | Factory `create(config)`                                                           | `lpSupply = supply − floor(supply × retentionBps / 10000)`; owner is connected account                        |
| Review price          | Factory `previewQuotedLaunch(supply, retentionBps, price, tokenIsCurrency0)`       | Native ETH uses false. For non-native atomic deployment, evaluate both orderings                              |
| Launch deployed token | Token `launch(sqrtPriceX96, tickLower, tickUpper)`                                 | Read reserved token balance and actual address ordering; obtain parameters from factory preview; value 0      |

The factory computes a tick-aligned price at least as high as the request. Its
`effectivePriceWei` field is in **quote base units**, including for ERC-20 bases.
The UI uses integer parsing and rejects excessive precision instead of letting
`parseUnits` round it. Creator allocation is bounded at 2000 bps, and LP supply
must fit `uint128`. The factory owns an atomic launch temporarily and transfers
ownership and retained supply to the chosen owner. It emits `TokenCreated` and
`TokenLaunched`; the interface decodes the confirmed receipt to obtain the token.

## Tax and fee semantics

The token source defines minimum/maximum resting tax as 30/500 bps, launch tax
as 9900 bps and each completed interval as a 100-bps drop. Decay is disabled only
when both launch rate and interval are zero. Otherwise it begins at 99%, with a
nonzero `uint32` interval. Completion uses `ceil((9900 − resting) / 100)`, so a
fractional resting rate is reached by clamping the final step. The timer starts
at `launchedAt`, not token deployment. `setTaxBps` reverts during active decay.

`taxBps()` is the authoritative current rate. The hook taxes swap **output** and
rejects exact output (`amountSpecified >= 0`). It converts collected fees to ETH
and allocates the included 15 bps to the protocol, `resting − 15` to the regular
recipient and `current − resting` to the decay recipient, subject to conversion
rounding. External conversion pools retain their own fees and behavior. This
frontend does not estimate swap outputs or implement a router.

## Ownership, liquidity and transfers

- `setFeeRecipient` and `setFeeDecayRecipient` are independent. The UI always
  resolves valid recipients explicitly, even though the contract permits a zero
  decay-recipient initializer as a defaulting sentinel.
- `setDistributors(address[],bool)` controls local trusted contracts. The UI
  checks both `isLocalDistributor` and effective `isDistributor` and supports
  additions and removals. Real simulation enforces the contract-code requirement.
- `setUseGlobalDistributors(bool)` opts into the hook owner's distributor registry.
- `setExternalLiquidityEnabled(bool)` permits additions to the canonical pool.
  It never unlocks the initial position or disables withdrawals from existing
  external positions.
- `setPairingEnabled(bool)` is allowed only for an ETH-paired token. Disabling it
  prevents new child pools; existing pools remain usable.
- The token launches a position held permanently at the contract-defined burn
  destination. The frontend does not accept an LP recipient or unlock option.
- Ordinary direct EOA-to-EOA transfers are untaxed. Other transfers are restricted
  with owner/distributor exceptions. Smart accounts, delegated accounts and
  contract-mediated transfers do not automatically qualify for the ordinary-wallet
  exception. PoolManager transfers are checked before those exceptions.

Token lookup validates the full 145-byte Solady clone runtime prefix against the
supplied implementation and reads its shared hook. This frontend deliberately
manages this deployment's clones, not arbitrary ERC-20 contracts.

## Wallet integration references

The pinned network wallet guide was applied with [wagmi connectors](https://wagmi.sh/react/api/connectors),
EIP-6963 discovery and [Coinbase Wallet](https://wagmi.sh/react/api/connectors/coinbaseWallet).
App links follow the pinned MetaMask, Coinbase and Phantom forms. Rabby's current
[universal-link handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts)
expects `_cmd=open-dapp&dapp=<encoded URL>` under `https://go.rabby.io/mobile/`.
No wallet deep link was physically opened during this run.

## Verification limits

Direct public RPC calls to PublicNode, LlamaRPC, dRPC and Blockscout's RPC endpoint
returned HTTP 403 in this run. A live factory-state comparison, real preview
`eth_call`, funded transaction, and fork execution were not completed. The
production client performs those checks at runtime; fixture tests establish UI,
ABI encoding and state handling, not mainnet transaction success. Verified source
downloads succeeded independently of the RPC restrictions.
