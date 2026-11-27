/**
 * Génère les visuels de démonstration de Upclose (illustrations originales, aucune
 * ressource externe) : couvertures de Moments, avatars fictifs et deux courtes vidéos.
 *
 *   npm run demo:art
 *
 * Les fichiers sont écrits dans public/demo/. Ils peuvent être remplacés par de vraies
 * photos sous licence en gardant les mêmes noms (voir public/demo/CREDITS.md).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "demo");
const W = 1080;
const H = 1350;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const grain = `
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
  <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0"/></filter>
  <filter id="blur40"><feGaussianBlur stdDeviation="40"/></filter>
  <filter id="blur12"><feGaussianBlur stdDeviation="12"/></filter>
  <filter id="blur4"><feGaussianBlur stdDeviation="4"/></filter>`;

const wrap = (defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${grain}${defs}</defs>${body}<rect width="100%" height="100%" filter="url(#grain)"/></svg>`;

type Scene = (r: () => number, v: number) => string;

const scenes: Record<string, Scene> = {
  sunset: (r, v) => {
    const skies = [["#2b1a4f", "#c2457a", "#f59e5b", "#ffd59a"], ["#1d2a5c", "#7b4bb7", "#f27059", "#ffc078"]][v % 2];
    const sunY = 760 + v * 40;
    let waves = "";
    for (let i = 0; i < 26; i++) {
      const y = 880 + i * 18 + i * i * 0.6;
      const w = 80 + r() * 260;
      const x = W / 2 - w / 2 + (r() - 0.5) * 120;
      waves += `<rect x="${x}" y="${y}" width="${w}" height="${3 + i * 0.25}" rx="3" fill="#ffd8a0" opacity="${0.75 - i * 0.025}"/>`;
    }
    return wrap(
      `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${skies[0]}"/><stop offset=".45" stop-color="${skies[1]}"/>
        <stop offset=".75" stop-color="${skies[2]}"/><stop offset="1" stop-color="${skies[3]}"/></linearGradient>
       <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a2d6e"/><stop offset="1" stop-color="#1a1033"/></linearGradient>
       <radialGradient id="sun"><stop offset="0" stop-color="#fff4d6"/><stop offset=".6" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff9e5e"/></radialGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>
       <circle cx="${W / 2}" cy="${sunY}" r="260" fill="#ffb36b" opacity=".45" filter="url(#blur40)"/>
       <circle cx="${W / 2}" cy="${sunY}" r="150" fill="url(#sun)"/>
       <rect y="860" width="${W}" height="${H - 860}" fill="url(#sea)"/>${waves}
       <path d="M0 860 C 200 800 330 790 470 860 Z" fill="#2a163f"/>
       <path d="M${W} 860 C 900 780 760 800 640 860 Z" fill="#2a163f"/>
       <g fill="#1a0f2b" opacity=".9"><circle cx="390" cy="1205" r="34"/><rect x="356" y="1236" width="68" height="120" rx="30"/>
       <circle cx="470" cy="1215" r="30"/><rect x="440" y="1242" width="62" height="110" rx="28"/>
       <circle cx="640" cy="1200" r="33"/><rect x="606" y="1230" width="68" height="125" rx="30"/></g>`,
    );
  },
  dinner: (r, v) => {
    const cloth = ["#3a1f1a", "#1f2a2a"][v % 2];
    let bokeh = "";
    for (let i = 0; i < 16; i++) bokeh += `<circle cx="${r() * W}" cy="${r() * 360}" r="${20 + r() * 50}" fill="#ffcf8a" opacity="${0.12 + r() * 0.25}" filter="url(#blur12)"/>`;
    const plate = (x: number, y: number, food: string) =>
      `<circle cx="${x}" cy="${y}" r="150" fill="#00000040" filter="url(#blur12)"/><circle cx="${x}" cy="${y}" r="140" fill="#f6efe6"/><circle cx="${x}" cy="${y}" r="104" fill="#ede3d6"/>
       <circle cx="${x - 20}" cy="${y - 10}" r="46" fill="${food}"/><circle cx="${x + 34}" cy="${y + 22}" r="30" fill="#7aa05a"/><circle cx="${x + 10}" cy="${y - 44}" r="18" fill="#e8b04a"/>`;
    const glass = (x: number, y: number) =>
      `<circle cx="${x}" cy="${y}" r="54" fill="#ffffff22" stroke="#ffffff55" stroke-width="3"/><circle cx="${x}" cy="${y}" r="36" fill="#7a1530" opacity=".9"/>`;
    return wrap(
      `<radialGradient id="warm" cx=".5" cy=".55" r=".7"><stop offset="0" stop-color="#7a3b22"/><stop offset="1" stop-color="${cloth}"/></radialGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#warm)"/>${bokeh}
       <rect x="80" y="420" width="${W - 160}" height="860" rx="40" fill="#e9ddc9" opacity=".12"/>
       ${plate(330, 640, "#c4553a")}${plate(750, 640, "#d9774a")}${plate(330, 1040, "#b8483c")}${plate(750, 1040, "#cf6d3f")}
       ${glass(540, 520)}${glass(540, 840)}${glass(540, 1160)}
       <circle cx="540" cy="680" r="70" fill="#ffd27a" opacity=".55" filter="url(#blur40)"/><rect x="528" y="660" width="24" height="70" rx="6" fill="#f7efe1"/>
       <ellipse cx="540" cy="652" rx="9" ry="16" fill="#ffe2a0"/>`,
    );
  },
  coffee: (r, v) => {
    const bg = ["#d9c4a8", "#c9d3cc"][v % 2];
    return wrap(
      `<radialGradient id="cup" cx=".45" cy=".4"><stop offset="0" stop-color="#d9a46c"/><stop offset=".55" stop-color="#9b5c2e"/><stop offset="1" stop-color="#5b3018"/></radialGradient>`,
      `<rect width="${W}" height="${H}" fill="${bg}"/>
       <rect x="-40" y="980" width="${W + 80}" height="420" fill="#00000012"/>
       <circle cx="560" cy="640" r="330" fill="#00000030" filter="url(#blur40)"/>
       <circle cx="540" cy="620" r="320" fill="#f7f2ea"/><circle cx="540" cy="620" r="250" fill="#efe7db"/>
       <circle cx="540" cy="620" r="190" fill="#fbfaf7"/><circle cx="540" cy="620" r="160" fill="url(#cup)"/>
       <path d="M540 700 C 470 640 470 560 540 590 C 610 560 610 640 540 700 Z" fill="#f4e4cc" opacity=".92"/>
       <path d="M540 640 C 505 610 505 575 540 590" fill="none" stroke="#c48b57" stroke-width="5"/>
       <rect x="740" y="590" width="160" height="56" rx="28" fill="#fbfaf7"/>
       <g transform="translate(250 1090) rotate(-18)"><path d="M0 0 C 60 -90 220 -90 280 0 C 220 40 60 40 0 0 Z" fill="#d8933f"/>
       <path d="M60 -40 L 90 20 M120 -58 L 135 26 M185 -55 L 175 26" stroke="#a8621f" stroke-width="8" stroke-linecap="round"/></g>
       <rect x="660" y="1020" width="300" height="200" rx="18" fill="#2d2a27" opacity=".85"/><rect x="690" y="1050" width="160" height="12" rx="6" fill="#f0e6d6" opacity=".7"/>
       <rect x="690" y="1080" width="220" height="12" rx="6" fill="#f0e6d6" opacity=".45"/>`,
    );
  },
  gallery: (r, v) => {
    const wall = ["#efeae3", "#e6e9ec"][v % 2];
    const pal = [["#e85d4a", "#264653", "#e9c46a", "#2a9d8f"], ["#6c5ce7", "#fd79a8", "#00b894", "#2d3436"]][v % 2];
    const art = (x: number, y: number, w: number, h: number) => {
      let inner = "";
      for (let i = 0; i < 4; i++) {
        inner += `<rect x="${x + 20 + r() * (w - 120)}" y="${y + 20 + r() * (h - 120)}" width="${60 + r() * 120}" height="${60 + r() * 140}" fill="${pal[i]}" opacity=".9" rx="${r() > 0.5 ? 100 : 4}"/>`;
      }
      return `<rect x="${x - 14}" y="${y - 14}" width="${w + 28}" height="${h + 28}" fill="#1c1c1c"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#faf8f5"/>${inner}
              <rect x="${x - 14}" y="${y + h + 14}" width="${w + 28}" height="30" fill="#00000014" filter="url(#blur12)"/>`;
    };
    return wrap(
      `<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9a088"/><stop offset="1" stop-color="#8a705a"/></linearGradient>`,
      `<rect width="${W}" height="${H}" fill="${wall}"/>
       <ellipse cx="300" cy="200" rx="260" ry="120" fill="#fff" opacity=".6" filter="url(#blur40)"/>
       <ellipse cx="800" cy="200" rx="260" ry="120" fill="#fff" opacity=".6" filter="url(#blur40)"/>
       ${art(110, 300, 380, 500)}${art(600, 380, 370, 340)}
       <rect y="1000" width="${W}" height="${H - 1000}" fill="url(#floor)"/>
       <rect x="330" y="1080" width="420" height="40" rx="8" fill="#2b2b2b"/><rect x="360" y="1120" width="20" height="90" fill="#2b2b2b"/><rect x="700" y="1120" width="20" height="90" fill="#2b2b2b"/>
       <g fill="#262626"><circle cx="870" cy="830" r="38"/><rect x="830" y="866" width="80" height="250" rx="36"/></g>`,
    );
  },
  walk: (r, v) => {
    const sky = [["#a7d3e8", "#f6e3c4"], ["#f3c7a6", "#f9e8d2"]][v % 2];
    return wrap(
      `<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#s)"/>
       <circle cx="800" cy="300" r="90" fill="#fff6dc" opacity=".9"/>
       <path d="M0 640 C 220 520 420 600 620 540 C 820 480 960 560 1080 520 L1080 1350 L0 1350 Z" fill="#8fb39b"/>
       <path d="M0 760 C 260 660 480 760 700 690 C 880 640 980 700 1080 680 L1080 1350 L0 1350 Z" fill="#5f8f72"/>
       <path d="M0 900 C 300 820 560 920 820 860 C 940 830 1010 850 1080 840 L1080 1350 L0 1350 Z" fill="#3f6e55"/>
       <path d="M470 1350 C 520 1150 640 1000 600 880 C 590 860 560 850 540 860 C 560 980 420 1150 300 1350 Z" fill="#e7d3b0"/>
       <g fill="#26402f">${[120, 210, 860, 960].map((x, i) => `<path d="M${x} ${980 - i * 10} l40 -170 l40 170 z"/>`).join("")}</g>
       <g fill="#2b2b2b"><circle cx="560" cy="930" r="14"/><rect x="548" y="944" width="24" height="56" rx="10"/><circle cx="600" cy="925" r="13"/><rect x="589" y="938" width="22" height="58" rx="10"/></g>`,
    );
  },
  sport: (r, v) => {
    const base = ["#0f5257", "#1b3a5c"][v % 2];
    let lanes = "";
    for (let i = 0; i < 7; i++) lanes += `<path d="M${-200 + i * 140} 1350 L ${380 + i * 55} 760" stroke="#ffffff" stroke-opacity=".55" stroke-width="6"/>`;
    return wrap(
      `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb877"/><stop offset=".5" stop-color="#ff7e67"/><stop offset="1" stop-color="${base}"/></linearGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="700" cy="560" r="130" fill="#ffe6b0" opacity=".9"/>
       <rect y="760" width="${W}" height="590" fill="#c4553a"/>${lanes}
       <path d="M0 760 L1080 760" stroke="#ffd9b0" stroke-width="4"/>
       <g fill="#1d1d1d" transform="translate(470 860)"><circle cx="40" cy="0" r="30"/>
       <path d="M30 30 L10 140 L-40 200 M10 140 L70 200 L60 270 M30 50 L-30 100 M30 50 L90 80" stroke="#1d1d1d" stroke-width="26" stroke-linecap="round" fill="none"/></g>`,
    );
  },
  party: (r, v) => {
    const cols = [["#ff4d8d", "#7c4dff", "#00e5ff", "#ffd166"], ["#ff6b6b", "#c77dff", "#48cae4", "#ffbe0b"]][v % 2];
    let b = "";
    for (let i = 0; i < 46; i++) b += `<circle cx="${r() * W}" cy="${r() * H * 0.75}" r="${14 + r() * 70}" fill="${cols[i % 4]}" opacity="${0.18 + r() * 0.5}" filter="url(#blur${r() > 0.5 ? 12 : 4})"/>`;
    let crowd = "";
    for (let i = 0; i < 14; i++) {
      const x = i * 82 + r() * 30;
      const y = 1080 + r() * 60;
      crowd += `<circle cx="${x}" cy="${y}" r="${34 + r() * 10}"/><rect x="${x - 48}" y="${y + 30}" width="96" height="300" rx="44"/>`;
      if (r() > 0.6) crowd += `<rect x="${x + 10}" y="${y - 160}" width="22" height="150" rx="11" transform="rotate(${-20 + r() * 40} ${x} ${y})"/>`;
    }
    return wrap(
      `<radialGradient id="g" cx=".5" cy=".3"><stop offset="0" stop-color="#3a1460"/><stop offset="1" stop-color="#0b0614"/></radialGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#g)"/>${b}
       <circle cx="540" cy="180" r="70" fill="#d9d9e6"/><circle cx="540" cy="180" r="70" fill="none" stroke="#fff" stroke-opacity=".5" stroke-dasharray="10 8" stroke-width="40"/>
       <path d="M540 180 L 200 900 L 360 900 Z" fill="${cols[0]}" opacity=".16"/><path d="M540 180 L 860 900 L 700 900 Z" fill="${cols[2]}" opacity=".16"/>
       <g fill="#08040f">${crowd}</g>`,
    );
  },
  drinks: (r, v) => {
    const sky = [["#1b1f4b", "#6a3d8f", "#f08a5d"], ["#0f2741", "#3b5e8c", "#f4a259"]][v % 2];
    let city = "";
    let x = 0;
    while (x < W) {
      const w = 60 + r() * 110;
      const h = 180 + r() * 380;
      city += `<rect x="${x}" y="${900 - h}" width="${w}" height="${h + 10}" fill="#14112a"/>`;
      for (let wy = 900 - h + 20; wy < 880; wy += 34) for (let wx = x + 12; wx < x + w - 14; wx += 26) if (r() > 0.55) city += `<rect x="${wx}" y="${wy}" width="10" height="14" fill="#ffd98a" opacity=".8"/>`;
      x += w + 6;
    }
    let lights = "";
    for (let i = 0; i <= 20; i++) {
      const lx = i * 54;
      const ly = 160 + Math.sin((i / 20) * Math.PI) * 120;
      lights += `<circle cx="${lx}" cy="${ly}" r="9" fill="#ffe3a3"/><circle cx="${lx}" cy="${ly}" r="26" fill="#ffd27a" opacity=".35" filter="url(#blur12)"/>`;
    }
    return wrap(
      `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".55" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       <path d="M0 160 Q 540 400 1080 160" stroke="#2a2340" stroke-width="3" fill="none"/>${lights}${city}
       <rect y="900" width="${W}" height="450" fill="#231a35"/><rect y="900" width="${W}" height="16" fill="#3a2d52"/>
       <g transform="translate(360 960)"><path d="M0 0 L 180 0 L 90 150 Z" fill="#ff8fab" opacity=".85"/><rect x="84" y="148" width="12" height="150" fill="#f1e9ff" opacity=".8"/>
       <ellipse cx="90" cy="300" rx="70" ry="12" fill="#f1e9ff" opacity=".8"/><circle cx="150" cy="-10" r="22" fill="#9ef01a"/></g>
       <g transform="translate(600 980)"><rect x="0" y="0" width="120" height="220" rx="14" fill="#ffd166" opacity=".8"/><rect x="0" y="0" width="120" height="50" rx="14" fill="#fff8e6" opacity=".9"/></g>`,
    );
  },
  brunch: (r, v) => {
    const bg = ["#f4ede4", "#eef3ea"][v % 2];
    const fruit = ["#e63946", "#f4a261", "#2a9d8f", "#9b5de5", "#ffbe0b", "#e76f51"];
    let bowls = "";
    for (const [cx, cy] of [[300, 420], [780, 470], [520, 860], [260, 1120], [820, 1100]]) {
      bowls += `<circle cx="${cx + 12}" cy="${cy + 16}" r="160" fill="#00000020" filter="url(#blur12)"/><circle cx="${cx}" cy="${cy}" r="150" fill="#ffffff"/><circle cx="${cx}" cy="${cy}" r="118" fill="#f7efe2"/>`;
      for (let i = 0; i < 9; i++) bowls += `<circle cx="${cx + (r() - 0.5) * 150}" cy="${cy + (r() - 0.5) * 150}" r="${18 + r() * 22}" fill="${fruit[Math.floor(r() * fruit.length)]}"/>`;
    }
    return wrap("", `<rect width="${W}" height="${H}" fill="${bg}"/>
      <rect x="60" y="80" width="${W - 120}" height="${H - 160}" rx="40" fill="#e8dccb" opacity=".35"/>${bowls}
      <g transform="translate(560 640) rotate(20)"><rect width="220" height="26" rx="13" fill="#c9b79c"/></g>`);
  },
  boat: (r, v) => {
    const sky = [["#7ec8e3", "#d9f1f7"], ["#ffcdb2", "#ffe5d9"]][v % 2];
    let glints = "";
    for (let i = 0; i < 40; i++) glints += `<rect x="${r() * W}" y="${820 + r() * 500}" width="${30 + r() * 90}" height="4" rx="2" fill="#ffffff" opacity="${0.25 + r() * 0.5}"/>`;
    return wrap(
      `<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
       <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a9dbb"/><stop offset="1" stop-color="#0b4f6c"/></linearGradient>`,
      `<rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="260" cy="260" r="90" fill="#fff6e0"/>
       <path d="M640 800 C 760 770 900 790 1080 760 L1080 800 Z" fill="#7aa6b8"/>
       <rect y="800" width="${W}" height="550" fill="url(#sea)"/>${glints}
       <g transform="translate(330 420)"><path d="M180 0 L180 420 L 20 420 Z" fill="#fffaf2"/><path d="M200 60 L200 420 L 360 420 Z" fill="#f2e8da"/>
       <rect x="184" y="-10" width="12" height="450" fill="#5b4636"/>
       <path d="M-40 440 L 420 440 L 360 520 L 20 520 Z" fill="#f6f1ea"/><path d="M-40 440 L 420 440 L 410 456 L -30 456 Z" fill="#d1495b"/></g>`,
    );
  },
  other: (r, v) => {
    const cols = [["#f72585", "#7209b7", "#3a0ca3"], ["#ff9f1c", "#e71d36", "#2ec4b6"]][v % 2];
    let blobs = "";
    for (let i = 0; i < 6; i++) blobs += `<circle cx="${r() * W}" cy="${r() * H}" r="${200 + r() * 260}" fill="${cols[i % 3]}" opacity=".55" filter="url(#blur40)"/>`;
    return wrap("", `<rect width="${W}" height="${H}" fill="#1a1027"/>${blobs}`);
  },
};

// Avatars : illustrations abstraites (pas de faux visages), clairement fictives.
const avatarPalettes = [
  ["#ff8fab", "#7b2cbf"], ["#ffd166", "#ef476f"], ["#06d6a0", "#118ab2"], ["#f4a261", "#2a9d8f"],
  ["#c77dff", "#3a0ca3"], ["#90e0ef", "#0077b6"], ["#ffb4a2", "#6d6875"], ["#b5e48c", "#168aad"],
];

function avatarSvg(initials: string, i: number) {
  const [a, b] = avatarPalettes[i % avatarPalettes.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="512" height="512" fill="url(#g)"/>
    <circle cx="${120 + (i * 53) % 280}" cy="${110 + (i * 97) % 260}" r="${120 + (i % 3) * 30}" fill="#ffffff" opacity=".14"/>
    <text x="256" y="300" text-anchor="middle" font-family="Georgia, 'DejaVu Serif', serif" font-size="190" fill="#fff" opacity=".95">${initials}</text>
  </svg>`;
}

export const demoPeople = [
  ["lea", "Léa M."], ["karim", "Karim B."], ["sofia", "Sofía R."], ["noah", "Noah K."], ["ines", "Inès D."],
  ["marco", "Marco T."], ["yael", "Yaël S."], ["lucas", "Lucas P."], ["amira", "Amira H."], ["hugo", "Hugo L."],
  ["elena", "Elena V."], ["tom", "Tom W."], ["nadia", "Nadia Z."], ["jules", "Jules F."], ["maya", "Maya C."],
  ["david", "David A."],
] as const;

async function main() {
  for (const dir of ["moments", "people", "video"]) mkdirSync(path.join(OUT, dir), { recursive: true });

  let seed = 7;
  for (const [name, scene] of Object.entries(scenes)) {
    for (const v of [0, 1]) {
      const svg = scene(rng(seed++ * 7919), v);
      const file = path.join(OUT, "moments", `${name}-${v + 1}.webp`);
      await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(file);
      console.log("✓", path.relative(process.cwd(), file));
    }
  }

  for (const [i, [slug, name]] of demoPeople.entries()) {
    const initials = name.split(" ").map((p) => p[0]).join("").replace(".", "");
    const file = path.join(OUT, "people", `${slug}.webp`);
    await sharp(Buffer.from(avatarSvg(initials, i))).resize(256, 256).webp({ quality: 85 }).toFile(file);
  }
  console.log(`✓ ${demoPeople.length} avatars`);

  // Deux vidéos courtes (lent travelling) à partir des illustrations, si ffmpeg est disponible.
  const hasFfmpeg = (() => {
    try {
      execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();
  for (const name of ["sunset-1", "party-1"]) {
    const src = path.join(OUT, "moments", `${name}.webp`);
    const png = path.join(OUT, "video", `${name}.png`);
    const mp4 = path.join(OUT, "video", `${name}.mp4`);
    const poster = path.join(OUT, "video", `${name}-poster.webp`);
    await sharp(src).resize(720, 900).webp({ quality: 80 }).toFile(poster);
    if (!hasFfmpeg) {
      console.warn("ffmpeg absent : vidéo", name, "non générée (le poster sert de repli).");
      continue;
    }
    await sharp(src).resize(1440, 1800).png().toFile(png);
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-loop", "1", "-i", png,
      "-vf", "zoompan=z='min(zoom+0.0009,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=720x900:fps=25,format=yuv420p",
      "-t", "6", "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-movflags", "+faststart", "-an", mp4,
    ]);
    if (existsSync(png)) unlinkSync(png);
    console.log("✓", path.relative(process.cwd(), mp4));
  }

  writeFileSync(
    path.join(OUT, "CREDITS.md"),
    `# Visuels de démonstration

Tous les visuels de ce dossier sont des illustrations originales générées par
\`scripts/generate-demo-art.ts\` (aucune image externe, aucun droit tiers).
Les avatars sont volontairement abstraits : les profils de démo sont fictifs.

Pour utiliser de vraies photos : remplacer les fichiers en gardant les mêmes noms,
avec une licence qui autorise l'usage commercial, et ajouter le crédit ici.
`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
