import { useEffect, useRef, useState } from "react";
import Launch from "./Launch";
import Explore, { TokenDetail } from "./Explore";
import Manage from "./Manage";
import { WalletControl } from "./wallet";
import { Icon, AddressLink } from "./ui";
import { CONTRACTS } from "./config";

export default function App() {
  const [route, setRoute] = useState(location.hash.slice(2) || "create");
  const [walletOpen, setWalletOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const change = () => {
      setRoute(location.hash.slice(2) || "create");
      window.scrollTo(0, 0);
      requestAnimationFrame(() => heading.current?.focus());
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const page = route.split("/")[0];
  const address = route.split("/")[1] ?? "";
  const headingText =
    page === "explore" || page === "token"
      ? "An open field of ideas."
      : page === "manage"
        ? "Built to be yours."
        : page === "about"
          ? "Simple rules. On-chain."
          : "Launch on your terms.";
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <a href="#/create" className="wordmark" aria-label="ERC20T home">
          <span className="brand-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 28 28">
              <path d="M5 5h18v4h-7v15h-4V9H5z" fill="currentColor" />
            </svg>
          </span>
          ERC20T
        </a>
        <div className="header-right">
          <span className="network">
            <span className="network-dot" />
            Ethereum<span className="desktop-only"> mainnet</span>
          </span>
          <WalletControl open={walletOpen} setOpen={setWalletOpen} />
        </div>
      </header>
      <main id="main" className="main-shell" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <h1 ref={heading} tabIndex={-1}>
              {headingText}
            </h1>
            <p>
              {page === "create"
                ? "Create an Ethereum token with locked liquidity and automatic ETH fees."
                : page === "explore" || page === "token"
                  ? "Independent tokens. One shared Uniswap v4 tax hook."
                  : page === "manage"
                    ? "Launch, route fees, and manage your token’s permissions."
                    : "A transparent foundation for your next token."}
            </p>
          </div>
          <div className="heading-note">
            <span className="orbit-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>
              One shared hook.
              <br />A world of possibilities.
            </span>
          </div>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <a
            className={page === "create" ? "active" : ""}
            aria-current={page === "create" ? "page" : undefined}
            href="#/create"
          >
            Create token
          </a>
          <a
            className={["explore", "token"].includes(page) ? "active" : ""}
            aria-current={page === "explore" ? "page" : undefined}
            href="#/explore"
          >
            Explore
          </a>
          <a
            className={page === "manage" ? "active" : ""}
            aria-current={page === "manage" ? "page" : undefined}
            href="#/manage"
          >
            Manage
          </a>
          <a
            className={`about-nav ${page === "about" ? "active" : ""}`}
            aria-current={page === "about" ? "page" : undefined}
            href="#/about"
          >
            How it works
            <Icon name="external" size={14} />
          </a>
        </nav>
        {page === "create" ? (
          <Launch connect={() => setWalletOpen(true)} />
        ) : page === "explore" ? (
          <Explore />
        ) : page === "token" ? (
          <TokenDetail address={address} />
        ) : page === "manage" ? (
          <Manage
            key={address}
            initialAddress={address}
            connect={() => setWalletOpen(true)}
          />
        ) : page === "about" ? (
          <About />
        ) : (
          <div className="empty-state">
            <h2>Page not found.</h2>
            <a className="button primary" href="#/create">
              Create a token
              <Icon name="arrow" />
            </a>
          </div>
        )}
        {page === "create" && (
          <section className="principles" aria-label="Protocol essentials">
            <div>
              <span className="principle-index">01</span>
              <h3>Launch without base capital.</h3>
              <p>
                Your token seeds the pool. You keep up to 20% of supply and only
                pay network gas.
              </p>
            </div>
            <div>
              <span className="principle-index">02</span>
              <h3>Liquidity stays. Forever.</h3>
              <p>
                The initial Uniswap v4 position is permanently locked. No
                withdrawal, no unlock date.
              </p>
            </div>
            <div>
              <span className="principle-index">03</span>
              <h3>Your fees come home in ETH.</h3>
              <p>
                One buy and sell tax. Separate destinations for regular fees and
                optional launch decay.
              </p>
            </div>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span>
          ERC20T <span className="muted">/</span> A foundation for independent
          tokens.
        </span>
        <div>
          <a
            href={`https://etherscan.io/address/${CONTRACTS.hook}#code`}
            target="_blank"
            rel="noreferrer"
          >
            Shared hook
            <Icon name="external" size={14} />
          </a>
          <a
            href={`https://etherscan.io/address/${CONTRACTS.factory}#code`}
            target="_blank"
            rel="noreferrer"
          >
            Factory
            <Icon name="external" size={14} />
          </a>
          <a href="#/about">Protocol guide</a>
        </div>
      </footer>
    </>
  );
}
function About() {
  return (
    <article className="about-page">
      <div className="about-intro">
        <h2>From idea to open market.</h2>
        <p>
          ERC20T creates fixed-supply Ethereum tokens. Each token uses the same
          Uniswap v4 hook, with its own tax, recipients and permissions.
        </p>
      </div>
      <div className="guide-grid">
        <section>
          <h3>01 / Create and launch</h3>
          <p>
            Deploy and launch in one transaction, or deploy first and launch
            later from Manage. Choose your base and retain 0–20% of the fixed
            supply. The remaining tokens fund the initial liquidity position. No
            base-token deposit is required; Ethereum gas is still payable.
          </p>
          <p>
            The initial position is permanently locked. The starting price is a
            quote per whole token and rounds up to a valid pool tick. It sets
            the initial price, not a guarantee of future value.
          </p>
        </section>
        <section>
          <h3>02 / Choose an eligible base</h3>
          <p>
            ETH is a native base. IMD and FWA are registered external bases in
            the supplied hook’s deployment. Their current permission is checked
            before deployment.
          </p>
          <p>
            Other bases must be enabled external tokens, or ETH-paired ERC20T
            tokens on this hook with pairing enabled. A token paired with
            another ERC20T cannot itself enable new pairings. External
            conversion pools may have their own fees and transfer rules.
          </p>
        </section>
        <section>
          <h3>03 / Define your tax</h3>
          <p>
            The resting tax is 0.3–5% on buys and sells. Optional launch decay
            begins at 99%, drops one percentage point each interval, and stops
            at your resting rate. The schedule starts at launch.
          </p>
          <p>
            The included protocol component is 0.15%. The resting tax minus
            0.15% goes to the regular recipient; tax above resting goes to the
            decay recipient. Fees are converted to ETH. Resting tax cannot
            change while decay is active.
          </p>
        </section>
        <section>
          <h3>04 / Keep control</h3>
          <p>
            The owner can update fee recipients, approve distributors, choose
            whether to trust the shared distributor registry, allow external
            liquidity, and control new pairings. Changing pairing permission
            does not disable existing pairs.
          </p>
          <p>
            Ordinary direct transfers between wallets without code are untaxed.
            Other transfers are restricted, with owner and approved-distributor
            exceptions. Smart-account and delegated-wallet transfers may not
            qualify for the direct-wallet exception. PoolManager transfers are
            always checked by the hook. Swaps support exact input only.
          </p>
        </section>
      </div>
      <div className="contract-directory">
        <h2>The contracts behind the interface.</h2>
        <p className="muted">Ethereum mainnet · verified source and ABI</p>
        <dl>
          <div>
            <dt>Shared tax hook</dt>
            <dd>
              <AddressLink address={CONTRACTS.hook} />
            </dd>
          </div>
          <div>
            <dt>Token factory</dt>
            <dd>
              <AddressLink address={CONTRACTS.factory} />
            </dd>
          </div>
          <div>
            <dt>Token implementation</dt>
            <dd>
              <AddressLink address={CONTRACTS.implementation} />
            </dd>
          </div>
        </dl>
        <a
          href="https://sourcify.dev/#/lookup/0x801411c6acec4fa80c75c5d3c0eae13c84f8a173"
          className="text-link"
          target="_blank"
          rel="noreferrer"
        >
          View verified factory source
          <Icon name="external" size={14} />
        </a>
      </div>
    </article>
  );
}
