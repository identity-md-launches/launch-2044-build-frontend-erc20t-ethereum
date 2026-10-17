import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Modal, Icon, ErrorNote } from "./ui";
import { shortAddress } from "./config";
import { friendlyError } from "./model";

const OPEN_IN = [
  {
    id: "metamask",
    name: "MetaMask",
    href: (url: string) =>
      `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, "")}`,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    href: (url: string) =>
      `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    id: "rabby",
    name: "Rabby",
    href: (url: string) =>
      `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(url)}`,
  },
  {
    id: "phantom",
    name: "Phantom",
    href: (url: string) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
  },
];
export function WalletControl({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending, variables, error, reset } =
    useConnect();
  const { disconnect } = useDisconnect();
  const {
    switchChain,
    isPending: switching,
    error: switchError,
  } = useSwitchChain();
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => {
    if (isConnected) setOpen(false);
  }, [isConnected, setOpen]);
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !named &&
    !(window as Window & { ethereum?: unknown }).ethereum;
  const listed = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ]
    .filter((c) => !(c.id === "injected" && named))
    .filter((c) => !mobile || c.type !== "injected");
  return (
    <>
      <button
        className="wallet-button"
        onClick={() => {
          if (isConnected && chainId !== 1)
            switchChain(
              { chainId: 1 },
              { onError: () => setAccountOpen(true) },
            );
          else if (isConnected) setAccountOpen(true);
          else {
            reset();
            setOpen(true);
          }
        }}
      >
        <Icon name="wallet" />
        {isConnected
          ? chainId !== 1
            ? switching
              ? "Switching…"
              : "Switch to Ethereum"
            : shortAddress(address!)
          : "Connect"}
      </button>

      {open && (
        <Modal title="Connect a wallet" close={() => setOpen(false)}>
          <p className="muted">Choose a wallet to launch on Ethereum.</p>
          <div className="wallet-options">
            {mobile &&
              OPEN_IN.map((w) => (
                <a
                  className="wallet-row"
                  key={w.id}
                  href={w.href(location.href)}
                >
                  <img
                    src={`./wallets/${w.id}.svg`}
                    width="28"
                    height="28"
                    alt=""
                  />
                  <span>Open in {w.name}</span>
                  <Icon name="external" />
                </a>
              ))}
            {listed.map((c) => (
              <button
                className="wallet-row"
                key={c.uid}
                disabled={isPending}
                onClick={() => connect({ connector: c })}
              >
                {c.icon ? (
                  <img src={c.icon} alt="" width="28" height="28" />
                ) : c.id === "coinbaseWalletSDK" ? (
                  <img
                    src="./wallets/coinbase.svg"
                    alt=""
                    width="28"
                    height="28"
                  />
                ) : (
                  <Icon name="wallet" size={28} />
                )}
                <span>
                  {c.id === "injected"
                    ? "Browser wallet"
                    : c.id === "coinbaseWalletSDK"
                      ? mobile
                        ? "Coinbase Smart Wallet"
                        : "Coinbase Wallet"
                      : c.name}
                </span>
                {isPending && variables?.connector === c ? (
                  <span className="field-hint">Opening…</span>
                ) : (
                  <Icon name="arrow" />
                )}
              </button>
            ))}
          </div>
          {error && <ErrorNote>{friendlyError(error)}</ErrorNote>}
          <p className="fine-print">
            Connecting does not send a transaction. You approve every
            transaction in your wallet.
          </p>
        </Modal>
      )}
      {accountOpen && address && (
        <Modal title="Your wallet" close={() => setAccountOpen(false)}>
          <p className="break-all data">{address}</p>
          <p className="muted">
            {chainId === 1
              ? "Ethereum mainnet"
              : `Connected to chain ${chainId}`}
          </p>
          {switchError && <ErrorNote>{friendlyError(switchError)}</ErrorNote>}
          {chainId !== 1 && (
            <button
              className="button primary full"
              onClick={() => switchChain({ chainId: 1 })}
              disabled={switching}
            >
              {switching ? "Switching…" : "Switch to Ethereum"}
            </button>
          )}
          <button
            className="button secondary full"
            onClick={() => {
              disconnect();
              setAccountOpen(false);
            }}
          >
            Disconnect wallet
          </button>
        </Modal>
      )}
    </>
  );
}
