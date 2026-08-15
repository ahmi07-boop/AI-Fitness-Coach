import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");
const source = path.join(
  clientRoot,
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm"
);
const destination = path.join(
  clientRoot,
  "public",
  "mediapipe",
  "wasm"
);

if (!fs.existsSync(source)) {
  console.warn(
    "[MediaPipe] Local WASM package assets were not found. " +
    "The application will use the CDN fallback."
  );
  process.exit(0);
}

fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.cpSync(source, destination, { recursive: true });

console.log(`[MediaPipe] WASM assets copied to ${path.relative(clientRoot, destination)}`);
