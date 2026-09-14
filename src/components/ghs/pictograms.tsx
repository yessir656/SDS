"use client";

// ============================================================================
// GHS Hazard Pictogram Components
// Renders the 9 standard GHS pictograms as inline SVG.
// Each pictogram is a red-bordered diamond with a black symbol on white.
// ============================================================================

import type { GhsPictogram as GhsPictogramType } from "@/types";
import { GHS_PICTOGRAM_INFO } from "@/types";
import { cn } from "@/lib/utils";

const RED = "#d63522";
const BLACK = "#1a1a1a";
const WHITE = "#ffffff";

// ---------------------------------------------------------------------------
// Diamond frame (shared by all pictograms)
// ---------------------------------------------------------------------------

function Diamond({ children }: { children: React.ReactNode }) {
  return (
    <>
      <polygon
        points="50,3 97,50 50,97 3,50"
        fill={WHITE}
        stroke={RED}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {children}
    </>
  );
}

// ---------------------------------------------------------------------------
// Individual pictogram symbols
// ---------------------------------------------------------------------------

function ExplodingBombSymbol() {
  return (
    <g>
      {/* bomb body */}
      <circle cx="42" cy="62" r="15" fill={BLACK} />
      {/* fuse stem */}
      <path
        d="M 50 48 Q 56 40 60 34"
        stroke={BLACK}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* explosion burst */}
      <g stroke={BLACK} strokeWidth="2.5" strokeLinecap="round">
        <line x1="60" y1="34" x2="56" y2="26" />
        <line x1="60" y1="34" x2="65" y2="27" />
        <line x1="60" y1="34" x2="68" y2="36" />
        <line x1="60" y1="34" x2="55" y2="35" />
      </g>
      {/* spark dot */}
      <circle cx="60" cy="34" r="2.5" fill={BLACK} />
    </g>
  );
}

function FlameSymbol() {
  return (
    <path
      d="M 50 22 C 54 32 62 36 62 52 C 62 66 56 76 50 76 C 44 76 38 66 38 52 C 38 42 42 38 46 32 C 47 36 48 38 50 40 C 50 34 50 28 50 22 Z"
      fill={BLACK}
    />
  );
}

function FlameOnCircleSymbol() {
  return (
    <g>
      {/* flame on top */}
      <path
        d="M 50 22 C 53 30 58 33 58 44 C 58 53 54 59 50 59 C 46 59 42 53 42 44 C 42 38 44 35 47 31 C 48 34 49 35 50 37 C 50 32 50 27 50 22 Z"
        fill={BLACK}
      />
      {/* ring / circle beneath */}
      <ellipse
        cx="50"
        cy="74"
        rx="14"
        ry="5"
        fill="none"
        stroke={BLACK}
        strokeWidth="3"
      />
    </g>
  );
}

function GasCylinderSymbol() {
  return (
    <g>
      {/* valve/neck on top */}
      <rect x="45" y="22" width="10" height="8" fill={BLACK} />
      <rect x="47" y="18" width="6" height="5" fill={BLACK} />
      {/* tank body with rounded shoulders */}
      <path
        d="M 38 34 L 38 78 Q 38 82 42 82 L 58 82 Q 62 82 62 78 L 62 34 Q 62 30 56 30 L 44 30 Q 38 30 38 34 Z"
        fill={BLACK}
      />
    </g>
  );
}

function CorrosionSymbol() {
  return (
    <g>
      {/* left test tube (vertical) */}
      <rect x="33" y="24" width="10" height="18" rx="2" fill="none" stroke={BLACK} strokeWidth="2.5" />
      {/* liquid */}
      <rect x="34.5" y="33" width="7" height="7.5" fill={BLACK} />
      {/* right test tube (vertical) */}
      <rect x="57" y="24" width="10" height="18" rx="2" fill="none" stroke={BLACK} strokeWidth="2.5" />
      <rect x="58.5" y="33" width="7" height="7.5" fill={BLACK} />
      {/* pouring liquid left */}
      <path d="M 33 42 L 29 52 L 35 55 L 31 61" stroke={BLACK} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* pouring liquid right */}
      <path d="M 65 42 L 68 46 L 64 47 L 65 50" stroke={BLACK} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* metal bar (left surface) */}
      <rect x="28" y="62" width="18" height="5" fill={BLACK} />
      {/* hand (right surface) - simplified mitten shape */}
      <path
        d="M 52 56 L 52 67 Q 52 71 56 71 L 68 71 Q 72 71 72 67 L 72 56 Q 72 52 68 52 L 64 52 L 64 48 Q 64 46 62 46 Q 60 46 60 48 L 60 52 L 58 52 L 58 46 Q 58 44 56 44 Q 54 44 54 46 L 54 52 Q 52 52 52 56 Z"
        fill={BLACK}
      />
    </g>
  );
}

function SkullAndCrossbonesSymbol() {
  return (
    <g>
      {/* skull */}
      <path
        d="M 34 44 Q 34 28 50 28 Q 66 28 66 44 L 66 54 Q 66 58 62 58 L 62 64 L 38 64 L 38 58 Q 34 58 34 54 Z"
        fill={BLACK}
      />
      {/* eye sockets */}
      <circle cx="42" cy="46" r="4" fill={WHITE} />
      <circle cx="58" cy="46" r="4" fill={WHITE} />
      {/* nose */}
      <polygon points="50,50 47,56 53,56" fill={WHITE} />
      {/* teeth gap */}
      <rect x="42" y="60" width="16" height="4" fill={WHITE} />
      {/* crossed bones */}
      <g stroke={BLACK} strokeWidth="3.5" strokeLinecap="round">
        <line x1="36" y1="73" x2="64" y2="65" />
        <line x1="36" y1="65" x2="64" y2="73" />
      </g>
      {/* bone ends */}
      <circle cx="36" cy="73" r="3.5" fill={BLACK} />
      <circle cx="36" cy="65" r="3.5" fill={BLACK} />
      <circle cx="64" cy="73" r="3.5" fill={BLACK} />
      <circle cx="64" cy="65" r="3.5" fill={BLACK} />
    </g>
  );
}

function ExclamationMarkSymbol() {
  return (
    <g fill={BLACK}>
      {/* stem */}
      <rect x="46" y="28" width="8" height="34" rx="4" />
      {/* dot */}
      <circle cx="50" cy="72" r="5" />
    </g>
  );
}

function HealthHazardSymbol() {
  return (
    <g>
      {/* torso/chest silhouette */}
      <path
        d="M 34 76 L 34 60 Q 34 48 42 44 Q 42 36 50 36 Q 58 36 58 44 Q 66 48 66 60 L 66 76 Z"
        fill={BLACK}
      />
      {/* starburst (6-pointed asterisk) on chest */}
      <g stroke={WHITE} strokeWidth="2.5" strokeLinecap="round">
        <line x1="50" y1="50" x2="50" y2="64" />
        <line x1="44" y1="53" x2="56" y2="61" />
        <line x1="56" y1="53" x2="44" y2="61" />
        <line x1="43" y1="57" x2="57" y2="57" />
      </g>
    </g>
  );
}

function EnvironmentSymbol() {
  return (
    <g>
      {/* bare tree trunk + branches */}
      <path
        d="M 48 70 L 48 48 M 48 48 L 42 38 M 48 48 L 54 38 M 48 56 L 43 50 M 48 56 L 53 50"
        stroke={BLACK}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* dead fish beneath */}
      <g>
        <ellipse cx="50" cy="76" rx="11" ry="5" fill={BLACK} />
        <polygon points="59,76 64,72 64,80" fill={BLACK} />
        {/* eye */}
        <circle cx="44" cy="74" r="1.5" fill={WHITE} />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Symbol resolver
// ---------------------------------------------------------------------------

function PictogramSymbol({ pictogram }: { pictogram: GhsPictogramType }) {
  switch (pictogram) {
    case "exploding-bomb":
      return <ExplodingBombSymbol />;
    case "flame":
      return <FlameSymbol />;
    case "flame-on-circle":
      return <FlameOnCircleSymbol />;
    case "gas":
      return <GasCylinderSymbol />;
    case "corrosion":
      return <CorrosionSymbol />;
    case "skull-and-crossbones":
      return <SkullAndCrossbonesSymbol />;
    case "exclamation-mark":
      return <ExclamationMarkSymbol />;
    case "health-hazard":
      return <HealthHazardSymbol />;
    case "environment":
      return <EnvironmentSymbol />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public components
// ---------------------------------------------------------------------------

interface GhsPictogramProps {
  pictogram: GhsPictogramType;
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Renders a single GHS hazard pictogram as an accessible inline SVG.
 */
export function GhsPictogram({
  pictogram,
  size = 64,
  className,
  title,
}: GhsPictogramProps) {
  const info = GHS_PICTOGRAM_INFO[pictogram];
  const resolvedTitle = title ?? info.label;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={resolvedTitle}
      className={cn("inline-block shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{resolvedTitle}</title>
      <Diamond>
        <PictogramSymbol pictogram={pictogram} />
      </Diamond>
    </svg>
  );
}

interface GhsPictogramBadgeProps {
  pictogram: GhsPictogramType;
  size?: number;
  showLabel?: boolean;
  className?: string;
}

/**
 * Renders a GHS pictogram with its label text below — suitable for grids
 * and detail views where the hazard name must accompany the symbol.
 */
export function GhsPictogramBadge({
  pictogram,
  size = 64,
  showLabel = true,
  className,
}: GhsPictogramBadgeProps) {
  const info = GHS_PICTOGRAM_INFO[pictogram];

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 text-center",
        className
      )}
    >
      <GhsPictogram pictogram={pictogram} size={size} />
      {showLabel && (
        <span className="max-w-[7rem] text-xs font-medium leading-tight text-foreground/80">
          {info.label}
        </span>
      )}
    </div>
  );
}
