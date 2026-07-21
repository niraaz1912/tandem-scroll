import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const context = vm.createContext({});
vm.runInContext(
  readFileSync(join(root, "shared/scroll-math.js"), "utf8"),
  context,
);
const math = context.TandemScrollMath;

test("converts offsets to a normalized scroll position", () => {
  const position = math.normalizedPosition({
    scrollLeft: 250,
    scrollTop: 900,
    scrollWidth: 1500,
    scrollHeight: 2200,
    clientWidth: 1000,
    clientHeight: 1000,
  });

  assert.equal(position.x, 0.5);
  assert.equal(position.y, 0.75);
});

test("maps ratios onto a page with different dimensions", () => {
  const offsets = math.offsetsFromPosition(
    { x: 0.25, y: 0.75 },
    {
      scrollWidth: 1800,
      scrollHeight: 5000,
      clientWidth: 1000,
      clientHeight: 1000,
    },
  );

  assert.equal(offsets.left, 200);
  assert.equal(offsets.top, 3000);
});

test("clamps bad values and handles pages that do not scroll", () => {
  assert.equal(math.ratioFromOffset(50, 500, 500), 0);
  assert.equal(math.offsetFromRatio(2, 1000, 400), 600);
  assert.equal(math.offsetFromRatio(-1, 1000, 400), 0);
  assert.equal(math.clamp(Number.NaN), 0);
});

test("uses an epsilon when identifying a programmatic echo", () => {
  assert.equal(math.closeEnough(0.5, 0.502), true);
  assert.equal(math.closeEnough(0.5, 0.51), false);
});
