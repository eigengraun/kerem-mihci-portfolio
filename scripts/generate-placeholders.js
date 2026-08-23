const fs = require("fs");
const path = require("path");

const dirs = [
  "public/assets/wallpapers",
  "public/assets/projects/fling-arena",
  "public/assets/projects/kixogames",
  "public/assets/projects/planfiq",
  "public/assets/projects/yanarsan-yangin-logo",
  "public/assets/projects/hizir-yangin-logo",
  "public/assets/projects/deva-yangin-logo",
  "public/assets/projects/goobzy-logo",
  "public/assets/projects/ceylanlar-logo",
  "public/assets/projects/emix-logo",
  "public/assets/projects/alchemia",
  "public/assets/projects/engin-perde",
  "public/assets/projects/sanda-yachting",
  "public/assets/projects/yanarsan-web",
  "public/assets/projects/emix-web",
  "public/assets/projects/kagestudio-web",
  "public/assets/projects/ceylanlar-web",
  "public/assets/projects/deva-web",
  "public/assets/projects/motion-showreel",
  "public/assets/projects/ai-product",
  "public/assets/projects/reels",
  "public/assets/projects/motion-ident",
  "public/assets/videos"
];

dirs.forEach((dir) => {
  fs.mkdirSync(path.join(process.cwd(), dir), { recursive: true });
});

// Create SVG string helper
function createSvg(title, bg1, bg2, textCol) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}" />
      <stop offset="100%" stop-color="${bg2}" />
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g)" />
  <circle cx="400" cy="300" r="180" fill="white" opacity="0.08" />
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${textCol}" font-family="-apple-system, sans-serif" font-size="28" font-weight="bold">${title}</text>
</svg>`;
}

// Generate wallpaper SVG/WebP placeholders
const wallpapers = [
  { name: "public/assets/wallpapers/design.webp", title: "DESIGN WORKSPACE", bg1: "#E8E2DC", bg2: "#D2C9C0", text: "#4A443E" },
  { name: "public/assets/wallpapers/web.webp", title: "WEB WORKSPACE", bg1: "#DDE4E8", bg2: "#C5D0D8", text: "#38444D" },
  { name: "public/assets/wallpapers/motion-ai.webp", title: "MOTION + AI WORKSPACE", bg1: "#E4DDE8", bg2: "#CBD2DC", text: "#42384D" }
];

wallpapers.forEach((wp) => {
  fs.writeFileSync(path.join(process.cwd(), wp.name), createSvg(wp.title, wp.bg1, wp.bg2, wp.text));
});

// Generate project placeholder files
const projectFiles = [
  "public/assets/projects/fling-arena/preview.webp",
  "public/assets/projects/kixogames/preview.webp",
  "public/assets/projects/planfiq/preview.webp",
  "public/assets/projects/yanarsan-yangin-logo/preview.webp",
  "public/assets/projects/hizir-yangin-logo/preview.webp",
  "public/assets/projects/deva-yangin-logo/preview.webp",
  "public/assets/projects/goobzy-logo/preview.webp",
  "public/assets/projects/ceylanlar-logo/preview.webp",
  "public/assets/projects/emix-logo/preview.webp",
  "public/assets/projects/alchemia/nov-2024.webp",
  "public/assets/projects/alchemia/dec-2024.webp",
  "public/assets/projects/alchemia/jan-2025.webp",
  "public/assets/projects/alchemia/feb-2025.webp",
  "public/assets/projects/alchemia/apr-2025.webp",
  "public/assets/projects/engin-perde/preview.webp",
  "public/assets/projects/sanda-yachting/preview.webp",
  "public/assets/projects/yanarsan-web/preview.webp",
  "public/assets/projects/emix-web/preview.webp",
  "public/assets/projects/kagestudio-web/preview.webp",
  "public/assets/projects/ceylanlar-web/preview.webp",
  "public/assets/projects/deva-web/preview.webp",
  "public/assets/projects/motion-showreel/poster.webp",
  "public/assets/projects/ai-product/preview.webp",
  "public/assets/projects/reels/poster.webp",
  "public/assets/projects/motion-ident/preview.webp"
];

projectFiles.forEach((file) => {
  const baseName = path.basename(path.dirname(file)).toUpperCase();
  fs.writeFileSync(path.join(process.cwd(), file), createSvg(baseName, "#2A2A2A", "#1A1A1A", "#FFFFFF"));
});

console.log("Static asset placeholders generated successfully.");
