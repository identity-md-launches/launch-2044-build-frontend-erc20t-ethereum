import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import {
  getAddress,
  isAddress,
  zeroAddress,
  formatUnits,
  type Address,
} from "viem";
import {
  readToken,
  eligibleBase,
  quotedPreview,
  type TransactionRequest,
} from "./chain";
import { tokenAbi } from "./contracts/token";
import { CONTRACTS, publicClient, BASES } from "./config";
import {
  checkedAddress,
  exactUnits,
  percentBps,
  addressEqual,
  friendlyError,
} from "./model";
import { AddressLink, ErrorNote, Field, Icon, Modal, Toggle } from "./ui";
import { TransactionStatus, useTransaction } from "./transaction";
import { TokenMark } from "./Launch";

type Change = {
  title: string;
  explanation: string;
  request: TransactionRequest;
  launch?: boolean;
  quotedDecimals?: number;
};
export default function Manage({
  initialAddress = "",
  connect,
}: {
  initialAddress?: string;
  connect: () => void;
}) {
  const [lookup, setLookup] = useState(initialAddress);
  const [selected, setSelected] = useState(initialAddress);
  const [error, setError] = useState("");
  const [recipient, setRecipient] = useState("");
  const [decayRecipient, setDecayRecipient] = useState("");
  const [tax, setTax] = useState("");
  const [accounts, setAccounts] = useState("");
  const [distributorStatus, setDistributorStatus] = useState("");
  const [price, setPrice] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [change, setChange] = useState<Change>();
  const { address, chainId } = useAccount();
  const tx = useTransaction();
  const query = useQuery({
    queryKey: ["manage", selected],
    queryFn: () => readToken(getAddress(selected)),
    enabled: isAddress(selected),
    staleTime: 15_000,
  });
  const token = query.data;
  const owner = !!token && !!address && addressEqual(token.owner, address);
  const ready = owner && chainId === 1 && !tx.busy;
  useEffect(() => {
    if (token) {
      setRecipient(token.feeRecipient);
      setDecayRecipient(token.decayRecipient);
      setTax(String(token.resting / 100));
    }
  }, [
    token?.address,
    token?.feeRecipient,
    token?.decayRecipient,
    token?.resting,
  ]);
  function load(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isAddress(lookup)) {
      setError("Enter the full Ethereum address of your ERC20T token.");
      return;
    }
    if (selected.toLowerCase() === lookup.toLowerCase()) void query.refetch();
    else setSelected(getAddress(lookup));
  }
  function review(
    title: string,
    explanation: string,
    functionName: string,
    args: readonly unknown[],
  ) {
    if (!token) return;
    setError("");
    tx.reset();
    setChange({
      title,
      explanation,
      request: { address: token.address, abi: tokenAbi, functionName, args },
    });
  }
  function feeChange(decay: boolean) {
    try {
      const next = checkedAddress(decay ? decayRecipient : recipient);
      if (
        [
          token!.address,
          CONTRACTS.hook,
          CONTRACTS.poolManager,
          CONTRACTS.factory,
        ].some((a) => addressEqual(a, next))
      )
        throw new Error(
          "Use a recipient other than the token or protocol infrastructure.",
        );
      review(
        decay ? "Change decay recipient" : "Change regular recipient",
        `Future ${decay ? "above-resting launch" : "regular"} fees will be sent in ETH to ${next}. The other recipient stays unchanged.`,
        decay ? "setFeeDecayRecipient" : "setFeeRecipient",
        [next],
      );
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  function taxChange() {
    try {
      const bps = percentBps(tax);
      if (bps < 30 || bps > 500) throw Error("Choose a tax from 0.3% to 5%.");
      review(
        "Change resting tax",
        `Set the resting buy and sell tax to ${tax}%, including the 0.15% protocol component.`,
        "setTaxBps",
        [bps],
      );
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  const parseAccounts = () => {
    const list = accounts
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(checkedAddress);
    if (!list.length)
      throw new Error("Enter at least one distributor contract address.");
    if (list.length > 30)
      throw new Error("Update at most 30 distributors at a time.");
    return [...new Set(list)];
  };
  function distributorChange(allowed: boolean) {
    try {
      const list = parseAccounts();
      review(
        allowed ? "Approve distributors" : "Remove distributors",
        `${allowed ? "Allow" : "Remove local permission for"} these contracts: ${list.join(", ")}. Approved distributors can transfer to or from any wallet. Only approve trusted code.`,
        "setDistributors",
        [list, allowed],
      );
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  async function checkDistributors() {
    if (!token) return;
    setError("");
    setDistributorStatus("Checking permissions…");
    try {
      const list = parseAccounts();
      const statuses = await Promise.all(
        list.map(async (account) => {
          const [local, effective] = await Promise.all([
            publicClient.readContract({
              address: token.address,
              abi: tokenAbi,
              functionName: "isLocalDistributor",
              args: [account],
            }),
            publicClient.readContract({
              address: token.address,
              abi: tokenAbi,
              functionName: "isDistributor",
              args: [account],
            }),
          ]);
          return `${account}: ${local ? "locally approved" : effective ? "approved by the shared registry" : "not approved"}`;
        }),
      );
      setDistributorStatus(statuses.join("\n"));
    } catch (e) {
      setDistributorStatus("");
      setError(friendlyError(e));
    }
  }
  async function prepareLaunch() {
    if (!token) return;
    setPreparing(true);
    setError("");
    tx.reset();
    try {
      const base = await eligibleBase(token.quote);
      const preview = await quotedPreview(
        token.reserve,
        0,
        exactUnits(price, base.decimals),
        BigInt(token.address) < BigInt(token.quote),
      );
      setChange({
        title: "Launch your token",
        explanation: `Launch at ${formatUnits(preview.effectivePriceWei, base.decimals)} ${base.symbol} per token. The ${formatUnits(token.reserve, 18)} tokens reserved for liquidity will be permanently locked. No base deposit is required.`,
        launch: true,
        quotedDecimals: base.decimals,
        request: {
          address: token.address,
          abi: tokenAbi,
          functionName: "launch",
          args: [preview.sqrtPriceX96, preview.tickLower, preview.tickUpper],
          value: 0n,
        },
      });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPreparing(false);
    }
  }
  async function execute() {
    if (!change || !token) return;
    const receipt = await tx.send(change.request, async () => {
      const fresh = await readToken(token.address);
      if (!address || !addressEqual(fresh.owner, address))
        throw new Error(
          "This wallet is no longer the token owner. Refresh the token.",
        );
      if (change.launch) {
        if (fresh.launched)
          throw new Error(
            "This token has already launched. Refresh its details.",
          );
        if (fresh.reserve !== token.reserve)
          throw new Error(
            "The liquidity reserve changed. Close this review and preview again.",
          );
        const freshBase = await eligibleBase(fresh.quote);
        if (freshBase.decimals !== change.quotedDecimals)
          throw new Error(
            "Base token decimals changed. Close this review and preview again.",
          );
      }
    });
    if (receipt) void query.refetch();
  }
  return (
    <section className="manage-page">
      <div className="section-title">
        <div>
          <h2>Your token. Your controls.</h2>
          <p className="muted">
            Look up a token, then connect its owner wallet.
          </p>
        </div>
      </div>
      <form className="lookup-form" onSubmit={load}>
        <Field
          label="Token contract address"
          name="token-address"
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          placeholder="Full Ethereum token address"
        />
        <button
          className="button primary"
          disabled={query.isFetching}
          type="submit"
        >
          {query.isFetching ? "Loading…" : "Load token"}
          <Icon name="arrow" />
        </button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
      {query.isError && (
        <ErrorNote>
          {friendlyError(query.error)}
          <button className="text-button" onClick={() => query.refetch()}>
            Retry token lookup
          </button>
        </ErrorNote>
      )}
      {!selected && (
        <div className="manage-intro">
          <div className="intro-item">
            <Icon name="wallet" size={24} />
            <h3>Route your fees</h3>
            <p>Update independent regular and decay recipients.</p>
          </div>
          <div className="intro-item">
            <Icon name="lock" size={24} />
            <h3>Set permissions</h3>
            <p>Manage distributors, added liquidity and new pairings.</p>
          </div>
          <div className="intro-item">
            <Icon name="arrow" size={24} />
            <h3>Launch when ready</h3>
            <p>Start trading a token you previously deployed.</p>
          </div>
        </div>
      )}
      {token && (
        <>
          <div className="manage-token-head">
            <TokenMark />
            <div>
              <h3>
                {token.name} <span className="muted">{token.symbol}</span>
              </h3>
              <AddressLink address={token.address} />
            </div>
            <a className="text-link" href={`#/token/${token.address}`}>
              Live tax
              <Icon name="external" size={14} />
            </a>
          </div>
          <div className="owner-notice">
            {!address ? (
              <>
                <Icon name="wallet" />
                <span>Connect the owner wallet to make changes.</span>
                <button className="text-button" onClick={connect}>
                  Open wallets
                </button>
              </>
            ) : !owner ? (
              <>
                <Icon name="lock" />
                <span>
                  This wallet is not the token owner. Controls are read-only.
                </span>
              </>
            ) : chainId !== 1 ? (
              <>
                <Icon name="wallet" />
                <span>Switch to Ethereum in the header to make changes.</span>
              </>
            ) : (
              <>
                <Icon name="check" />
                <span>
                  Owner wallet connected. Every change requires a transaction.
                </span>
              </>
            )}
          </div>
          {!token.launched && (
            <section className="settings-section">
              <div>
                <h3>Launch this token</h3>
                <p className="muted">
                  Your allocation and base are already fixed. The reserved
                  supply seeds locked liquidity.
                </p>
              </div>
              <div>
                <Field
                  label="Starting price per token"
                  name="later-price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="Price in base tokens"
                  suffix={
                    BASES.find((b) => addressEqual(b.address, token.quote))
                      ?.symbol ?? "base"
                  }
                />
                <button
                  className="button primary"
                  disabled={!ready || preparing}
                  onClick={prepareLaunch}
                >
                  {preparing ? "Checking…" : "Preview launch"}
                  <Icon name="arrow" />
                </button>
              </div>
            </section>
          )}
          <section className="settings-section">
            <div>
              <h3>Fee recipients</h3>
              <p className="muted">
                Both receive native ETH. Updating one does not change the other.
              </p>
            </div>
            <div>
              <div className="setting-control">
                <Field
                  label="Regular recipient"
                  name="regular-recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  disabled={!ready}
                />
                <button
                  className="button secondary"
                  disabled={!ready}
                  onClick={() => feeChange(false)}
                >
                  Update regular recipient
                </button>
              </div>
              <div className="setting-control">
                <Field
                  label="Decay recipient"
                  name="decay-recipient"
                  value={decayRecipient}
                  onChange={(e) => setDecayRecipient(e.target.value)}
                  disabled={!ready}
                />
                <button
                  className="button secondary"
                  disabled={!ready}
                  onClick={() => feeChange(true)}
                >
                  Update decay recipient
                </button>
              </div>
            </div>
          </section>
          <section className="settings-section">
            <div>
              <h3>Resting tax</h3>
              <p className="muted">
                The same rate applies to buys and sells. It cannot be changed
                during active decay.
              </p>
            </div>
            <div>
              <Field
                label="Resting buy / sell tax"
                name="owner-tax"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                inputMode="decimal"
                suffix="%"
                disabled={!ready || token.decay}
                hint={
                  token.decay
                    ? "Launch decay is active. Wait until the resting rate is reached."
                    : "0.3–5%, including the 0.15% protocol component."
                }
              />
              <button
                className="button secondary"
                disabled={!ready || token.decay}
                onClick={taxChange}
              >
                Update tax
              </button>
            </div>
          </section>
          <section className="settings-section">
            <div>
              <h3>Distributors</h3>
              <p className="muted">
                Approved contracts can transfer to or from any wallet. Approve
                only code you trust.
              </p>
            </div>
            <div>
              <label className="field">
                <span className="field-label">Contract addresses</span>
                <textarea
                  name="distributors"
                  value={accounts}
                  onChange={(e) => setAccounts(e.target.value)}
                  placeholder="One address per line"
                  rows={3}
                />
              </label>
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={checkDistributors}
                >
                  Check permissions
                </button>
                <button
                  className="button secondary"
                  disabled={!ready}
                  onClick={() => distributorChange(true)}
                >
                  Approve
                </button>
                <button
                  className="button secondary"
                  disabled={!ready}
                  onClick={() => distributorChange(false)}
                >
                  Remove
                </button>
              </div>
              <p role="status" className="small break-all preserve-lines">
                {distributorStatus}
              </p>
              <Toggle
                label="Use global distributors"
                hint="Include contracts approved by the shared hook owner."
                checked={token.globalDistributors}
                disabled={!ready}
                onChange={(v) =>
                  review(
                    "Update global distributors",
                    v
                      ? "Trust all distributors approved by the shared hook owner."
                      : "Use only locally approved distributors. Global approvals will no longer apply.",
                    "setUseGlobalDistributors",
                    [v],
                  )
                }
              />
            </div>
          </section>
          <section className="settings-section">
            <div>
              <h3>Pool permissions</h3>
              <p className="muted">
                The original liquidity remains locked regardless of these
                settings.
              </p>
            </div>
            <div>
              <Toggle
                label="Allow external liquidity"
                hint="Let anyone add liquidity to the canonical pool."
                checked={token.externalLiquidity}
                disabled={!ready}
                onChange={(v) =>
                  review(
                    "Update external liquidity",
                    `${v ? "Allow" : "Prevent"} new liquidity additions by other accounts. Existing external positions can still be withdrawn.`,
                    "setExternalLiquidityEnabled",
                    [v],
                  )
                }
              />
              <Toggle
                label="Allow new pairings"
                hint={
                  token.quote !== zeroAddress
                    ? "Only ETH-paired tokens can enable this."
                    : "Let new ERC20T launches use this token as their base."
                }
                checked={token.pairing}
                disabled={!ready || token.quote !== zeroAddress}
                onChange={(v) =>
                  review(
                    "Update pairing permission",
                    `${v ? "Allow" : "Prevent"} new tokens from pairing with this token. Existing pairs remain usable.`,
                    "setPairingEnabled",
                    [v],
                  )
                }
              />
            </div>
          </section>
        </>
      )}
      {change && (
        <Modal
          title={change.title}
          dismissible={!tx.busy}
          close={() => {
            if (!tx.busy) setChange(undefined);
          }}
          wide
        >
          <p className="change-explanation break-all">{change.explanation}</p>
          <p className="small muted">Ethereum mainnet · Token contract</p>
          <AddressLink address={change.request.address} />
          <TransactionStatus tx={tx} />
          {tx.phase === "success" ? (
            <button
              className="button primary full"
              onClick={() => setChange(undefined)}
            >
              Done
              <Icon name="check" />
            </button>
          ) : (
            <button
              className="button primary full"
              onClick={execute}
              disabled={tx.busy || !ready || !!tx.hash}
            >
              {tx.busy ? "Confirming…" : "Confirm in wallet"}
              <Icon name="arrow" />
            </button>
          )}
          <p className="fine-print">
            Your wallet shows network gas before you confirm.
          </p>
        </Modal>
      )}
    </section>
  );
}
