import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("apps/web/public/manifest.webmanifest", "utf8"));

const requiredFields = ["name", "short_name", "display", "start_url"];
for (const field of requiredFields) {
  if (!manifest[field]) {
    throw new Error(`manifest.${field} missing`);
  }
}

if (manifest.display !== "standalone") {
  throw new Error(`manifest.display expected "standalone", got "${manifest.display}"`);
}

const icons = manifest.icons ?? [];
const sizeIndex = new Map(icons.map((icon) => [icon.sizes, icon]));
for (const size of ["192x192", "512x512"]) {
  const icon = sizeIndex.get(size);
  if (!icon || icon.type !== "image/png") {
    throw new Error(`missing PNG manifest icon ${size}`);
  }
}

const hasMaskable = icons.some(
  (icon) => typeof icon.purpose === "string" && icon.purpose.split(/\s+/).includes("maskable"),
);
if (!hasMaskable) {
  throw new Error("no manifest icon declares purpose=maskable");
}

function pngSize(path) {
  const data = readFileSync(path);
  if (data.toString("hex", 0, 8) !== "89504e470d0a1a0a") {
    throw new Error(`${path} is not a PNG`);
  }
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

for (const icon of icons) {
  const src = icon.src.startsWith("/") ? icon.src.slice(1) : icon.src;
  const path = `apps/web/public/${src}`;
  const dims = pngSize(path);
  const [w, h] = icon.sizes.split("x").map(Number);
  if (dims.width !== w || dims.height !== h) {
    throw new Error(`${path} expected ${w}x${h}, got ${dims.width}x${dims.height}`);
  }
}

const layout = readFileSync("apps/web/app/layout.tsx", "utf8");
for (const token of ["/manifest.webmanifest", "InstallPrompt"]) {
  if (!layout.includes(token)) {
    throw new Error(`layout missing ${token}`);
  }
}

const installPrompt = readFileSync("apps/web/components/install-prompt.tsx", "utf8");
for (const token of ["beforeinstallprompt", "prompt()"]) {
  if (!installPrompt.includes(token)) {
    throw new Error(`install-prompt missing ${token}`);
  }
}

console.log("B42 PWA checks passed");
