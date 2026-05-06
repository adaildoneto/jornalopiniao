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
await mkdir(path.join(outDir, "vendor"), { recursive: true });

await Promise.all(files.map((file) => copyFile(path.join(root, file), path.join(outDir, file))));
await Promise.all([
  copyFile(path.join(root, "node_modules", "jquery", "dist", "jquery.min.js"), path.join(outDir, "vendor", "jquery.min.js")),
  copyFile(path.join(root, "node_modules", "slick-carousel", "slick", "slick.min.js"), path.join(outDir, "vendor", "slick.min.js")),
  copyFile(path.join(root, "node_modules", "slick-carousel", "slick", "slick.css"), path.join(outDir, "vendor", "slick.css"))
]);

console.log(`Build web concluido em ${outDir}`);
