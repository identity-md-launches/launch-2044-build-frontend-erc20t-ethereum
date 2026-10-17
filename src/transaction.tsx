import { useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { decodeEventLog, type Hash, type TransactionReceipt } from "viem";
import { publicClient, CONTRACTS } from "./config";
import { factoryAbi } from "./contracts/factory";
import { friendlyError, addressEqual } from "./model";
import { type TransactionRequest, verifyInfrastructure } from "./chain";
import { ErrorNote, Icon } from "./ui";

export function useTransaction() {
  const { address, chainId } = useAccount();
  const { data: wallet } = useWalletClient();
  const [phase, setPhase] = useState<
    "idle" | "checking" | "wallet" | "pending" | "success" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [hash, setHash] = useState<Hash>();
  const [receipt, setReceipt] = useState<TransactionReceipt>();
  const replacedWithOtherOperation = useRef(false);
  async function send(
    request: TransactionRequest,
    preflight?: () => Promise<unknown>,
  ) {
    if (!address || !wallet || chainId !== 1) {
      setError("Connect a wallet on Ethereum mainnet to continue.");
      setPhase("error");
      return;
    }
    setError("");
    setReceipt(undefined);
    setHash(undefined);
    setPhase("checking");
    replacedWithOtherOperation.current = false;
    try {
      await verifyInfrastructure();
      if (preflight) await preflight();
      if ((await wallet.getChainId()) !== 1)
        throw new Error("Switch your wallet to Ethereum mainnet.");
      const simulation = await publicClient.simulateContract({
        ...request,
        account: address,
      });
      setPhase("wallet");
      const tx = await wallet.writeContract({
        ...simulation.request,
        chain: wallet.chain,
        account: address,
      });
      setHash(tx);
      setPhase("pending");
      const result = await publicClient.waitForTransactionReceipt({
        hash: tx,
        confirmations: 1,
        timeout: 180_000,
        onReplaced: (replacement) => {
          setHash(replacement.transaction.hash);
          if (replacement.reason !== "repriced")
            replacedWithOtherOperation.current = true;
        },
      });
      if (replacedWithOtherOperation.current)
        throw new Error(
          "This transaction was cancelled or replaced with another operation. View the replacement on Etherscan.",
        );
      if (result.status !== "success")
        throw new Error(
          "The transaction reverted. Check its details before trying again.",
        );
      setReceipt(result);
      setPhase("success");
      return result;
    } catch (e) {
      setError(friendlyError(e));
      setPhase("error");
    }
  }
  async function checkReceipt() {
    if (!hash) return;
    if (replacedWithOtherOperation.current) {
      setError(
        "The replacement is a different operation. Review it on Etherscan; this action was not confirmed.",
      );
      return;
    }
    setError("");
    setPhase("pending");
    try {
      const result = await publicClient.getTransactionReceipt({ hash });
      if (result.status !== "success")
        throw new Error(
          "The transaction reverted. View its details on Etherscan.",
        );
      setReceipt(result);
      setPhase("success");
    } catch (e) {
      setError(friendlyError(e));
      setPhase("error");
    }
  }
  const busy = ["checking", "wallet", "pending"].includes(phase);
  return {
    send,
    phase,
    error,
    hash,
    receipt,
    busy,
    checkReceipt,
    reset: () => {
      setPhase("idle");
      setError("");
      setHash(undefined);
      setReceipt(undefined);
      replacedWithOtherOperation.current = false;
    },
  };
}
export type TransactionState = ReturnType<typeof useTransaction>;
export function TransactionStatus({ tx }: { tx: TransactionState }) {
  return (
    <div className="transaction-status">
      <div role="status">
        {tx.phase === "checking" && "Checking the transaction on Ethereum…"}
        {tx.phase === "wallet" && "Review and confirm in your wallet."}
        {tx.phase === "pending" &&
          "Transaction sent. Waiting for confirmation…"}
        {tx.phase === "success" && (
          <span className="success-text">
            <Icon name="check" /> Confirmed on Ethereum
          </span>
        )}
      </div>
      {tx.error && (
        <ErrorNote>
          {tx.error}
          {tx.hash && (
            <>
              <p>
                The transaction was already sent. Check its receipt before
                sending another.
              </p>
              <button className="text-button" onClick={tx.checkReceipt}>
                Check confirmation
              </button>
            </>
          )}
        </ErrorNote>
      )}
      {tx.hash && (
        <a
          className="text-link break-all"
          href={`https://etherscan.io/tx/${tx.hash}`}
          target="_blank"
          rel="noreferrer"
        >
          View transaction <Icon name="external" size={14} />
        </a>
      )}
    </div>
  );
}
export function createdToken(receipt?: TransactionReceipt) {
  if (!receipt) return;
  for (const log of receipt.logs) {
    if (!addressEqual(log.address, CONTRACTS.factory)) continue;
    try {
      const decoded = decodeEventLog({
        abi: factoryAbi,
        eventName: "TokenCreated",
        data: log.data,
        topics: log.topics,
      });
      return decoded.args.token;
    } catch {
      /* Other factory event. */
    }
  }
}
