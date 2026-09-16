import { build } from "esbuild";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
const out = "public/design/production";
await mkdir(out, { recursive: true });
const tokens = JSON.parse(
  await readFile("src/design-system/tokens.json", "utf8"),
);
let css = "/* Generated from src/design-system/tokens.json. */\n";
for (const [theme, colors] of Object.entries(tokens.color))
  css += `${theme === "light" ? ":root, " : ""}[data-theme="${theme}"]{${Object.entries(
    colors,
  )
    .map(([k, v]) => `--mv-${k}:${v};`)
    .join("")}color-scheme:${theme};}\n`;
css +=
  ":root{" +
  ["space", "radius", "motion", "layer"]
    .flatMap((group) =>
      Object.entries(tokens[group]).map(([k, v]) => `--mv-${group}-${k}:${v};`),
    )
    .join("") +
  Object.entries(tokens.type)
    .flatMap(([role, values]) =>
      Object.entries(values).map(
        ([key, value]) =>
          `--mv-type-${role}-${key}:${value}${key === "weight" ? "" : "px"};`,
      ),
    )
    .join("") +
  Object.entries(tokens.control)
    .map(([key, value]) => `--mv-control-${key}:${value}px;`)
    .join("") +
  "}\n";
await writeFile("src/design-system/tokens.css", css);
await cp("src/design-system/tokens.json", `${out}/tokens.json`);
await cp("public/design/system/icons", `${out}/icons`, { recursive: true });
await build({
  entryPoints: ["src/design-system/studio.jsx"],
  bundle: true,
  format: "esm",
  minify: true,
  outdir: out,
  entryNames: "studio",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});
await build({
  entryPoints: ["src/design-system/components.jsx"],
  bundle: true,
  format: "esm",
  external: ["react", "react-dom"],
  outdir: `${out}/library`,
  entryNames: "index",
  minify: false,
  logLevel: "info",
});
await cp("src/design-system", `${out}/source`, { recursive: true });
await cp("src/design-system/index.d.ts", `${out}/library/index.d.ts`);
await cp(`${out}/icons`, `${out}/library/icons`, { recursive: true });
await cp(`${out}/IMPLEMENTATION.md`, `${out}/library/README.md`);
await writeFile(
  `${out}/library/package.json`,
  JSON.stringify(
    {
      name: "@moduvalley/ui",
      version: tokens.version,
      private: true,
      type: "module",
      main: "./index.js",
      types: "./index.d.ts",
      exports: {
        ".": { types: "./index.d.ts", import: "./index.js" },
        "./styles.css": "./index.css",
      },
      peerDependencies: { react: "^18.3.1 || ^19.2.3" },
      sideEffects: ["*.css"],
    },
    null,
    2,
  ),
);
console.log(
  "Design system built: studio + reusable React library + source + tokens",
);
