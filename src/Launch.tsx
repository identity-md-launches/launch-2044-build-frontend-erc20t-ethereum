import { useRef, useState, type FormEvent } from "react";
import { useAccount } from "wagmi";
import { formatUnits, zeroAddress, type Address } from "viem";
import { BASES, CONTRACTS } from "./config";
import { factoryAbi } from "./contracts/factory";
import {
  compact,
  decayDuration,
  duration,
  exactDisplay,
  exactUnits,
  feeSplit,
  friendlyError,
  initialDraft,
  percentBps,
  validateDraft,
  type Draft,
} from "./model";
import {
  baseAddress,
  deploymentConfig,
  eligibleBase,
  quotedPreview,
  verifyInfrastructure,
  type BaseInfo,
  type LaunchPreview,
} from "./chain";
import { AddressLink, ErrorNote, Field, Icon, Stat, Toggle } from "./ui";
import { createdToken, TransactionStatus, useTransaction } from "./transaction";

type Prepared = { base: BaseInfo; previews: LaunchPreview[]; price: bigint };
export default function Launch({ connect }: { connect: () => void }) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prepared, setPrepared] = useState<Prepared>();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const { address, chainId } = useAccount();
  const tx = useTransaction();
  const heading = useRef<HTMLHeadingElement>(null);
  const token = createdToken(tx.receipt);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setPrepared(undefined);
    setAccepted(false);
    setErrors((e) => ({ ...e, [key]: "" }));
  };
  const input = (name: keyof Draft) => ({
    name,
    value: String(draft[name]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      update(name, e.target.value),
    error: errors[name],
  });
  const go = (next: number) => {
    setStep(next);
    setTimeout(() => heading.current?.focus(), 0);
  };
  async function check() {
    setChecking(true);
    setCheckError("");
    setPrepared(undefined);
    try {
      await verifyInfrastructure();
      const base = await eligibleBase(baseAddress(draft));
      const price =
        draft.mode === "launch" ? exactUnits(draft.price, base.decimals) : 0n;
      const previews =
        draft.mode === "deploy"
          ? []
          : await Promise.all(
              (base.address === zeroAddress ? [false] : [false, true]).map(
                (order) =>
                  quotedPreview(
                    exactUnits(draft.supply, 18),
                    percentBps(draft.allocation),
                    price,
                    order,
                  ),
              ),
            );
      setPrepared({ base, price, previews });
    } catch (e) {
      setCheckError(friendlyError(e));
    } finally {
      setChecking(false);
    }
  }
  function next(e: FormEvent) {
    e.preventDefault();
    const issues = validateDraft(draft, step);
    setErrors(issues);
    if (Object.keys(issues).length) {
      document.getElementById(Object.keys(issues)[0])?.focus();
      return;
    }
    if (step < 2) {
      go(step + 1);
      if (step === 1) void check();
    }
  }
  async function deploy() {
    if (!address) {
      connect();
      return;
    }
    const issues = validateDraft(draft, 2, address);
    if (Object.keys(issues).length) {
      setErrors(issues);
      go(1);
      return;
    }
    if (!prepared || !accepted || tx.busy || tx.hash) return;
    const config = deploymentConfig(draft, address, prepared.base.address);
    const args =
      draft.mode === "deploy"
        ? [config]
        : [config, percentBps(draft.allocation), prepared.price];
    await tx.send(
      {
        address: CONTRACTS.factory,
        abi: factoryAbi,
        functionName:
          draft.mode === "deploy" ? "create" : "createAndLaunchAtPrice",
        args,
        value: 0n,
      },
      async () => {
        const freshBase = await eligibleBase(prepared.base.address);
        if (freshBase.decimals !== prepared.base.decimals)
          throw new Error(
            "Base token decimals changed. Go back and review the launch again.",
          );
      },
    );
  }
  const total = Number(draft.supply) || 0;
  const kept = Number(draft.allocation) || 0;
  const tax = Number(draft.tax) || 0;
  const splits = feeSplit(
    Math.round(tax * 100),
    draft.decay ? 9900 : Math.round(tax * 100),
  );
  const priceRange =
    prepared?.previews
      .map((p) => p.effectivePriceWei)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) ?? [];
  return (
    <div className="launch-layout">
      <section className="launch-form" aria-label="Create a token">
        <ol className="steps" aria-label="Launch steps">
          {["Token", "Economics", "Review"].map((label, i) => (
            <li
              key={label}
              className={step === i ? "current" : step > i ? "complete" : ""}
              aria-current={step === i ? "step" : undefined}
            >
              <span className="step-number">
                {step > i ? <Icon name="check" size={14} /> : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <form onSubmit={next} noValidate>
          <fieldset disabled={tx.busy || !!tx.hash || checking}>
            <div className="form-section-head">
              <h2 ref={heading} tabIndex={-1}>
                {step === 0
                  ? "Make it yours."
                  : step === 1
                    ? "Set your terms."
                    : "Ready when you are."}
              </h2>
              <span className="muted small">{step + 1} / 3</span>
            </div>
            {step === 0 && (
              <>
                <div className="mode-options" aria-label="Deployment mode">
                  <label className={draft.mode === "launch" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="mode"
                      value="launch"
                      checked={draft.mode === "launch"}
                      onChange={() => update("mode", "launch")}
                    />
                    <span>Deploy & launch</span>
                    <span className="field-hint">One transaction</span>
                  </label>
                  <label className={draft.mode === "deploy" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="mode"
                      value="deploy"
                      checked={draft.mode === "deploy"}
                      onChange={() => update("mode", "deploy")}
                    />
                    <span>Deploy first</span>
                    <span className="field-hint">Launch when ready</span>
                  </label>
                </div>
                <div className="form-grid name-grid">
                  <Field
                    label="Token name"
                    {...input("name")}
                    placeholder="Your next idea"
                    maxLength={64}
                    autoComplete="off"
                  />
                  <Field
                    label="Symbol"
                    {...input("symbol")}
                    placeholder="TOKEN"
                    maxLength={16}
                    autoComplete="off"
                  />
                </div>
                <Field
                  label="Total supply"
                  {...input("supply")}
                  inputMode="decimal"
                  hint="Fixed supply · 18 decimals"
                />
                <div className="field">
                  <span className="field-label" id="base-label">
                    Pair with
                  </span>
                  <div
                    className="base-options"
                    role="group"
                    aria-labelledby="base-label"
                  >
                    {["ETH", "IMD", "FWA", "Other"].map((base) => (
                      <button
                        type="button"
                        className={draft.base === base ? "selected" : ""}
                        key={base}
                        aria-pressed={draft.base === base}
                        onClick={() => update("base", base)}
                      >
                        {base === "ETH" && (
                          <span className="eth-mark" aria-hidden="true">
                            ◇
                          </span>
                        )}
                        {base === "Other" && <Icon name="plus" size={15} />}
                        {base}
                      </button>
                    ))}
                  </div>
                  <span className="field-hint">
                    No base-token deposit. You only pay network gas.
                  </span>
                </div>
                {draft.base === "Other" && (
                  <Field
                    label="Base token address"
                    {...input("customBase")}
                    placeholder="Ethereum contract address"
                    hint="Registered external bases or eligible ETH-paired ERC20T tokens."
                  />
                )}
              </>
            )}
            {step === 1 && (
              <>
                {draft.mode === "launch" && (
                  <Field
                    label="Starting price per token"
                    {...input("price")}
                    suffix={draft.base === "Other" ? "base" : draft.base}
                    inputMode="decimal"
                    hint="The launch price rounds up to the next valid pool tick."
                  />
                )}
                <div className="form-grid">
                  <Field
                    label="Creator allocation"
                    {...input("allocation")}
                    inputMode="decimal"
                    suffix="%"
                    hint="0–20% to your wallet"
                  />
                  <Field
                    label="Resting buy / sell tax"
                    {...input("tax")}
                    inputMode="decimal"
                    suffix="%"
                    hint="0.3–5%, including 0.15% protocol"
                  />
                </div>
                <div
                  className="allocation-line"
                  aria-label={`${100 - kept}% liquidity, ${kept}% creator allocation`}
                >
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, 100 - kept))}%`,
                    }}
                  />
                </div>
                <div className="allocation-labels small">
                  <span>
                    <Icon name="lock" size={14} /> {Math.max(0, 100 - kept)}%
                    locked liquidity
                  </span>
                  <span>{kept}% yours</span>
                </div>
                <Toggle
                  label="Enable launch tax decay"
                  hint="Start at 99%. Drop one percentage point each interval."
                  checked={draft.decay}
                  onChange={(v) => update("decay", v)}
                />
                {draft.decay && (
                  <Field
                    label="Time between tax drops"
                    {...input("interval")}
                    inputMode="numeric"
                    suffix="seconds"
                    hint={`Reaches ${tax}% after ${duration(decayDuration(Math.round(tax * 100), Number(draft.interval) || 1))}.`}
                  />
                )}
                <details
                  className="recipient-details"
                  open={
                    !!errors.recipient || !!errors.decayRecipient || undefined
                  }
                >
                  <summary>
                    Fee recipients{" "}
                    <span className="muted small">Defaults to your wallet</span>
                    <Icon name="chevron" size={16} />
                  </summary>
                  <div className="details-body">
                    <Field
                      label="Regular fee recipient"
                      {...input("recipient")}
                      placeholder="Connected wallet"
                      hint="Receives resting tax minus the protocol component, converted to ETH."
                    />
                    {draft.decay && (
                      <Field
                        label="Decay fee recipient"
                        {...input("decayRecipient")}
                        placeholder="Regular fee recipient"
                        hint="Receives the temporary tax above the resting rate, converted to ETH."
                      />
                    )}
                  </div>
                </details>
              </>
            )}
            {step === 2 && (
              <div className="review">
                <div className="review-token">
                  <TokenMark />
                  <div>
                    <h3>{draft.name}</h3>
                    <span className="muted">{draft.symbol}</span>
                  </div>
                </div>
                <dl className="review-rows">
                  <Stat label="Action">
                    {draft.mode === "launch"
                      ? "Deploy & launch"
                      : "Deploy only"}
                  </Stat>
                  <Stat label="Network">Ethereum mainnet</Stat>
                  <Stat label="Total supply">{exactDisplay(draft.supply)}</Stat>
                  <Stat label="Base">
                    {prepared?.base.symbol ?? draft.base}
                  </Stat>
                  <Stat label="Creator / liquidity">
                    {kept}% / {100 - kept}%
                  </Stat>
                  <Stat label="Buy & sell tax">
                    {draft.decay ? `99% → ${tax}%` : `${tax}%`}
                  </Stat>
                  {draft.mode === "launch" && (
                    <Stat label="Requested price">
                      {draft.price} {prepared?.base.symbol ?? draft.base}
                    </Stat>
                  )}
                  {prepared && priceRange.length > 0 && (
                    <Stat
                      label={
                        priceRange.length > 1 &&
                        priceRange[0] !== priceRange.at(-1)
                          ? "Effective price range"
                          : "Effective starting price"
                      }
                    >
                      {formatUnits(priceRange[0], prepared.base.decimals)}
                      {priceRange.length > 1 &&
                      priceRange[0] !== priceRange.at(-1)
                        ? `–${formatUnits(priceRange.at(-1)!, prepared.base.decimals)}`
                        : ""}{" "}
                      {prepared.base.symbol}
                    </Stat>
                  )}
                  <Stat label="Base deposit">0</Stat>
                </dl>
                {prepared && (
                  <p className="check-note">
                    <Icon name="check" size={16} /> Contract check passed
                    {prepared.previews.length === 2
                      ? ". The exact price is set when the token is created."
                      : "."}
                  </p>
                )}
                <div className="recipient-review">
                  <span className="field-label">Regular recipient</span>
                  <span className="break-all small">
                    {draft.recipient || address || "Your connected wallet"}
                  </span>
                  {draft.decay && (
                    <>
                      <span className="field-label">Decay recipient</span>
                      <span className="break-all small">
                        {draft.decayRecipient ||
                          draft.recipient ||
                          address ||
                          "Your connected wallet"}
                      </span>
                    </>
                  )}
                </div>
                <label className="acknowledgement">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>
                    {draft.mode === "launch"
                      ? "I understand the initial liquidity is locked permanently and cannot be withdrawn."
                      : "I understand the base and supply allocation are fixed at deployment. Launching later requires another transaction."}
                  </span>
                </label>
              </div>
            )}
          </fieldset>
          {step < 2 && (
            <div className="form-actions">
              {step > 0 && (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => go(step - 1)}
                >
                  Back
                </button>
              )}
              <button className="button primary" type="submit">
                {step === 0 ? "Continue" : "Review launch"}
                <Icon name="arrow" />
              </button>
            </div>
          )}
        </form>
        {step === 2 && (
          <>
            <div role="status" className="small muted">
              {checking
                ? "Checking base eligibility and launch parameters…"
                : ""}
            </div>
            {checkError && <ErrorNote>{checkError}</ErrorNote>}
            <TransactionStatus tx={tx} />
            {tx.phase !== "success" && (
              <div className="form-actions">
                <button
                  className="button secondary"
                  disabled={tx.busy || checking || !!tx.hash}
                  onClick={() => go(1)}
                >
                  Back
                </button>
                {!prepared ? (
                  <button
                    className="button primary"
                    disabled={checking}
                    onClick={check}
                  >
                    {checking ? "Checking…" : "Retry contract check"}
                    <Icon name="refresh" />
                  </button>
                ) : (
                  <button
                    className="button primary"
                    onClick={deploy}
                    disabled={
                      !accepted ||
                      tx.busy ||
                      !!tx.hash ||
                      (!!address && chainId !== 1)
                    }
                  >
                    {tx.busy
                      ? tx.phase === "checking"
                        ? "Checking…"
                        : tx.phase === "wallet"
                          ? "Confirm in wallet…"
                          : "Confirming…"
                      : draft.mode === "launch"
                        ? "Deploy & launch"
                        : "Deploy token"}
                    <Icon name="arrow" />
                  </button>
                )}
              </div>
            )}
            {!address && (
              <p className="fine-print">
                Connect your wallet using the header before sending.
              </p>
            )}
            {address && chainId !== 1 && (
              <p className="field-error">
                Switch to Ethereum using the wallet control above.
              </p>
            )}
            {token && (
              <div className="success-result">
                <h3>
                  {draft.mode === "launch"
                    ? "Your token is live."
                    : "Your token is deployed."}
                </h3>
                <AddressLink address={token} />
                <a className="button primary" href={`#/manage/${token}`}>
                  Manage token
                  <Icon name="arrow" />
                </a>
              </div>
            )}
          </>
        )}
        <div className="form-footnote">
          <Icon name="lock" size={14} />
          <span>Token-only liquidity. Permanently locked at launch.</span>
        </div>
      </section>
      <aside className="launch-preview" aria-label="Launch preview">
        <div className="preview-top">
          <h2>Launch preview</h2>
          <span className="preview-tag">
            {draft.mode === "launch" ? "Uniswap v4" : "Deploy first"}
          </span>
        </div>
        <div className="preview-identity">
          <TokenMark large />
          <div>
            <h3>{draft.name || "Your next token"}</h3>
            <span className="preview-muted">
              {draft.symbol || "Your symbol"} <span aria-hidden="true">/</span>{" "}
              {draft.base}
            </span>
          </div>
        </div>
        <div className="preview-supply">
          <span className="preview-muted">Supply for locked liquidity</span>
          <strong>
            {compact(total * (1 - kept / 100))}
            <span className="preview-unit">tokens</span>
          </strong>
        </div>
        <div className="preview-allocation">
          <span
            style={{ width: `${Math.min(100, Math.max(0, 100 - kept))}%` }}
          />
        </div>
        <div className="allocation-labels">
          <span>{Math.max(0, 100 - kept)}% liquidity</span>
          <span>{kept}% creator</span>
        </div>
        <TaxChart
          tax={tax}
          decay={draft.decay}
          interval={Number(draft.interval) || 60}
        />
        <dl className="preview-fees">
          <Stat label="Protocol">0.15%</Stat>
          <Stat label="Regular recipient">
            {Number((splits.regular / 100).toFixed(2))}%
          </Stat>
          <Stat label="Decay recipient">
            {draft.decay
              ? `Up to ${Number((splits.decay / 100).toFixed(2))}%`
              : "Off"}
          </Stat>
        </dl>
        <p className="preview-caption">
          All fees settle in ETH. The protocol share is included in your tax.
        </p>
        <div className="preview-bottom">
          <Icon name="lock" size={16} />
          <span>No base capital required</span>
          <span className="data">
            0 {draft.base === "Other" ? "base" : draft.base}
          </span>
        </div>
      </aside>
    </div>
  );
}
export function TokenMark({ large = false }: { large?: boolean }) {
  return (
    <span className={`token-mark ${large ? "large" : ""}`} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
export function TaxChart({
  tax,
  decay,
  interval,
}: {
  tax: number;
  decay: boolean;
  interval: number;
}) {
  const resting = Math.min(500, Math.max(30, Math.round(tax * 100)));
  const steps = Math.ceil((9900 - resting) / 100);
  const curve = Array.from(
    { length: steps },
    (_, i) =>
      `H${(((i + 1) / steps) * 340).toFixed(2)}V${(12 + ((9900 - Math.max(resting, 9900 - (i + 1) * 100)) / (9900 - resting)) * 88).toFixed(2)}`,
  ).join("");
  return (
    <figure className="tax-chart">
      <figcaption>
        <span>Buy / sell tax</span>
        <strong>{decay ? `99% → ${tax}%` : `${tax}%`}</strong>
      </figcaption>
      <svg
        viewBox="0 0 360 120"
        role="img"
        aria-label={
          decay
            ? `Illustrative schedule: 99% declining by one percentage point every ${interval} seconds to ${tax}%`
            : `Fixed tax of ${tax}%`
        }
      >
        <path d="M0 20H360M0 60H360M0 100H360" className="chart-grid" />
        <path
          d={decay ? `M0 12${curve}H360` : "M0 100H360"}
          className="chart-line"
        />
        <circle cx="355" cy="100" r="4" className="chart-dot" />
      </svg>
      <div className="chart-labels">
        <span>At launch</span>
        <span>
          {decay
            ? `Resting · ${duration(decayDuration(Math.round(tax * 100), interval))}`
            : "Fixed resting rate"}
        </span>
      </div>
    </figure>
  );
}
