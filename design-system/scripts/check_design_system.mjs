import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { searchPlaces, validateReport } from "../src/design-system/model.js";
const t = JSON.parse(await readFile("src/design-system/tokens.json", "utf8"));
const luminance = (hex) => {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .slice(0, 3)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const report = [];
for (const [theme, c] of Object.entries(t.color))
  for (const [fg, bg] of [
    ["text", "surface"],
    ["text-secondary", "surface"],
    ["text-muted", "surface"],
    ["text", "canvas"],
    ["text-secondary", "canvas"],
    ["text-muted", "canvas"],
    ["on-accent", "accent"],
    ["accent-ink", "accent-subtle"],
    ["danger", "danger-subtle"],
    ["caution", "caution-subtle"],
    ["info", "info-subtle"],
  ]) {
    const [hi, lo] = [luminance(c[fg]), luminance(c[bg])].sort((a, b) => b - a),
      ratio = (hi + 0.05) / (lo + 0.05);
    assert(ratio >= 4.5, `${theme} ${fg}/${bg}: ${ratio}`);
    report.push({
      theme,
      pair: `${fg}/${bg}`,
      ratio: Number(ratio.toFixed(2)),
    });
  }
assert.equal(searchPlaces("공영주차장")[0].kind, "facility");
assert.equal(searchPlaces("공영주차장")[0].valleyId, "baegun");
assert(searchPlaces("백운", ["free"]).some((x) => x.kind === "facility"));
assert.equal(searchPlaces("", ["free"]).length, 0);
assert(searchPlaces("", ["parking"]).every((v) => v.parking === true));
assert.equal(searchPlaces("없는계곡").length, 0);
assert(validateReport({ body: "  " }));
assert(validateReport({ body: "가".repeat(501) }));
assert.equal(validateReport({ body: "현장 안내판을 확인해주세요." }), "");
console.log(
  JSON.stringify(
    {
      result: "passed",
      checks: [
        "22 semantic text contrast pairs ≥4.5",
        "facility destination",
        "search bypasses filters",
        "unknown excluded",
        "empty search result",
        "report validation",
      ],
      contrast: report,
    },
    null,
    2,
  ),
);
