/**
 * CareNBuddi brand illustrations.
 *
 * Every image in the product is drawn here as original flat-vector SVG: no
 * stock photography, no external files, no network requests — licensing-clean
 * by construction. The people are drawn with dark skin tones and textured /
 * curly / loc / wrapped hairstyles so the scenes reflect the Black African
 * and Nigerian communities CareNBuddi serves.
 */

import type { ReactNode } from "react";

const BRAND = {
  50: "#EAF7F5",
  100: "#D3EDEA",
  200: "#A6DCD5",
  300: "#65D6C0",
  500: "#129484",
  600: "#0B8778",
  700: "#087F8C",
} as const;

const GREEN = { 100: "#d7eed8", 200: "#b7e0b9", 500: "#4caf50" } as const;

const CORAL = { 100: "#FFE1D9", 200: "#FFC7BA", 500: "#FF7A6B", 700: "#C24834" } as const;

const SLATE = { 200: "#e2e8f0" } as const;

/** Deep to mid-deep African skin tones. */
const SKIN = ["#4c2a13", "#5b3218", "#6b3d1f", "#7b4a27", "#8a5630", "#96623c"] as const;

const HAIR = ["#1a1210", "#241814", "#120c0a", "#2f1f17"] as const;

const INK = "#20140e";

/** Multiplies a hex colour toward black — used for skin and hair shadow. */
function shade(hex: string, amount = 0.18): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount));
  const out = (ch(16) << 16) | (ch(8) << 8) | ch(0);
  return `#${out.toString(16).padStart(6, "0")}`;
}

type Look = "curls" | "locs" | "bun" | "wrap" | "fade";

/** Hair silhouettes drawn in a head-local space (head centre = 0,0, r 26x29). */
function Hair({ look, color }: { look: Look; color: string }) {
  const cap = "M-26 4C-28-16-14-30 0-30S28-16 26 4c-3-12-10-18-26-18S-23-8-26 4Z";
  switch (look) {
    case "locs":
      return (
        <g fill={color}>
          <path d={cap} />
          <rect x="-35" y="-18" width="9" height="30" rx="4.5" />
          <rect x="-25" y="-27" width="9" height="32" rx="4.5" />
          <rect x="16" y="-27" width="9" height="32" rx="4.5" />
          <rect x="26" y="-18" width="9" height="30" rx="4.5" />
        </g>
      );
    case "bun":
      return (
        <g fill={color}>
          <circle cx="0" cy="-31" r="11" />
          <path d={cap} />
        </g>
      );
    case "wrap":
      return (
        <g>
          <path d="M-28 6C-30-18-14-32 0-32S30-18 28 6Z" fill={CORAL[500]} />
          <path d="M-28 6C-30-18-14-32 0-32c6 0 11 2 15 6-9-5-24-4-31 6-4 7-5 17-4 26Z" fill={CORAL[200]} />
          <path d="M26 3c7-3 11-1 13 4 2 5-4 9-12 7Z" fill={CORAL[700]} />
        </g>
      );
    case "fade":
      return <path d={cap} fill={color} />;
    default:
      return (
        <g fill={color}>
          <path d={cap} />
          <circle cx="-23" cy="-9" r="7" />
          <circle cx="-14" cy="-22" r="7.5" />
          <circle cx="0" cy="-27" r="8" />
          <circle cx="14" cy="-22" r="7.5" />
          <circle cx="23" cy="-9" r="7" />
        </g>
      );
  }
}

/** Head-and-shoulders portrait. Shoulder dome spans y 40–86 in local space. */
function Portrait({
  x,
  y,
  s = 1,
  skin,
  look,
  hair,
  top,
  collar,
  edge,
}: {
  x: number;
  y: number;
  s?: number;
  skin: string;
  look: Look;
  hair: string;
  top: string;
  collar?: string;
  edge?: string;
}) {
  const skinShade = shade(skin, 0.17);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M-46 86c0-28 20-46 46-46s46 18 46 46Z"
        fill={top}
        stroke={edge}
        strokeWidth={edge ? 2 : undefined}
      />
      {collar && <path d="M-13 44l13 16 13-16-6-5-7 9-7-9Z" fill={collar} />}
      <path d="M-10 20h20v26H-10Z" fill={skinShade} />
      <circle cx="-25" cy="6" r="5.5" fill={skinShade} />
      <circle cx="25" cy="6" r="5.5" fill={skinShade} />
      <ellipse cx="0" cy="0" rx="26" ry="29" fill={skin} />
      <Hair look={look} color={hair} />
      <g fill={INK}>
        <ellipse cx="-9" cy="2" rx="2.6" ry="3.1" />
        <ellipse cx="9" cy="2" rx="2.6" ry="3.1" />
      </g>
      <path
        d="M-7 13c3.5 3.6 10.5 3.6 14 0"
        fill="none"
        stroke={INK}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </g>
  );
}

function Scene({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={className ?? "h-auto w-full"}
      aria-hidden
      focusable="false"
    >
      <rect width="320" height="240" rx="22" fill={BRAND[50]} />
      {children}
    </svg>
  );
}

function Verified({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="14" fill={BRAND[600]} />
      <path
        d="m-6 0 4.4 4.4L6.4-4.4"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/* ------------------------------------------------------- screen 1 artwork */

export function ConnectedArt({ className }: { className?: string }) {
  return (
    <Scene className={className}>
      <circle cx="40" cy="36" r="18" fill={BRAND[100]} />
      <circle cx="288" cy="200" r="24" fill={BRAND[100]} />
      <circle cx="46" cy="206" r="9" fill={GREEN[200]} />
      <circle cx="282" cy="30" r="10" fill={CORAL[200]} />

      {/* the signal between patient and clinician */}
      <path
        d="M122 104C140 62 180 62 198 104"
        fill="none"
        stroke={BRAND[300]}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="1 10"
      />
      <circle cx="160" cy="80" r="20" fill="#ffffff" />
      <circle cx="160" cy="80" r="20" fill="none" stroke={BRAND[200]} strokeWidth="2" />
      <path
        d="M160 92c-6.8-5.6-11.5-9.8-11.5-15 0-3.6 2.7-6.2 6.1-6.2 2.4 0 4.4 1.4 5.4 3.4 1-2 3-3.4 5.4-3.4 3.4 0 6.1 2.6 6.1 6.2 0 5.2-4.7 9.4-11.5 15Z"
        fill={CORAL[500]}
      />

      {/* patient in a headwrap */}
      <Portrait x={86} y={128} s={1} skin={SKIN[2]} look="wrap" hair={HAIR[0]} top={CORAL[100]} />
      {/* clinician in a white coat with a stethoscope */}
      <Portrait
        x={234}
        y={128}
        s={1}
        skin={SKIN[0]}
        look="curls"
        hair={HAIR[2]}
        top="#ffffff"
        collar={BRAND[500]}
        edge={BRAND[200]}
      />
      <g
        transform="translate(234 178)"
        fill="none"
        stroke={BRAND[600]}
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M-13 0c0 11 5 17 13 17s13-6 13-17" />
        <circle cx="13" cy="25" r="5.5" fill={BRAND[600]} stroke="none" />
      </g>
      <Verified x={272} y={186} />
    </Scene>
  );
}

/* ------------------------------------------------------- screen 2 artwork */

export function FindCareArt({ className }: { className?: string }) {
  return (
    <Scene className={className}>
      <circle cx="34" cy="26" r="16" fill={BRAND[100]} />
      <circle cx="300" cy="222" r="18" fill={GREEN[100]} />
      <circle cx="20" cy="150" r="8" fill={CORAL[200]} />
      <path d="M10 216h300" stroke={BRAND[200]} strokeWidth="3" strokeLinecap="round" />

      {/* location pin */}
      <path
        d="M56 104C43 85 38 77 38 66a18 18 0 1 1 36 0c0 11-5 19-18 38Z"
        fill={CORAL[500]}
      />
      <circle cx="56" cy="66" r="7.5" fill="#ffffff" />

      {/* clinic building */}
      <path d="M162 106 234 68 306 106Z" fill={BRAND[600]} />
      <rect
        x="172"
        y="106"
        width="124"
        height="108"
        rx="10"
        fill="#ffffff"
        stroke={BRAND[200]}
        strokeWidth="2"
      />
      <path d="M229 116h10v8h8v10h-8v8h-10v-8h-8v-10h8Z" fill={GREEN[500]} />
      <rect x="184" y="168" width="30" height="22" rx="5" fill={BRAND[200]} />
      <rect x="264" y="168" width="22" height="22" rx="5" fill={BRAND[200]} />
      <rect x="224" y="170" width="20" height="44" rx="5" fill={BRAND[500]} />

      {/* nurse in scrubs and a headwrap */}
      <Portrait
        x={74}
        y={128}
        s={1}
        skin={SKIN[4]}
        look="wrap"
        hair={HAIR[3]}
        top={GREEN[100]}
        collar={BRAND[500]}
        edge={BRAND[200]}
      />
      <Verified x={112} y={188} />
      <path
        d="M22 196h96"
        stroke={BRAND[300]}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 9"
      />
      <circle cx="150" cy="216" r="5" fill={SLATE[200]} />
      <circle cx="188" cy="216" r="5" fill={SLATE[200]} />
    </Scene>
  );
}

/* ------------------------------------------------------- screen 3 artwork */

export function ManageArt({ className }: { className?: string }) {
  return (
    <Scene className={className}>
      <circle cx="292" cy="30" r="16" fill={BRAND[100]} />
      <circle cx="28" cy="206" r="20" fill={BRAND[100]} />
      <circle cx="300" cy="150" r="7" fill={GREEN[200]} />
      <ellipse cx="160" cy="231" rx="64" ry="8" fill={BRAND[100]} />

      {/* floating health cards */}
      <g transform="rotate(-7 52 62)">
        <rect x="20" y="38" width="64" height="48" rx="13" fill="#ffffff" stroke={BRAND[200]} strokeWidth="2" />
        <path
          d="M52 74c-7.4-6-12.6-10.5-12.6-16.2 0-3.9 2.9-6.7 6.6-6.7 2.6 0 4.8 1.5 6 3.7 1.2-2.2 3.4-3.7 6-3.7 3.7 0 6.6 2.8 6.6 6.7 0 5.7-5.2 10.2-12.6 16.2Z"
          fill={CORAL[500]}
        />
      </g>
      <g transform="rotate(6 266 54)">
        <rect x="234" y="30" width="64" height="48" rx="13" fill="#ffffff" stroke={GREEN[200]} strokeWidth="2" />
        <g transform="rotate(-40 266 54)">
          <rect x="248" y="46" width="36" height="16" rx="8" fill={GREEN[500]} />
          <path d="M266 46h10a8 8 0 0 1 0 16h-10Z" fill={GREEN[100]} />
        </g>
      </g>
      <g transform="rotate(4 270 166)">
        <rect x="236" y="140" width="68" height="52" rx="13" fill="#ffffff" stroke={BRAND[200]} strokeWidth="2" />
        <rect x="250" y="164" width="9" height="16" rx="3" fill={BRAND[200]} />
        <rect x="265" y="154" width="9" height="26" rx="3" fill={BRAND[500]} />
        <rect x="280" y="160" width="9" height="20" rx="3" fill={BRAND[300]} />
      </g>

      {/* patient with locs, hands raised to the cards */}
      <Portrait
        x={160}
        y={146}
        s={1}
        skin={SKIN[1]}
        look="locs"
        hair={HAIR[1]}
        top={BRAND[600]}
        edge={BRAND[700]}
      />
      <path
        d="M120 186c-8 4-13 10-15 17M200 186c8 4 13 10 15 17"
        fill="none"
        stroke={BRAND[700]}
        strokeWidth="6"
        strokeLinecap="round"
      />
    </Scene>
  );
}

/* ----------------------------------------------------- reusable portrait */

const LOOKS: Look[] = ["curls", "locs", "bun", "wrap", "fade"];

export function OnboardingAvatar({
  seed,
  className,
}: {
  seed: number;
  className?: string;
}) {
  const n = Math.abs(Math.floor(seed));
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-brand-100 ${
        className ?? "h-11 w-11"
      }`}
    >
      <svg viewBox="0 0 96 96" className="h-full w-full" aria-hidden focusable="false">
        <rect width="96" height="96" fill={BRAND[50]} />
        <Portrait
          x={48}
          y={50}
          s={1.05}
          skin={SKIN[n % SKIN.length]}
          look={LOOKS[n % LOOKS.length]}
          hair={HAIR[(n + 2) % HAIR.length]}
          top={BRAND[600]}
        />
      </svg>
    </span>
  );
}
