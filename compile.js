import { build } from "esbuild";
import { rm } from "fs/promises";

async function main() {
  let dir = new URL("./.learn-rsc/", import.meta.url);

  await rm(dir, { recursive: true, force: true });

  await build({
    format: "esm",
    logLevel: "info",
    entryPoints: ["./bundler/build/**/*.ts"],
    outdir: "./.learn-rsc/bundler",
    packages: "external",
  });
}

await main();
