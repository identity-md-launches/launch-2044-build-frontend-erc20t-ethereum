/** Production-export interaction tests. All wallet/RPC responses below are isolated
 * test fixtures. No private keys, external transactions, or live-chain writes. */
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import {
  decodeFunctionData,
  encodeFunctionResult,
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
  zeroAddress,
} from "viem";
import { factoryAbi } from "../src/contracts/factory.ts";
import { tokenAbi } from "../src/contracts/token.ts";
import { hookAbi } from "../src/contracts/hook.ts";

const output = resolve("test/scratch/browser-validation");
await mkdir(output, { recursive: true });
const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const relative = url.pathname.replace(/^\/preview\//, "") || "index.html";
    const file = resolve(root, relative);
    if (!file.startsWith(root + "/") || !url.pathname.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const report = { checks: [], browsers: {}, limitations: [] };
const check = (name, detail = "") => {
  report.checks.push({ name, passed: true, detail });
  console.log(`PASS ${name}${detail ? ": " + detail : ""}`);
};
const C = {
  factory: "0x801411c6acec4fa80c75c5d3c0eae13c84f8a173",
  hook: "0xed9a04fa6693e754661a22502524df9b1857e544",
  token: "0x2df7dcf4d19a7924e00ae96629cc1d1261670eee",
  pool: "0x000000000004444c5dc75cb358380d2e3de08a90",
  position: "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e",
  permit: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  owner: "0xdf99bd1218e7eb288cffecf9775385167bb09b2d",
  recipient: "0x2abd4b16a9663f4913f35a87a2c3078df165bf12",
  fwa: "0xa0df17b5ac76ababa36e1450e2cbcd18a620c845",
};
// Public deployment identifiers reused only as deterministic fixture identifiers.
const hash =
  "0xdf27d0960e641cfa4b2715a27a37860c022592484feab22ff53977e242ccfd5a";
const blockNumber = 26208100;
const blockHex = "0x" + blockNumber.toString(16);
const block = {
  number: blockHex,
  hash,
  parentHash: hash,
  timestamp: "0x6a000100",
  nonce: "0x0000000000000000",
  sha3Uncles: hash,
  logsBloom: "0x" + "00".repeat(256),
  transactionsRoot: hash,
  stateRoot: hash,
  receiptsRoot: hash,
  miner: C.owner,
  difficulty: "0x0",
  totalDifficulty: "0x0",
  extraData: "0x",
  size: "0x100",
  gasLimit: "0x1c9c380",
  gasUsed: "0x100",
  baseFeePerGas: "0x3b9aca00",
  transactions: [],
  uncles: [],
  mixHash: hash,
};
const aggregateAbi = parseAbi([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
]);
let state = {};
const resetState = () =>
  (state = {
    launched: true,
    decay: false,
    tax: 100,
    resting: 100,
    recipient: C.owner,
    decayRecipient: C.owner,
    external: false,
    pairing: false,
    global: true,
    distributor: false,
    offline: false,
    reject: false,
    account: C.owner,
    baseEnabled: true,
    baseDecimals: 18,
    baseSymbol: "FWA",
    quote: zeroAddress,
    sent: [],
    previews: [],
    logs: true,
  });
resetState();
function logCreated() {
  return {
    address: C.factory,
    topics: encodeEventTopics({
      abi: factoryAbi,
      eventName: "TokenCreated",
      args: { token: C.token, owner: C.owner, creator: C.owner },
    }),
    data: encodeAbiParameters([{ type: "address" }], [C.hook]),
    blockNumber: blockHex,
    blockHash: hash,
    transactionHash: hash,
    transactionIndex: "0x0",
    logIndex: "0x0",
    removed: false,
  };
}
function ethCall(to, data) {
  try {
    const decoded = decodeFunctionData({ abi: aggregateAbi, data });
    if (decoded.functionName === "aggregate3")
      return encodeFunctionResult({
        abi: aggregateAbi,
        functionName: "aggregate3",
        result: decoded.args[0].map((call) => {
          try {
            return {
              success: true,
              returnData: ethCall(call.target, call.callData),
            };
          } catch {
            return { success: false, returnData: "0x" };
          }
        }),
      });
  } catch {
    /* A normal contract call. */
  }
  let decoded;
  let abi;
  for (const candidate of [factoryAbi, tokenAbi, hookAbi]) {
    try {
      decoded = decodeFunctionData({ abi: candidate, data });
      abi = candidate;
      break;
    } catch {}
  }
  if (!decoded)
    throw Error(`Unsupported fixture selector ${data.slice(0, 10)}`);
  const { functionName: name, args = [] } = decoded;
  let result;
  const supply = 1000000n * 10n ** 18n;
  const values = {
    implementation: C.token,
    poolManager: C.pool,
    hook: C.hook,
    name: "Fixture token",
    symbol: to.toLowerCase() === C.fwa ? state.baseSymbol : "FIX",
    decimals: to.toLowerCase() === C.fwa ? state.baseDecimals : 18,
    totalSupply: supply,
    owner: C.owner,
    quoteToken: state.quote,
    launched: state.launched,
    launchedAt: BigInt(block.timestamp) - 60n,
    taxBps: state.tax,
    restingTaxBps: state.resting,
    taxDecayIntervalSeconds: 60,
    taxDecayActive: state.decay,
    feeRecipient: state.recipient,
    feeDecayRecipient: state.decayRecipient,
    pairingEnabled: state.pairing,
    externalLiquidityEnabled: state.external,
    useGlobalDistributors: state.global,
    balanceOf: (supply * 80n) / 100n,
    poolInitialized: true,
    isLocalDistributor: state.distributor,
    isDistributor: state.distributor,
    externalBases: [true, state.baseEnabled],
  };
  if (name in values) result = values[name];
  else if (name === "previewQuotedLaunch") {
    state.previews.push(args);
    const [supply, bps, price, order] = args;
    result = {
      creatorSupply: (supply * BigInt(bps)) / 10000n,
      lpSupply: supply - (supply * BigInt(bps)) / 10000n,
      sqrtPriceX96: 79228162514264337593543950336n,
      tickLower: order ? 0 : -887220,
      tickUpper: order ? 887220 : 0,
      effectivePriceWei: price + 1n,
    };
  } else if (name.startsWith("create")) result = C.token;
  else if (name.startsWith("set") || name === "launch") result = undefined;
  else throw Error(`Unsupported fixture method ${name}`);
  return encodeFunctionResult({ abi, functionName: name, result });
}
function rpc(method, params = []) {
  if (method === "eth_blockNumber") return blockHex;
  if (method === "eth_chainId") return "0x1";
  if (method === "eth_getBlockByNumber") return block;
  if (method === "eth_getCode")
    return `0x363d3d373d3d3d363d73${C.token.slice(2)}5af43d82803e903d91602b57fd5bf3${C.hook.slice(2)}${zeroAddress.slice(2)}${C.pool.slice(2)}${C.position.slice(2)}${C.permit.slice(2)}`;
  if (method === "eth_call") return ethCall(params[0].to, params[0].data);
  if (method === "eth_getLogs") return state.logs ? [logCreated()] : [];
  if (method === "eth_getTransactionReceipt")
    return {
      transactionHash: hash,
      transactionIndex: "0x0",
      blockHash: hash,
      blockNumber: blockHex,
      from: C.owner,
      to: state.sent.at(-1)?.to ?? C.factory,
      cumulativeGasUsed: "0x5208",
      gasUsed: "0x5208",
      contractAddress: null,
      logs:
        state.sent.at(-1)?.to.toLowerCase() === C.factory ? [logCreated()] : [],
      logsBloom: block.logsBloom,
      status: "0x1",
      effectiveGasPrice: "0x3b9aca00",
      type: "0x2",
    };
  if (method === "eth_estimateGas") return "0x100000";
  throw Error(`Unsupported RPC fixture ${method}`);
}
async function fixtureContext(browser, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ...options,
  });
  await context.route("https://**/*", async (route) => {
    const req = route.request();
    if (!/ethereum-rpc.publicnode.com|eth.drpc.org/.test(req.url()))
      return route.abort();
    if (state.offline)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      });
    const body = req.postDataJSON();
    const respond = (item) => {
      try {
        return {
          jsonrpc: "2.0",
          id: item.id,
          result: rpc(item.method, item.params),
        };
      } catch (e) {
        return {
          jsonrpc: "2.0",
          id: item.id,
          error: { code: -32000, message: e.message },
        };
      }
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        Array.isArray(body) ? body.map(respond) : respond(body),
      ),
    });
  });
  return context;
}
async function installWallet(context, initialChain = "0x1") {
  await context.exposeBinding("__fixtureSend", async (_, request) => {
    if (state.reject) throw Error("User rejected the request.");
    state.sent.push(request);
    const decoded = decodeFunctionData({
      abi: request.to.toLowerCase() === C.factory ? factoryAbi : tokenAbi,
      data: request.data,
    });
    const args = decoded.args ?? [];
    switch (decoded.functionName) {
      case "create":
      case "createAndLaunchAtPrice":
        state.launched = decoded.functionName !== "create";
        state.decay = args[0].launchTaxBps > 0 && state.launched;
        state.tax = state.decay ? 9900 : args[0].taxBps;
        state.resting = args[0].taxBps;
        state.quote = args[0].quoteToken;
        break;
      case "setFeeRecipient":
        state.recipient = args[0];
        break;
      case "setFeeDecayRecipient":
        state.decayRecipient = args[0];
        break;
      case "setTaxBps":
        state.tax = state.resting = args[0];
        break;
      case "setDistributors":
        state.distributor = args[1];
        break;
      case "setUseGlobalDistributors":
        state.global = args[0];
        break;
      case "setExternalLiquidityEnabled":
        state.external = args[0];
        break;
      case "setPairingEnabled":
        state.pairing = args[0];
        break;
      case "launch":
        state.launched = true;
        break;
    }
    return hash;
  });
  await context.addInitScript(
    ({ account, initialChain }) => {
      const listeners = new Map();
      let connected = sessionStorage.getItem("fixtureConnected") === "yes";
      let chain = sessionStorage.getItem("fixtureChain") ?? initialChain;
      const provider = {
        on: (event, fn) => {
          listeners.set(event, [...(listeners.get(event) ?? []), fn]);
        },
        removeListener: (event, fn) =>
          listeners.set(
            event,
            (listeners.get(event) ?? []).filter((f) => f !== fn),
          ),
        request: async ({ method, params }) => {
          if (method === "eth_accounts") return connected ? [account] : [];
          if (method === "eth_requestAccounts") {
            connected = true;
            sessionStorage.setItem("fixtureConnected", "yes");
            return [account];
          }
          if (method === "eth_chainId") return chain;
          if (method === "wallet_switchEthereumChain") {
            chain = params[0].chainId;
            sessionStorage.setItem("fixtureChain", chain);
            for (const fn of listeners.get("chainChanged") ?? []) fn(chain);
            return null;
          }
          if (method === "wallet_addEthereumChain") return null;
          if (method === "eth_sendTransaction") {
            try {
              return await window.__fixtureSend(params[0]);
            } catch (error) {
              throw { code: 4001, message: error.message };
            }
          }
          if (method === "wallet_getCapabilities") return {};
          throw Error("Unsupported wallet fixture: " + method);
        },
      };
      window.ethereum = provider;
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: {
              info: {
                uuid: "1b1e12f6-6ada-4c6d-b92f-40f4e1276fab",
                name: "Fixture Wallet",
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" fill="black"/></svg>',
                rdns: "test.erc20t.wallet",
              },
              provider,
            },
          }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { account: state.account, initialChain },
  );
}
async function expectVisible(page, text) {
  await page
    .getByText(text, { exact: false })
    .first()
    .waitFor({ state: "visible", timeout: 12_000 });
}
async function fillToken(page, deploy = false) {
  await page.goto(url);
  if (deploy) await page.getByRole("radio", { name: /Deploy first/ }).check();
  await page.getByLabel("Token name", { exact: true }).fill("Field Notes");
  await page.getByLabel("Symbol", { exact: true }).fill("NOTE");
  await page.getByLabel("Total supply", { exact: true }).fill("1000000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
async function reviewAndSend(page) {
  await page
    .getByRole("button", { name: "Review launch", exact: true })
    .click();
  await expectVisible(page, "Contract check passed");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: /^(Deploy & launch|Deploy token)$/ })
    .click();
  await expectVisible(page, "Confirmed on Ethereum");
}
let browser;
try {
  browser = await chromium.launch({ headless: true });
  report.browsers.chromium = "passed";
  let context = await fixtureContext(browser);
  let page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const missing = [];
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400) missing.push(r.url());
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(url);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    if (width === 390) {
      const rect = await page
        .getByRole("button", { name: "Continue", exact: true })
        .boundingBox();
      assert.ok(
        rect.y + rect.height <= 844,
        `Continue ends at ${rect.y + rect.height}`,
      );
      await page.screenshot({ path: `${output}/390.png` });
      check(
        "390px first screen includes product and complete primary action",
        `Continue bottom: ${rect.y + rect.height}px / 844px`,
      );
    }
    if (width === 1440)
      await page.screenshot({ path: `${output}/1440.png`, fullPage: true });
  }
  check("Responsive reflow at 320, 390, 768 and 1440px");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("#main").evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(new URL(page.url()).hash, "");
  check("Skip link focuses main without changing the app route");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(
    await page
      .getByLabel("Token name", { exact: true })
      .getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(
    await page
      .getByLabel("Token name", { exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByLabel("Token name", { exact: true }).fill("Field Notes");
  await page.getByLabel("Symbol", { exact: true }).fill("NOTE");
  await page.getByRole("button", { name: "Other", exact: true }).click();
  await page.getByLabel("Base token address").fill("invalid");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expectVisible(page, "Enter the eligible base token");
  await page.getByRole("button", { name: "ETH", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Resting buy / sell tax", { exact: true }).fill("0.2");
  await page
    .getByRole("button", { name: "Review launch", exact: true })
    .click();
  await expectVisible(page, "Set a resting tax from 0.3% to 5%");
  await page.getByLabel("Resting buy / sell tax", { exact: true }).fill("0.3");
  await page.getByLabel("Creator allocation", { exact: true }).fill("21");
  await page
    .getByRole("button", { name: "Review launch", exact: true })
    .click();
  await expectVisible(page, "Keep between 0% and 20%");
  await page.getByLabel("Creator allocation", { exact: true }).fill("20");
  await page.getByRole("switch", { name: /Enable launch tax decay/ }).check();
  await page.getByLabel("Time between tax drops").fill("0");
  await page
    .getByRole("button", { name: "Review launch", exact: true })
    .click();
  await expectVisible(page, "Enter an interval from 1");
  await page.getByLabel("Time between tax drops").fill("60");
  check(
    "Launch validation: name, custom base, tax, allocation and decay interval",
  );
  state.offline = true;
  await page
    .getByRole("button", { name: "Review launch", exact: true })
    .click();
  await expectVisible(page, "Ethereum could not be reached");
  assert.equal(
    await page
      .getByRole("button", { name: "Retry contract check" })
      .isEnabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Deploy & launch", exact: true })
      .count(),
    0,
  );
  check("Unavailable RPC blocks submission and offers retry");
  state.offline = false;
  await page.getByRole("button", { name: "Retry contract check" }).click();
  await expectVisible(page, "Contract check passed");
  check("Contract preview recovers after RPC retry");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expectVisible(page, "Browser wallet");
  await expectVisible(page, "Coinbase Wallet");
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.contains(document.activeElement)),
      true,
    );
  }
  await page.screenshot({ path: `${output}/keyboard-focus.png` });
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Connect", exact: true })
      .evaluate((el) => document.activeElement === el),
    true,
  );
  check("Desktop wallet options, Escape dismissal and focus restoration");
  await page.goto(url);
  const axe = await new AxeBuilder({ page }).analyze();
  await writeFile(
    `${output}/axe-home.json`,
    JSON.stringify(axe.violations, null, 2),
  );
  assert.deepEqual(
    axe.violations.map((v) => v.id),
    [],
  );
  check(
    "axe accessibility scan on initial production screen",
    `${axe.passes.length} rules passed`,
  );
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const axeDialog = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    axeDialog.violations.map((v) => v.id),
    [],
  );
  check("axe accessibility scan on wallet dialog");
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  check("No script errors or missing local assets under /preview/");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: `${output}/text-200-percent.png`,
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
    document.documentElement.dir = "rtl";
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.evaluate(() => {
    document.documentElement.dir = "ltr";
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .getByRole("button", { name: "Continue", exact: true })
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  check("200% text enlargement, RTL reflow and reduced-motion button behavior");
  await context.close();

  context = await fixtureContext(browser, {
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  });
  page = await context.newPage();
  await page.goto(url);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"]) {
    const link = page.getByRole("link", {
      name: `Open in ${name}`,
      exact: true,
    });
    assert.equal(await link.isVisible(), true);
    assert.ok((await link.getAttribute("href")).startsWith("https://"));
  }
  await expectVisible(page, "Coinbase Smart Wallet");
  const rabbyLink = new URL(
    await page
      .getByRole("link", { name: "Open in Rabby" })
      .getAttribute("href"),
  );
  assert.equal(rabbyLink.searchParams.get("_cmd"), "open-dapp");
  assert.equal(rabbyLink.searchParams.get("dapp"), page.url());
  await page.screenshot({ path: `${output}/mobile-wallet.png` });
  check("Mobile wallet sheet: four app links and Coinbase Smart Wallet");
  await context.close();

  resetState();
  context = await fixtureContext(browser);
  await installWallet(context, "0x5");
  page = await context.newPage();
  await page.goto(url);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expectVisible(page, "Fixture Wallet");
  assert.equal(
    await page
      .getByRole("button", { name: "Browser wallet", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Fixture Wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Switch to Ethereum", exact: true })
    .click();
  await expectVisible(page, "0xDf99");
  check("Named EIP-6963 provider, generic-row suppression and mainnet switch");
  await fillToken(page);
  await page.getByLabel("Creator allocation", { exact: true }).fill("20");
  await page.getByLabel("Resting buy / sell tax", { exact: true }).fill("0.3");
  await page.getByRole("switch", { name: /Enable launch tax decay/ }).check();
  await page.getByLabel("Time between tax drops").fill("15");
  await page
    .getByRole("button", { name: "Review launch", exact: true })
    .click();
  await expectVisible(page, "Contract check passed");
  assert.equal(
    await page
      .getByRole("button", { name: "Deploy & launch", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("checkbox").check();
  state.reject = true;
  await page
    .getByRole("button", { name: "Deploy & launch", exact: true })
    .click();
  await expectVisible(page, "Request declined");
  assert.equal(state.sent.length, 0);
  state.reject = false;
  await page
    .getByRole("button", { name: "Deploy & launch", exact: true })
    .click();
  await expectVisible(page, "Confirmed on Ethereum");
  const atomic = decodeFunctionData({
    abi: factoryAbi,
    data: state.sent.at(-1).data,
  });
  assert.equal(atomic.functionName, "createAndLaunchAtPrice");
  assert.equal(atomic.args[1], 2000);
  assert.equal(atomic.args[0].taxBps, 30);
  assert.equal(atomic.args[0].launchTaxBps, 9900);
  assert.equal(atomic.args[0].taxDecayIntervalSeconds, 15);
  assert.equal(BigInt(state.sent.at(-1).value ?? 0), 0n);
  check(
    "Atomic launch: acknowledgement, rejection recovery, encoded values, zero deposit, receipt and created-token link",
  );
  await page.getByRole("link", { name: "Manage token", exact: true }).click();
  await expectVisible(page, "Owner wallet connected");
  assert.equal(
    await page
      .getByRole("button", { name: "Update tax", exact: true })
      .isDisabled(),
    true,
  );
  state.decay = false;
  await page.getByRole("button", { name: "Load token", exact: true }).click();
  await page.getByLabel("Regular recipient", { exact: true }).fill(C.recipient);
  await page
    .getByRole("button", { name: "Update regular recipient", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expectVisible(page, "Confirmed on Ethereum");
  assert.equal(state.recipient.toLowerCase(), C.recipient);
  assert.equal(state.decayRecipient, C.owner);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByLabel("Decay recipient", { exact: true }).fill(C.recipient);
  await page
    .getByRole("button", { name: "Update decay recipient", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expectVisible(page, "Confirmed on Ethereum");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByLabel("Resting buy / sell tax", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Update tax", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expectVisible(page, "Confirmed on Ethereum");
  assert.equal(state.tax, 500);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  check(
    "Owner fee recipient independence and resting tax updates; active-decay tax lock",
  );
  await page.getByLabel("Contract addresses", { exact: true }).fill(C.fwa);
  await page
    .getByRole("button", { name: "Check permissions", exact: true })
    .click();
  await expectVisible(page, "not approved");
  for (const label of ["Approve", "Remove"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page
      .getByRole("button", { name: "Confirm in wallet", exact: true })
      .click();
    await expectVisible(page, "Confirmed on Ethereum");
    await page.getByRole("button", { name: "Done", exact: true }).click();
  }
  for (const label of [
    "Use global distributors",
    "Allow external liquidity",
    "Allow new pairings",
  ]) {
    await page.getByRole("switch", { name: new RegExp(label) }).click();
    await page
      .getByRole("button", { name: "Confirm in wallet", exact: true })
      .click();
    await expectVisible(page, "Confirmed on Ethereum");
    await page.getByRole("button", { name: "Done", exact: true }).click();
  }
  assert.equal(state.distributor, false);
  assert.equal(state.global, false);
  assert.equal(state.external, true);
  assert.equal(state.pairing, true);
  check(
    "Owner distributor checks/add/remove, global registry, external liquidity and pairing controls",
  );
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expectVisible(page, "Fixture token");
  await page.getByRole("button", { name: "Not launched", exact: true }).click();
  await expectVisible(page, "No matching tokens");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search tokens by name, symbol or address" })
    .fill("no-match");
  await expectVisible(page, "No matching tokens");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByRole("link", { name: /Fixture token/ }).click();
  await page
    .getByRole("button", { name: "Refresh live tax" })
    .waitFor({ state: "visible" });
  await expectVisible(page, "5%");
  state.offline = true;
  await page.getByRole("button", { name: "Refresh live tax" }).click();
  await expectVisible(page, "it may be stale");
  state.offline = false;
  check(
    "Discovery event decoding, filters, search, detail navigation and stale-tax disclosure",
  );
  await fillToken(page, true);
  assert.equal(
    await page.getByLabel("Starting price per token", { exact: true }).count(),
    0,
  );
  await reviewAndSend(page);
  assert.equal(
    decodeFunctionData({ abi: factoryAbi, data: state.sent.at(-1).data })
      .functionName,
    "create",
  );
  await page.getByRole("link", { name: "Manage token", exact: true }).click();
  await expectVisible(page, "Launch this token");
  await page
    .getByLabel("Starting price per token", { exact: true })
    .fill("0.000001");
  await page
    .getByRole("button", { name: "Preview launch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await expectVisible(page, "Confirmed on Ethereum");
  assert.equal(
    decodeFunctionData({ abi: tokenAbi, data: state.sent.at(-1).data })
      .functionName,
    "launch",
  );
  check(
    "Deploy-first and subsequent owner launch use the correct two contract methods",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await fillToken(page);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Other", exact: true }).click();
  await page.getByLabel("Base token address").fill(C.fwa);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  state.baseDecimals = 6;
  state.baseEnabled = false;
  await page
    .getByLabel("Starting price per token", { exact: true })
    .fill("1.000001");
  await page
    .getByRole("button", { name: "Review launch", exact: true })
    .click();
  await expectVisible(page, "disabled for new launches");
  state.baseEnabled = true;
  await page.getByRole("button", { name: "Retry contract check" }).click();
  await expectVisible(page, "Contract check passed");
  assert.equal(state.previews.at(-1)[2], 1000001n);
  assert.equal(state.previews.at(-1)[3], true);
  assert.equal(state.previews.at(-2)[3], false);
  check(
    "Custom base eligibility, quote decimals, and both new-token address orderings",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const reviewAxe = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    reviewAxe.violations.map((v) => v.id),
    [],
  );
  await page.screenshot({
    path: `${output}/mobile-review.png`,
    fullPage: true,
  });
  const sentBeforeMetadataChange = state.sent.length;
  state.baseDecimals = 8;
  await page
    .getByRole("checkbox", { name: /I understand the initial liquidity/ })
    .check();
  await page
    .getByRole("button", { name: "Deploy & launch", exact: true })
    .click();
  await expectVisible(page, "Base token decimals changed");
  assert.equal(state.sent.length, sentBeforeMetadataChange);
  state.baseDecimals = 6;
  check("Changed base decimals after review block the wallet transaction");
  await page.goto(`${url}#/manage/${C.token}`);
  await expectVisible(page, "Owner wallet connected");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const manageAxe = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    manageAxe.violations.map((v) => v.id),
    [],
  );
  await page.screenshot({
    path: `${output}/mobile-manage.png`,
    fullPage: true,
  });
  check("Mobile review and owner settings: no overflow or axe violations");
  await context.close();

  resetState();
  state.account = C.recipient;
  context = await fixtureContext(browser);
  await installWallet(context);
  page = await context.newPage();
  await page.goto(`${url}#/manage/${C.token}`);
  await expectVisible(page, "Connect the owner wallet");
  assert.equal(
    await page
      .getByRole("button", { name: "Update regular recipient" })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page
    .getByRole("button", { name: "Fixture Wallet", exact: true })
    .click();
  await expectVisible(page, "This wallet is not the token owner");
  assert.equal(
    await page
      .getByRole("button", { name: "Update regular recipient" })
      .isDisabled(),
    true,
  );
  check("Disconnected and non-owner wallets cannot invoke owner controls");
  await context.close();

  let safari;
  try {
    safari = await webkit.launch({ headless: true });
  } catch (e) {
    report.browsers.webkit = "unavailable";
    report.limitations.push(
      `WebKit could not launch: ${e.message.slice(0, 1200)}`,
    );
    console.log("LIMITATION WebKit unavailable; see report");
  }
  if (safari) {
    resetState();
    const safariContext = await fixtureContext(safari, {
      viewport: { width: 390, height: 844 },
    });
    const safariPage = await safariContext.newPage();
    await fillToken(safariPage);
    await safariPage
      .getByRole("switch", { name: /Enable launch tax decay/ })
      .check();
    await safariPage
      .getByRole("button", { name: "Review launch", exact: true })
      .click();
    await expectVisible(safariPage, "Contract check passed");
    await safariPage
      .getByRole("button", { name: "Connect", exact: true })
      .click();
    await safariPage.keyboard.press("Escape");
    assert.equal(
      await safariPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await safariPage.screenshot({
      path: `${output}/webkit-review.png`,
      fullPage: true,
    });
    report.browsers.webkit = "passed";
    check("WebKit mobile launch preview and wallet sheet");
    await safari.close();
  }
} catch (error) {
  report.checks.push({
    name: "Interaction run",
    passed: false,
    detail: error.stack,
  });
  console.error(error);
  const lastPage = browser?.contexts().at(-1)?.pages().at(-1);
  if (lastPage) {
    console.error((await lastPage.locator("body").innerText()).slice(-7000));
    await lastPage.screenshot({
      path: `${output}/failure.png`,
      fullPage: true,
    });
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.close();
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  console.log(`Results: ${output}/results.json`);
}
