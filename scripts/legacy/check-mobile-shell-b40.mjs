import { readFileSync } from "node:fs";

const files = {
  layout: "apps/web/app/layout.tsx",
  globals: "apps/web/app/globals.css",
  page: "apps/web/app/page.tsx",
  header: "apps/web/components/header.tsx",
  button: "apps/web/components/ui/button.tsx",
};

const contents = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, readFileSync(path, "utf8")]),
);

for (const [label, [file, token]] of Object.entries({
  "viewport-fit": ["layout", "viewportFit"],
  "body mobile shell": ["layout", "mobile-shell"],
  "body safe area": ["layout", "safe-area-bottom"],
  "body svh": ["layout", "min-h-svh"],
  "utility mobile shell": ["globals", ".mobile-shell"],
  "utility safe area": ["globals", "env(safe-area-inset-bottom)"],
  "utility touch target": ["globals", ".touch-target"],
  "page svh": ["page", "min-h-svh"],
  "header touch targets": ["header", "touch-target"],
  "button 44px target": ["button", "h-11"],
})) {
  if (!contents[file].includes(token)) {
    throw new Error(`${label} missing ${token} in ${files[file]}`);
  }
}

const allSource = Object.values(contents).join("\n");
const forbiddenVh = allSource.match(/(?<![ds])vh\b/g);
if (forbiddenVh) {
  throw new Error(`plain vh unit found: ${forbiddenVh.join(", ")}`);
}

console.log("B40 mobile shell checks passed");
