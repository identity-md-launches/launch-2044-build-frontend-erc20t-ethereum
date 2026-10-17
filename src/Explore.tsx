import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAddress, isAddress, type Address } from "viem";
import { BASES, shortAddress } from "./config";
import { discoverTokens, readToken, type TokenInfo } from "./chain";
import { compact, friendlyError } from "./model";
import { ErrorNote, Field, Icon, Stat, AddressLink } from "./ui";
import { TokenMark } from "./Launch";

export default function Explore() {
  const query = useQuery({
    queryKey: ["discovery"],
    queryFn: () => discoverTokens(),
    staleTime: 30_000,
  });
  const [filter, setFilter] = useState("All tokens");
  const [search, setSearch] = useState("");
  const [extra, setExtra] = useState<TokenInfo[]>([]);
  const [older, setOlder] = useState<bigint>();
  const [pending, setPending] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (query.data) {
      setOlder(query.data.older);
      setPending(query.data.remainingAddresses);
    }
  }, [query.data]);
  const all = [...(query.data?.tokens ?? []), ...extra].filter(
    (t, i, list) => list.findIndex((s) => s.address === t.address) === i,
  );
  const shown = all.filter(
    (t) =>
      (filter === "All tokens" ||
        (filter === "Live" && t.launched) ||
        (filter === "Not launched" && !t.launched) ||
        (filter === "In decay" && t.decay)) &&
      `${t.name} ${t.symbol} ${t.address}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function lookup() {
    if (!isAddress(search)) {
      setError("Enter a full Ethereum token address to look it up.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await readToken(getAddress(search));
      setExtra((current) => [token, ...current]);
      setFilter("All tokens");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }
  async function olderPage() {
    if (!older) return;
    setLoading(true);
    setError("");
    try {
      const page = await discoverTokens(older);
      setExtra((current) => [...current, ...page.tokens]);
      setOlder(page.older);
      setPending(page.remainingAddresses);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }
  async function nextTokens() {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled(
      pending.slice(0, 24).map(readToken),
    );
    setExtra((current) => [
      ...current,
      ...results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    ]);
    setPending((current) => current.slice(24));
    if (results.some((r) => r.status === "rejected"))
      setError(
        "Some token reads failed. Use address lookup to retry an individual token.",
      );
    setLoading(false);
  }
  return (
    <section className="explore-page">
      <div className="section-title">
        <div>
          <h2>Fresh from the factory.</h2>
          <p className="muted">
            Discover ERC20T launches directly from Ethereum.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            setExtra([]);
            query.refetch();
          }}
          disabled={query.isFetching}
        >
          <Icon name="refresh" />
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="explore-tools">
        <div className="search-wrap">
          <Icon name="search" />
          <input
            aria-label="Search tokens by name, symbol or address"
            placeholder="Search name, symbol or address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isAddress(search)) void lookup();
            }}
          />
        </div>
        <button
          className="button secondary"
          onClick={lookup}
          disabled={loading}
        >
          Look up address
          <Icon name="arrow" />
        </button>
      </div>
      <div className="filter-row" role="group" aria-label="Filter tokens">
        {["All tokens", "Live", "Not launched", "In decay"].map((f) => (
          <button
            className={filter === f ? "active" : ""}
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <span className="loaded-count" role="status">
          {all.length} loaded
        </span>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {query.isPending && (
        <div className="empty-state" role="status">
          <div className="empty-symbol">
            <Icon name="refresh" size={28} />
          </div>
          <h3>Reading the latest launches</h3>
          <p className="muted">
            Checking factory events and current token settings.
          </p>
        </div>
      )}
      {query.isError && !all.length && (
        <div className="empty-state">
          <div className="empty-symbol">
            <Icon name="search" size={28} />
          </div>
          <h3>The chain is out of reach.</h3>
          <p className="muted">
            We couldn’t load launches. Retry, or look up a token by its contract
            address.
          </p>
          <button
            className="button secondary"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? "Retrying…" : "Retry discovery"}
            <Icon name="refresh" />
          </button>
          <p className="fine-print">
            No cached or sample token data is displayed.
          </p>
        </div>
      )}
      {shown.length > 0 && (
        <div className="token-list">
          <div className="token-list-head small muted">
            <span>Token</span>
            <span>Base</span>
            <span>Buy / sell tax</span>
            <span>Status</span>
            <span />
          </div>
          {shown.map((token) => (
            <a
              href={`#/token/${token.address}`}
              className="token-row"
              key={token.address}
            >
              <div className="token-name">
                <TokenMark />
                <div>
                  <h3>{token.name}</h3>
                  <span className="small muted">
                    {token.symbol} · {compact(Number(token.supply) / 1e18)}{" "}
                    supply
                  </span>
                </div>
              </div>
              <span className="data token-base">
                {BASES.find(
                  (b) => b.address.toLowerCase() === token.quote.toLowerCase(),
                )?.symbol ?? shortAddress(token.quote)}
              </span>
              <span className="data token-tax">
                <span className="mobile-label">Tax </span>
                {token.tax / 100}%
                {token.decay && (
                  <span className="small muted"> → {token.resting / 100}%</span>
                )}
              </span>
              <span className={`status-badge ${token.launched ? "live" : ""}`}>
                {token.launched
                  ? token.decay
                    ? "In decay"
                    : "Live"
                  : "Not launched"}
              </span>
              <Icon name="arrow" />
            </a>
          ))}
        </div>
      )}
      {!query.isPending && !query.isError && !shown.length && (
        <div className="empty-state">
          <div className="empty-symbol">
            <Icon name="search" size={28} />
          </div>
          <h3>
            {search || filter !== "All tokens"
              ? "No matching tokens."
              : "The next launch could be yours."}
          </h3>
          <p className="muted">
            {search || filter !== "All tokens"
              ? "Try another name or clear your filters."
              : "No tokens were found in this block range."}
          </p>
          {search || filter !== "All tokens" ? (
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setFilter("All tokens");
              }}
            >
              Clear filters
            </button>
          ) : (
            <a className="button primary" href="#/create">
              Create a token
              <Icon name="arrow" />
            </a>
          )}
        </div>
      )}
      <div className="discovery-foot">
        <p className="fine-print">
          {query.data
            ? `Factory blocks ${query.data.from.toLocaleString()}–${query.data.to.toLocaleString()}. Tax is read at each token’s latest fetched block.`
            : "Factory events are fetched in ranges of up to 10,000 blocks."}
          {!!query.data?.failed &&
            ` ${query.data.failed} token reads failed; refresh to retry.`}
          {!!pending.length &&
            ` ${pending.length} more deployments in this range.`}
        </p>
        {pending.length > 0 && (
          <button
            className="button secondary"
            onClick={nextTokens}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more tokens"}
            <Icon name="arrow" />
          </button>
        )}
        {older && !pending.length && (
          <button
            className="button secondary"
            onClick={olderPage}
            disabled={loading}
          >
            {loading ? "Loading…" : "Scan older blocks"}
            <Icon name="arrow" />
          </button>
        )}
      </div>
    </section>
  );
}

export function TokenDetail({ address }: { address: string }) {
  const valid = isAddress(address);
  const query = useQuery({
    queryKey: ["token", address],
    queryFn: () => readToken(getAddress(address)),
    enabled: valid,
    refetchInterval: 15_000,
  });
  const token = query.data;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);
  const stale = query.isError || now - query.dataUpdatedAt > 35_000;
  if (!valid)
    return (
      <ErrorNote>Enter a valid Ethereum address in the token link.</ErrorNote>
    );
  if (!token)
    return (
      <div className="empty-state">
        <h2>
          {query.isPending ? "Reading token…" : "Token could not be loaded."}
        </h2>
        {query.isError && (
          <>
            <p className="muted">{friendlyError(query.error)}</p>
            <button
              className="button secondary"
              onClick={() => query.refetch()}
            >
              Retry token lookup
            </button>
          </>
        )}
      </div>
    );
  const elapsed = Number(token.timestamp - token.launchedAt);
  const untilStep = token.decay
    ? token.interval - (elapsed % token.interval)
    : 0;
  return (
    <section className="token-detail">
      <a className="text-link" href="#/explore">
        ← All tokens
      </a>
      <div className="detail-title">
        <TokenMark large />
        <div>
          <h2>{token.name}</h2>
          <span className="muted">{token.symbol}</span>
        </div>
        <span className="status-badge">
          {token.launched ? "Launched" : "Not launched"}
        </span>
      </div>
      <AddressLink address={token.address} />
      <div className="detail-grid">
        <section>
          <div className="section-title">
            <h3>Current swap tax</h3>
            <button
              className="icon-button"
              onClick={() => query.refetch()}
              aria-label="Refresh live tax"
            >
              <Icon name="refresh" />
            </button>
          </div>
          <div className="tax-readout data">
            {token.tax / 100}%<span>buy & sell</span>
          </div>
          <p className="muted">
            {token.decay
              ? `${token.resting / 100}% resting rate. Next step in ${untilStep} seconds at the fetched block.`
              : token.launched
                ? "The resting rate is active."
                : "The launch schedule starts when the pool launches."}
          </p>
          <p
            className={`small ${stale ? "field-error" : "muted"}`}
            role="status"
          >
            {stale
              ? "Refresh failed. Displaying the last fetched tax; it may be stale."
              : `On-chain reading · block ${token.block.toLocaleString()} · refreshes every 15 seconds`}
          </p>
        </section>
        <dl className="review-rows">
          <Stat label="Total supply">
            {compact(Number(token.supply) / 1e18)} {token.symbol}
          </Stat>
          <Stat label="Protocol component">0.15%</Stat>
          <Stat label="Regular recipient share">
            {(token.resting - 15) / 100}%
          </Stat>
          <Stat label="Current decay share">
            {Math.max(0, token.tax - token.resting) / 100}%
          </Stat>
          <Stat label="External liquidity">
            {token.externalLiquidity ? "Allowed" : "Restricted"}
          </Stat>
          <Stat label="New pairing permission">
            {token.pairing ? "Enabled" : "Disabled"}
          </Stat>
        </dl>
      </div>
      <div className="detail-recipients">
        <h3>Fee destinations</h3>
        <p className="muted">Fees are converted to ETH automatically.</p>
        <div className="field">
          <span className="field-label">Regular recipient</span>
          <AddressLink address={token.feeRecipient} />
        </div>
        <div className="field">
          <span className="field-label">Decay recipient</span>
          <AddressLink address={token.decayRecipient} />
        </div>
        <div className="field">
          <span className="field-label">Owner</span>
          <AddressLink address={token.owner} />
        </div>
      </div>
      <div className="notice">
        <Icon name="lock" />
        <p>
          Initial liquidity is permanently locked. Swaps support exact input
          only. Direct wallet-to-wallet transfers are untaxed; contract
          transfers require permission.
        </p>
      </div>
      <a className="button secondary" href={`#/manage/${token.address}`}>
        Open owner controls
        <Icon name="arrow" />
      </a>
    </section>
  );
}
