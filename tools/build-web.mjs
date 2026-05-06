import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "www");
const files = [
  "index.html",
  "app.js",
  "styles.css",
  "manifest.webmanifest",
  "sw.js"
];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await Promise.all(files.map((file) => copyFile(path.join(root, file), path.join(outDir, file))));

console.log(`Build web concluido em ${outDir}`);
