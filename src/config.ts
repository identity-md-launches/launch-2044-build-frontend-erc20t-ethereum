import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { createPublicClient, fallback, getAddress, zeroAddress } from "viem";
import { mainnet } from "viem/chains";

export const CONTRACTS = {
  hook: getAddress("0xed9a04fa6693e754661a22502524df9b1857e544"),
  factory: getAddress("0x801411c6acec4fa80c75c5d3c0eae13c84f8a173"),
  implementation: getAddress("0x2df7dcf4d19a7924e00ae96629cc1d1261670eee"),
  poolManager: getAddress("0x000000000004444c5dc75cb358380d2e3de08a90"),
  positionManager: getAddress("0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e"),
  permit2: getAddress("0x000000000022d473030f116ddee9f6b43ac78ba3"),
} as const;
export const FACTORY_BLOCK = 26208074n;
// Uniswap represents native ETH with zeroAddress; this is not a recipient placeholder.
// Symbols here are picker labels. Every ERC-20 symbol/decimal count is reread at review.
export const BASES = [
  { symbol: "ETH", name: "Ether", address: zeroAddress, decimals: 18 },
  {
    symbol: "IMD",
    name: "IdentityMD",
    address: getAddress("0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7"),
    decimals: 18,
  },
  {
    symbol: "FWA",
    name: "Fake World Assets",
    address: getAddress("0xa0df17b5ac76ababa36e1450e2cbcd18a620c845"),
    decimals: 18,
  },
] as const;
export const RPC_URLS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.drpc.org",
];
const transport = () =>
  fallback(
    RPC_URLS.map((url) => http(url, { timeout: 7_000, retryCount: 0 })),
    { retryCount: 0 },
  );
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: transport(),
  batch: { multicall: true },
});
export const walletConfig = createConfig({
  chains: [mainnet],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "ERC20T",
      appLogoUrl:
        typeof document === "undefined"
          ? undefined
          : new URL("favicon.svg", document.baseURI).href,
    }),
  ],
  transports: { [mainnet.id]: transport() },
});
export const explorer = (address: string) =>
  `https://etherscan.io/address/${address}`;
export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
