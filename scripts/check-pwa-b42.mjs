import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("apps/web/public/manifest.webmanifest", "utf8"));

const required = {
  name: "Claudelance",
  short_name: "Claudelance",
  display: "standalone",
  start_url: "/",
  scope: "/",
};

for (const [key, value] of Object.entries(required)) {
  if (manifest[key] !== value) {
    throw new Error(`manifest.${key} expected ${value}, got ${manifest[key]}`);
  }
}

const icons = new Map(manifest.icons.map((icon) => [icon.sizes, icon]));
for (const size of ["192x192", "512x512"]) {
  const icon = icons.get(size);
  if (!icon || icon.type !== "image/png") {
    throw new Error(`missing PNG manifest icon ${size}`);
  }
}

const maskable = manifest.icons.find((icon) => icon.sizes === "512x512" && icon.purpose === "maskable");
if (!maskable) {
  throw new Error("missing 512x512 maskable manifest icon");
}

function pngSize(path) {
  const data = readFileSync(path);
  if (data.toString("hex", 0, 8) !== "89504e470d0a1a0a") {
    throw new Error(`${path} is not a PNG`);
  }
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

for (const [path, size] of [
  ["apps/web/public/icons/icon-192.png", 192],
  ["apps/web/public/icons/icon-512.png", 512],
  ["apps/web/public/icons/maskable-512.png", 512],
  ["apps/web/public/apple-touch-icon.png", 180],
]) {
  const dimensions = pngSize(path);
  if (dimensions.width !== size || dimensions.height !== size) {
    throw new Error(`${path} expected ${size}x${size}, got ${dimensions.width}x${dimensions.height}`);
  }
}

const layout = readFileSync("apps/web/app/layout.tsx", "utf8");
for (const token of ["/manifest.webmanifest", "/apple-touch-icon.png", "InstallPrompt"]) {
  if (!layout.includes(token)) {
    throw new Error(`layout missing ${token}`);
  }
}

const installPrompt = readFileSync("apps/web/components/install-prompt.tsx", "utf8");
for (const token of ["beforeinstallprompt", "appinstalled", "localStorage", "prompt()"]) {
  if (!installPrompt.includes(token)) {
    throw new Error(`InstallPrompt missing ${token}`);
  }
}

console.log("B42 PWA checks passed");
