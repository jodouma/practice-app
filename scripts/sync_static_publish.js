import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distAssets = path.join(projectRoot, "dist", "assets");
const rootAssets = path.join(projectRoot, "assets");
const rootIndex = path.join(projectRoot, "index.html");
const distIndex = path.join(projectRoot, "dist", "index.html");

function removeDirRecursive(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  for (const entry of fs.readdirSync(targetPath)) {
    const fullPath = path.join(targetPath, entry);
    const stat = fs.lstatSync(fullPath);
    if (stat.isDirectory()) {
      removeDirRecursive(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }
  fs.rmdirSync(targetPath);
}

if (!fs.existsSync(distAssets)) {
  console.error("ERREUR: dist/assets introuvable. Lancez d'abord `npm run build`.");
  process.exit(1);
}

removeDirRecursive(rootAssets);
fs.mkdirSync(rootAssets, { recursive: true });

for (const name of fs.readdirSync(distAssets)) {
  fs.copyFileSync(path.join(distAssets, name), path.join(rootAssets, name));
}

fs.copyFileSync(rootIndex, distIndex);

console.log(`Assets publiables copiés vers ${rootAssets}`);
