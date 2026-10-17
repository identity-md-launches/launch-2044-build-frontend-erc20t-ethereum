import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  zeroAddress,
} from "viem";
import {
  allocationFor,
  decayDuration,
  decayRate,
  exactUnits,
  exactDisplay,
  feeSplit,
  initialDraft,
  percentBps,
  validRecipient,
  validateDraft,
  UINT128_MAX,
} from "../src/model";
import { deploymentConfig } from "../src/chain";
import { factoryAbi } from "../src/contracts/factory";
import { CONTRACTS, BASES } from "../src/config";

// Public, verified hook constructor owner. Test data only; no signing or RPC calls.
const owner = getAddress("0xDf99bd1218E7EB288CfFeCF9775385167Bb09B2D");
const valid = { ...initialDraft, name: "Unit test token", symbol: "TEST" };

test("review supply display preserves integers and all fractional digits", () => {
  assert.equal(
    exactDisplay("123456789123456789.123456789123456789"),
    "123,456,789,123,456,789.123456789123456789",
  );
  assert.throws(() => allocationFor(-1n, 0));
  assert.throws(() => allocationFor(0n, 0));
});

test("price input preserves base decimals and rejects silent rounding", () => {
  assert.equal(exactUnits("0.000000001", 18), 1000000000n);
  assert.equal(exactUnits("1.234567", 6), 1234567n);
  for (const value of [
    "0",
    "-1",
    "1e9",
    "NaN",
    "Infinity",
    "1.2345678",
    ".5",
    "",
  ])
    assert.throws(() => exactUnits(value, 6));
});
test("creator retention rounds down and conserves the exact supply", () => {
  assert.deepEqual(allocationFor(101n, 2000), {
    creatorSupply: 20n,
    lpSupply: 81n,
  });
  assert.deepEqual(allocationFor(100n, 0), {
    creatorSupply: 0n,
    lpSupply: 100n,
  });
  for (let bps = 0; bps <= 2000; bps += 13) {
    const supply = 987654321123456789987654321n;
    const { creatorSupply, lpSupply } = allocationFor(supply, bps);
    assert.equal(creatorSupply + lpSupply, supply);
    assert.ok(creatorSupply <= supply / 5n);
  }
  for (const bps of [-1, 2001, 2.5, NaN])
    assert.throws(() => allocationFor(100n, bps));
  assert.throws(() => allocationFor(UINT128_MAX + 1n, 0));
});
test("decay follows completed intervals, clamps to fractional resting tax", () => {
  assert.equal(decayRate(30, 60, -1), 9900);
  assert.equal(decayRate(30, 60, 59), 9900);
  assert.equal(decayRate(30, 60, 60), 9800);
  assert.equal(decayRate(30, 60, 98 * 60), 100);
  assert.equal(decayRate(30, 60, 99 * 60), 30);
  assert.equal(decayDuration(30, 60), 5940);
  assert.equal(decayDuration(500, 1), 94);
});
test("protocol fee is included and shares conserve the swap tax", () => {
  for (const rest of [30, 100, 333, 500])
    for (const current of [rest, 5000, 9900]) {
      const share = feeSplit(rest, current);
      assert.equal(share.protocol, 15);
      assert.equal(share.regular, rest - 15);
      assert.equal(share.protocol + share.regular + share.decay, current);
    }
});
test("economic boundaries and interval bounds reject invalid configurations", () => {
  assert.equal(percentBps("0.3"), 30);
  assert.equal(percentBps("4.99"), 499);
  assert.throws(() => percentBps("0.333"));
  for (const tax of ["0", "0.29", "5.01", "-1", "abc"])
    assert.ok(validateDraft({ ...valid, tax }, 1).tax);
  for (const tax of ["0.3", "0.31", "5"])
    assert.deepEqual(validateDraft({ ...valid, tax }, 1), {});
  for (const interval of ["0", "0.5", "4294967296", "-1"])
    assert.ok(validateDraft({ ...valid, decay: true, interval }, 1).interval);
  assert.deepEqual(
    validateDraft({ ...valid, decay: true, interval: "4294967295" }, 1),
    {},
  );
  assert.ok(validateDraft({ ...valid, allocation: "20.01" }, 1).allocation);
});
test("recipient addresses are explicit or resolved to the connected wallet", () => {
  assert.equal(validRecipient(zeroAddress), false);
  assert.equal(validRecipient("not an address"), false);
  assert.equal(validRecipient(owner), true);
  assert.ok(validateDraft(valid, 2).recipient);
  assert.deepEqual(validateDraft(valid, 2, owner), {});
  const config = deploymentConfig(valid, owner, zeroAddress);
  assert.equal(config.owner, owner);
  assert.equal(config.feeRecipient, owner);
  assert.equal(config.feeDecayRecipient, owner);
});
test("atomic launch calldata matches the verified ABI and supplied infrastructure", () => {
  const draft = {
    ...valid,
    decay: true,
    tax: "0.3",
    allocation: "20",
    interval: "12",
  };
  const config = deploymentConfig(draft, owner, BASES[2].address);
  assert.equal(config.hook, CONTRACTS.hook);
  assert.equal(config.quoteToken, BASES[2].address);
  assert.equal(config.lpSupply, 800000000n * 10n ** 18n);
  assert.equal(config.taxBps, 30);
  assert.equal(config.launchTaxBps, 9900);
  assert.equal(config.taxDecayIntervalSeconds, 12);
  const data = encodeFunctionData({
    abi: factoryAbi,
    functionName: "createAndLaunchAtPrice",
    args: [config, 2000, 123456n],
  });
  const decoded = decodeFunctionData({ abi: factoryAbi, data });
  assert.equal(decoded.functionName, "createAndLaunchAtPrice");
  if (decoded.functionName === "createAndLaunchAtPrice") {
    assert.equal(
      decoded.args[0].quoteToken.toLowerCase(),
      BASES[2].address.toLowerCase(),
    );
    assert.equal(decoded.args[0].lpSupply, config.lpSupply);
    assert.equal(decoded.args[1], 2000);
    assert.equal(decoded.args[2], 123456n);
  }
});
test("deploy-only configuration disables decay with both parameters zero", () => {
  const config = deploymentConfig(
    { ...valid, mode: "deploy", decay: false, interval: "60" },
    owner,
    zeroAddress,
  );
  assert.equal(config.launchTaxBps, 0);
  assert.equal(config.taxDecayIntervalSeconds, 0);
  const data = encodeFunctionData({
    abi: factoryAbi,
    functionName: "create",
    args: [config],
  });
  assert.equal(
    decodeFunctionData({ abi: factoryAbi, data }).functionName,
    "create",
  );
});
