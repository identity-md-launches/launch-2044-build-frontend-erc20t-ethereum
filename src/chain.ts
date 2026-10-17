import {
  erc20Abi,
  getAddress,
  zeroAddress,
  type Address,
  type Abi,
} from "viem";
import { CONTRACTS, FACTORY_BLOCK, BASES, publicClient } from "./config";
import { tokenAbi } from "./contracts/token";
import { factoryAbi } from "./contracts/factory";
import { hookAbi } from "./contracts/hook";
import {
  allocationFor,
  exactUnits,
  percentBps,
  checkedAddress,
  addressEqual,
  type Draft,
} from "./model";

export type BaseInfo = {
  address: Address;
  symbol: string;
  decimals: number;
  kind: "native" | "external" | "erc20t";
};
export async function eligibleBase(address: Address): Promise<BaseInfo> {
  if (addressEqual(address, zeroAddress))
    return { address, symbol: "ETH", decimals: 18, kind: "native" };
  const [symbol, decimals, external] = await Promise.all([
    publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: "symbol",
    }),
    publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: CONTRACTS.hook,
      abi: hookAbi,
      functionName: "externalBases",
      args: [address],
    }),
  ]);
  if (external[0]) {
    if (!external[1])
      throw new Error(
        "This external base is disabled for new launches. Choose another base.",
      );
    return { address, symbol, decimals, kind: "external" };
  }
  const [hook, quote, pairing, initialized] = await Promise.all([
    publicClient.readContract({ address, abi: tokenAbi, functionName: "hook" }),
    publicClient.readContract({
      address,
      abi: tokenAbi,
      functionName: "quoteToken",
    }),
    publicClient.readContract({
      address,
      abi: tokenAbi,
      functionName: "pairingEnabled",
    }),
    publicClient.readContract({
      address: CONTRACTS.hook,
      abi: hookAbi,
      functionName: "poolInitialized",
      args: [address],
    }),
  ]);
  if (
    !addressEqual(hook, CONTRACTS.hook) ||
    quote !== zeroAddress ||
    !pairing ||
    !initialized
  )
    throw new Error(
      "This base needs an ETH pool on the shared hook and pairing permission. Choose an eligible base.",
    );
  return { address, symbol, decimals, kind: "erc20t" };
}
export type LaunchPreview = {
  creatorSupply: bigint;
  lpSupply: bigint;
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  effectivePriceWei: bigint;
};
export async function quotedPreview(
  supply: bigint,
  bps: number,
  price: bigint,
  tokenIsCurrency0: boolean,
): Promise<LaunchPreview> {
  return publicClient.readContract({
    address: CONTRACTS.factory,
    abi: factoryAbi,
    functionName: "previewQuotedLaunch",
    args: [supply, bps, price, tokenIsCurrency0],
  });
}
export async function verifyInfrastructure() {
  const [impl, manager] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.factory,
      abi: factoryAbi,
      functionName: "implementation",
    }),
    publicClient.readContract({
      address: CONTRACTS.hook,
      abi: hookAbi,
      functionName: "poolManager",
    }),
  ]);
  if (
    !addressEqual(impl, CONTRACTS.implementation) ||
    !addressEqual(manager, CONTRACTS.poolManager)
  )
    throw new Error(
      "Contract infrastructure does not match this application. Transaction stopped.",
    );
}
export function baseAddress(draft: Draft): Address {
  return draft.base === "Other"
    ? checkedAddress(draft.customBase)
    : BASES.find((b) => b.symbol === draft.base)!.address;
}
export function deploymentConfig(draft: Draft, owner: Address, base: Address) {
  const supply = exactUnits(draft.supply, 18);
  const { lpSupply } = allocationFor(supply, percentBps(draft.allocation));
  return {
    name: draft.name.trim(),
    symbol: draft.symbol.trim(),
    supply,
    lpSupply,
    owner,
    hook: CONTRACTS.hook,
    quoteToken: base,
    positionManager: CONTRACTS.positionManager,
    permit2: CONTRACTS.permit2,
    taxBps: percentBps(draft.tax),
    feeRecipient: draft.recipient ? checkedAddress(draft.recipient) : owner,
    launchTaxBps: draft.decay ? 9900 : 0,
    taxDecayIntervalSeconds: draft.decay ? Number(draft.interval) : 0,
    feeDecayRecipient:
      draft.decay && draft.decayRecipient
        ? checkedAddress(draft.decayRecipient)
        : draft.recipient
          ? checkedAddress(draft.recipient)
          : owner,
  };
}
export type TokenInfo = {
  address: Address;
  name: string;
  symbol: string;
  supply: bigint;
  owner: Address;
  quote: Address;
  launched: boolean;
  launchedAt: bigint;
  tax: number;
  resting: number;
  interval: number;
  decay: boolean;
  feeRecipient: Address;
  decayRecipient: Address;
  pairing: boolean;
  externalLiquidity: boolean;
  globalDistributors: boolean;
  reserve: bigint;
  block: bigint;
  timestamp: bigint;
};
export async function readToken(address: Address): Promise<TokenInfo> {
  const block = await publicClient.getBlock();
  const names = [
    "name",
    "symbol",
    "totalSupply",
    "owner",
    "quoteToken",
    "launched",
    "launchedAt",
    "taxBps",
    "restingTaxBps",
    "taxDecayIntervalSeconds",
    "taxDecayActive",
    "feeRecipient",
    "feeDecayRecipient",
    "pairingEnabled",
    "externalLiquidityEnabled",
    "useGlobalDistributors",
    "hook",
  ] as const;
  const [values, reserve, code] = await Promise.all([
    publicClient.multicall({
      contracts: names.map((functionName) => ({
        address,
        abi: tokenAbi,
        functionName,
      })),
      allowFailure: false,
      blockNumber: block.number,
    }),
    publicClient.readContract({
      address,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [address],
      blockNumber: block.number,
    }),
    publicClient.getCode({ address, blockNumber: block.number }),
  ]);
  const cloneRuntime = `0x363d3d373d3d3d363d73${CONTRACTS.implementation.slice(2).toLowerCase()}5af43d82803e903d91602b57fd5bf3`;
  if (
    !addressEqual(values[16] as string, CONTRACTS.hook) ||
    code?.length !== 292 ||
    !code.toLowerCase().startsWith(cloneRuntime)
  )
    throw new Error(
      "This address is not an ERC20T clone using the supplied implementation and hook.",
    );
  return {
    address,
    name: values[0] as string,
    symbol: values[1] as string,
    supply: values[2] as bigint,
    owner: values[3] as Address,
    quote: values[4] as Address,
    launched: values[5] as boolean,
    launchedAt: values[6] as bigint,
    tax: values[7] as number,
    resting: values[8] as number,
    interval: values[9] as number,
    decay: values[10] as boolean,
    feeRecipient: values[11] as Address,
    decayRecipient: values[12] as Address,
    pairing: values[13] as boolean,
    externalLiquidity: values[14] as boolean,
    globalDistributors: values[15] as boolean,
    reserve,
    block: block.number,
    timestamp: block.timestamp,
  };
}
export async function discoverTokens(toBlock?: bigint) {
  const latest = toBlock ?? (await publicClient.getBlockNumber());
  const from = latest - 9999n > FACTORY_BLOCK ? latest - 9999n : FACTORY_BLOCK;
  if (latest < FACTORY_BLOCK)
    throw new Error(
      "The RPC node is behind the factory deployment. Try again later.",
    );
  const logs = await publicClient.getContractEvents({
    address: CONTRACTS.factory,
    abi: factoryAbi,
    eventName: "TokenCreated",
    fromBlock: from,
    toBlock: latest,
  });
  const addresses = [
    ...new Set(
      logs
        .reverse()
        .map((l) => l.args.token)
        .filter((a): a is Address => Boolean(a)),
    ),
  ];
  const tokens = await Promise.allSettled(
    addresses.slice(0, 24).map(readToken),
  );
  return {
    tokens: tokens.flatMap((t) => (t.status === "fulfilled" ? [t.value] : [])),
    failed: tokens.filter((t) => t.status === "rejected").length,
    from,
    to: latest,
    older: from > FACTORY_BLOCK ? from - 1n : undefined,
    remainingAddresses: addresses.slice(24),
  };
}
export type TransactionRequest = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};
