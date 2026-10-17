import {
  isAddress,
  getAddress,
  parseUnits,
  zeroAddress,
  type Address,
} from "viem";

export type Draft = {
  name: string;
  symbol: string;
  supply: string;
  base: string;
  customBase: string;
  price: string;
  allocation: string;
  tax: string;
  decay: boolean;
  interval: string;
  recipient: string;
  decayRecipient: string;
  mode: "launch" | "deploy";
};
export const initialDraft: Draft = {
  name: "",
  symbol: "",
  supply: "1000000000",
  base: "ETH",
  customBase: "",
  price: "0.000000001",
  allocation: "0",
  tax: "1",
  decay: false,
  interval: "60",
  recipient: "",
  decayRecipient: "",
  mode: "launch",
};
export const UINT128_MAX = (1n << 128n) - 1n;
export function exactUnits(value: string, decimals: number): bigint {
  if (
    !/^\d+(\.\d+)?$/.test(value) ||
    (value.split(".")[1]?.length ?? 0) > decimals
  )
    throw new Error(
      `Enter a positive number with at most ${decimals} decimals.`,
    );
  const result = parseUnits(value, decimals);
  if (result <= 0n) throw new Error("Enter an amount greater than zero.");
  return result;
}
export function validRecipient(value: string): value is Address {
  return (
    isAddress(value) &&
    value.toLowerCase() !== zeroAddress &&
    !/^0x0{36}dead$/i.test(value)
  );
}
export function percentBps(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Use at most two decimal places.");
  return Math.round(Number(value) * 100);
}
export function allocationFor(supply: bigint, bps: number) {
  if (supply <= 0n) throw new Error("Supply must be greater than zero.");
  if (!Number.isInteger(bps) || bps < 0 || bps > 2000)
    throw new Error("Keep between 0% and 20% of supply.");
  const creatorSupply = (supply * BigInt(bps)) / 10_000n;
  const lpSupply = supply - creatorSupply;
  if (lpSupply > UINT128_MAX || lpSupply === 0n)
    throw new Error("Supply exceeds the launch contract’s supported range.");
  return { creatorSupply, lpSupply };
}
export function decayRate(resting: number, interval: number, elapsed: number) {
  return Math.max(
    resting,
    9900 - Math.floor(Math.max(0, elapsed) / interval) * 100,
  );
}
export function decayDuration(resting: number, interval: number) {
  return Math.ceil((9900 - resting) / 100) * interval;
}
export function feeSplit(resting: number, current: number) {
  return {
    protocol: 15,
    regular: resting - 15,
    decay: Math.max(0, current - resting),
  };
}
export function validateDraft(draft: Draft, step: number, account?: Address) {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = "Enter a token name.";
  if (!draft.symbol.trim()) errors.symbol = "Enter a symbol.";
  try {
    const supply = exactUnits(draft.supply, 18);
    const bps = /^\d+(\.\d{1,2})?$/.test(draft.allocation)
      ? Math.round(Number(draft.allocation) * 100)
      : -1;
    if (bps >= 0 && bps <= 2000) allocationFor(supply, bps);
  } catch (e) {
    errors.supply = (e as Error).message;
  }
  if (draft.base === "Other" && !validRecipient(draft.customBase))
    errors.customBase = "Enter the eligible base token’s Ethereum address.";
  if (step > 0) {
    try {
      const bps = percentBps(draft.tax);
      if (bps < 30 || bps > 500) throw Error();
    } catch {
      errors.tax =
        "Set a resting tax from 0.3% to 5%, with at most two decimals.";
    }
    try {
      const bps = percentBps(draft.allocation);
      if (bps > 2000) throw Error();
    } catch {
      errors.allocation = "Keep between 0% and 20%, with at most two decimals.";
    }
    if (
      draft.mode === "launch" &&
      (!/^\d+(\.\d+)?$/.test(draft.price) || Number(draft.price) <= 0)
    )
      errors.price = "Enter a starting price greater than zero.";
    if (
      draft.decay &&
      (!/^\d+$/.test(draft.interval) ||
        Number(draft.interval) < 1 ||
        Number(draft.interval) > 4294967295)
    )
      errors.interval = "Enter an interval from 1 to 4,294,967,295 seconds.";
    for (const field of ["recipient", "decayRecipient"] as const) {
      if (field === "decayRecipient" && !draft.decay) continue;
      if (draft[field] && !validRecipient(draft[field]))
        errors[field] = "Enter a valid, nonzero Ethereum recipient address.";
      if (!draft[field] && step === 2 && !account)
        errors[field] =
          "Connect a wallet to use its address, or enter a recipient.";
    }
  }
  return errors;
}
export const addressEqual = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();
export const checkedAddress = (value: string) => {
  if (!validRecipient(value))
    throw new Error("Enter a valid, nonzero Ethereum address.");
  return getAddress(value);
};
export function friendlyError(error: unknown) {
  const e = error as { shortMessage?: string; message?: string; name?: string };
  const message =
    e.shortMessage ?? e.message ?? "The request could not be completed.";
  if (/reject|denied/i.test(message))
    return "Request declined in your wallet. You can try again.";
  if (/fetch|http|network|timed? ?out|403|429/i.test(message))
    return "Ethereum could not be reached. Check your connection and try again.";
  return message.length > 280 ? message.slice(0, 277) + "…" : message;
}
export const compact = (number: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(number);
export const exactDisplay = (value: string) => {
  const [integer, fraction] = value.split(".");
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction ? `.${fraction}` : "")
  );
};
export const duration = (seconds: number) =>
  seconds >= 3600
    ? `${Number((seconds / 3600).toFixed(2))} hours`
    : seconds >= 60
      ? `${Number((seconds / 60).toFixed(2))} minutes`
      : `${seconds} seconds`;
