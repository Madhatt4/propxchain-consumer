/**
 * Discord-style hero showcase: laptop + phone mockups showing the PropXchain
 * dashboard with floating property-themed elements around them.
 * Pure CSS — no WebGL dependency.
 */

const STAGE_ITEMS = [
  { icon: '🏠', label: 'List Property', status: 'done' },
  { icon: '🔍', label: 'AML / KYC', status: 'done' },
  { icon: '📋', label: 'Searches', status: 'active' },
  { icon: '📄', label: 'Property Info', status: 'locked' },
  { icon: '⚖️', label: 'Conveyancer', status: 'locked' },
  { icon: '✍️', label: 'Exchange', status: 'locked' },
];

/**
 * Theme CSS variables — dark by default, overridden under .lp.light-mode.
 * The component sits inside a `.lp` wrapper on LandingPage, so these
 * variables cascade automatically when the user toggles light mode.
 */
const themeStyles = `
  .hs-root {
    --hs-bezel: #1a1a2e;
    --hs-bezel-border: #2a2a4a;
    --hs-chrome: #0f0f1e;
    --hs-screen: #060b18;
    --hs-stage-bg: rgba(255,255,255,0.02);
    --hs-stage-border: rgba(255,255,255,0.06);
    --hs-stage-locked-text: #4b5563;
    --hs-stage-text: #d1d5db;
    --hs-text-strong: #e5e7eb;
    --hs-text-muted: #6b7280;
    --hs-text-faint: #4b5563;
    --hs-text-soft: #9ca3af;
    --hs-card-bg: rgba(26,37,64,0.6);
    --hs-card-border: rgba(0,212,184,0.12);
    --hs-progress-track: #1a2540;
    --hs-base-from: #2a2a4a;
    --hs-base-to: #1a1a2e;
    --hs-base-line: #3a3a5a;
    --hs-row-border: rgba(255,255,255,0.04);
    --hs-badge-bg: rgba(26,37,64,0.9);
    --hs-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,212,184,0.08);
    --hs-phone-shadow: 0 16px 40px rgba(0,0,0,0.4), 0 0 20px rgba(0,212,184,0.06);
    --hs-glow: rgba(0,212,184,0.1);
    --hs-teal: #00d4b8;
  }
  .lp.light-mode .hs-root {
    --hs-bezel: #ffffff;
    --hs-bezel-border: #d1d5db;
    --hs-chrome: #f3f4f6;
    --hs-screen: #f8fafc;
    --hs-stage-bg: rgba(0,0,0,0.02);
    --hs-stage-border: rgba(0,0,0,0.06);
    --hs-stage-locked-text: #9ca3af;
    --hs-stage-text: #374151;
    --hs-text-strong: #1a1a2e;
    --hs-text-muted: #6b7280;
    --hs-text-faint: #9ca3af;
    --hs-text-soft: #4b5563;
    --hs-card-bg: rgba(255,255,255,0.8);
    --hs-card-border: rgba(0,168,150,0.2);
    --hs-progress-track: #e5e7eb;
    --hs-base-from: #d1d5db;
    --hs-base-to: #9ca3af;
    --hs-base-line: #6b7280;
    --hs-row-border: rgba(0,0,0,0.05);
    --hs-badge-bg: rgba(255,255,255,0.95);
    --hs-shadow: 0 20px 60px rgba(0,0,0,0.12), 0 0 40px rgba(0,168,150,0.08);
    --hs-phone-shadow: 0 16px 40px rgba(0,0,0,0.1), 0 0 20px rgba(0,168,150,0.06);
    --hs-glow: rgba(0,168,150,0.12);
    --hs-teal: #00a896;
  }
`;

function MiniStage({ icon, label, status }: { icon: string; label: string; status: string }): React.ReactElement {
  const colors: Record<string, { bg: string; border: string; dot: string }> = {
    done: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', dot: '#10b981' },
    active: { bg: 'rgba(0,212,184,0.1)', border: 'rgba(0,212,184,0.4)', dot: 'var(--hs-teal)' },
    locked: { bg: 'var(--hs-stage-bg)', border: 'var(--hs-stage-border)', dot: 'var(--hs-stage-locked-text)' },
  };
  const c = colors[status] ?? colors.locked;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6,
      borderLeft: status === 'active' ? '3px solid var(--hs-teal)' : undefined,
    }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: 10, color: status === 'locked' ? 'var(--hs-stage-locked-text)' : 'var(--hs-stage-text)', fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>{label}</span>
      <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
    </div>
  );
}

function LaptopMockup(): React.ReactElement {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 520 }}>
      {/* Screen bezel */}
      <div style={{
        background: 'var(--hs-bezel)', borderRadius: '12px 12px 0 0', border: '2px solid var(--hs-bezel-border)',
        padding: 8, boxShadow: 'var(--hs-shadow)',
      }}>
        {/* Browser chrome */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
          background: 'var(--hs-chrome)', borderRadius: '8px 8px 0 0', borderBottom: '1px solid var(--hs-bezel-border)',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <div style={{
            flex: 1, margin: '0 8px', padding: '3px 10px', background: 'var(--hs-bezel)',
            borderRadius: 4, fontSize: 9, color: 'var(--hs-text-muted)', fontFamily: "'DM Mono',monospace",
          }}>
            propxchain.com/transaction/flow
          </div>
        </div>
        {/* Dashboard content */}
        <div style={{ background: 'var(--hs-screen)', padding: 14, minHeight: 260, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Left: stages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 8, color: 'var(--hs-text-muted)', fontFamily: "'DM Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Seller Journey
            </div>
            {STAGE_ITEMS.map((s) => (
              <MiniStage key={s.label} {...s} />
            ))}
          </div>
          {/* Right: property card + progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Property card */}
            <div style={{
              background: 'var(--hs-card-bg)', border: '1px solid var(--hs-card-border)',
              borderRadius: 6, padding: 10,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--hs-text-strong)', fontFamily: "'DM Sans',sans-serif" }}>14 Maple Close</div>
              <div style={{ fontSize: 8, color: 'var(--hs-text-muted)', fontFamily: "'DM Mono',monospace", marginTop: 2 }}>Bedford, MK41 7QR</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 8, padding: '2px 6px', background: 'rgba(0,212,184,0.12)', color: 'var(--hs-teal)', borderRadius: 3, fontFamily: "'DM Mono',monospace" }}>3 bed</span>
                <span style={{ fontSize: 8, padding: '2px 6px', background: 'rgba(0,212,184,0.12)', color: 'var(--hs-teal)', borderRadius: 3, fontFamily: "'DM Mono',monospace" }}>Semi</span>
              </div>
            </div>
            {/* Progress ring */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="var(--hs-progress-track)" strokeWidth="4" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="var(--hs-teal)" strokeWidth="4"
                  strokeDasharray="125.6" strokeDashoffset="83.7" strokeLinecap="round"
                  transform="rotate(-90 24 24)" />
                <text x="24" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--hs-teal)" fontFamily="Fraunces,serif">33%</text>
              </svg>
              <div>
                <div style={{ fontSize: 9, color: 'var(--hs-text-soft)', fontFamily: "'DM Sans',sans-serif" }}>Stage 3 of 8</div>
                <div style={{ fontSize: 8, color: 'var(--hs-teal)', fontFamily: "'DM Mono',monospace", marginTop: 2 }}>Searches in progress</div>
              </div>
            </div>
            {/* Chain badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
              background: 'rgba(0,212,184,0.06)', border: '1px solid rgba(0,212,184,0.15)', borderRadius: 6,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--hs-teal)', animation: 'lp-pulse 2s ease-in-out infinite' }} />
              <span style={{ fontSize: 8, color: 'var(--hs-teal)', fontFamily: "'DM Mono',monospace", letterSpacing: '0.05em' }}>ICP Mainnet</span>
              <span style={{ fontSize: 7, color: 'var(--hs-text-faint)', fontFamily: "'DM Mono',monospace", marginLeft: 'auto' }}>Block 4,291,847</span>
            </div>
          </div>
        </div>
      </div>
      {/* Laptop base */}
      <div style={{
        height: 14, background: 'linear-gradient(to bottom, var(--hs-base-from), var(--hs-base-to))',
        borderRadius: '0 0 4px 4px', margin: '0 -4px',
      }}>
        <div style={{ width: 80, height: 4, background: 'var(--hs-base-line)', borderRadius: 2, margin: '0 auto', position: 'relative', top: 5 }} />
      </div>
    </div>
  );
}

function PhoneMockup(): React.ReactElement {
  return (
    <div style={{
      width: 120, background: 'var(--hs-bezel)', borderRadius: 16, border: '2px solid var(--hs-bezel-border)',
      padding: 6, boxShadow: 'var(--hs-phone-shadow)',
    }}>
      {/* Notch */}
      <div style={{ width: 40, height: 4, background: 'var(--hs-bezel-border)', borderRadius: 4, margin: '2px auto 6px' }} />
      {/* Screen */}
      <div style={{ background: 'var(--hs-screen)', borderRadius: 10, padding: 8, minHeight: 190 }}>
        <div style={{ fontSize: 7, color: 'var(--hs-text-muted)', fontFamily: "'DM Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Transaction
        </div>
        {STAGE_ITEMS.slice(0, 4).map((s) => (
          <div key={s.label} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0',
            borderBottom: '1px solid var(--hs-row-border)',
          }}>
            <span style={{ fontSize: 8 }}>{s.icon}</span>
            <span style={{ fontSize: 7, color: s.status === 'locked' ? 'var(--hs-stage-locked-text)' : 'var(--hs-stage-text)', fontFamily: "'DM Sans',sans-serif" }}>{s.label}</span>
            {s.status === 'done' && <span style={{ marginLeft: 'auto', fontSize: 7, color: '#10b981' }}>&#10003;</span>}
            {s.status === 'active' && <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: 'var(--hs-teal)' }} />}
          </div>
        ))}
        {/* Cost bar */}
        <div style={{ marginTop: 10, padding: '6px 0', borderTop: '1px solid rgba(0,212,184,0.12)' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--hs-teal)', fontFamily: "'Fraunces',serif" }}>Free</div>
          <div style={{ fontSize: 6, color: 'var(--hs-text-muted)', fontFamily: "'DM Mono',monospace" }}>TO START</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Each badge follows a unique elliptical path around the laptop.
 * The path is an SVG ellipse rendered invisibly; offset-path makes the badge travel along it.
 * At ~40-60% of the loop the badge goes BEHIND the laptop (z-index drops).
 */
interface LoopBadgeProps {
  icon: string;
  label: string;
  color: string;
  /** Horizontal radius of the ellipse */
  rx: number;
  /** Vertical radius */
  ry: number;
  /** Tilt angle of the ellipse in degrees */
  tilt: number;
  /** Seconds for one full loop */
  duration: number;
  /** Delay offset so badges don't all start together */
  delay: number;
  /** true = clockwise, false = counter-clockwise */
  reverse?: boolean;
}

function LoopBadge({ icon, label, color, rx, ry, tilt, duration, delay, reverse }: LoopBadgeProps): React.ReactElement {
  const uid = `loop-${icon.codePointAt(0) ?? 0}-${tilt}`;
  const dir = reverse ? 0 : 1;
  const path = `path("M ${rx} 0 A ${rx} ${ry} 0 1 ${dir} ${-rx} 0 A ${rx} ${ry} 0 1 ${dir} ${rx} 0 Z")`;

  // Fallback keyframes for browsers without offset-path support.
  // Approximates the ellipse with 8 translate waypoints.
  const cos = Math.cos((tilt * Math.PI) / 180);
  const sin = Math.sin((tilt * Math.PI) / 180);
  const pt = (angle: number): string => {
    const ex = rx * Math.cos((angle * Math.PI) / 180);
    const ey = ry * Math.sin((angle * Math.PI) / 180);
    const x = Math.round(ex * cos - ey * sin);
    const y = Math.round(ex * sin + ey * cos);
    return `translate(${x}px, ${y}px)`;
  };
  const angles = reverse ? [0, 315, 270, 225, 180, 135, 90, 45, 0] : [0, 45, 90, 135, 180, 225, 270, 315, 0];

  return (
    <>
      <style>{`
        @keyframes ${uid}-travel {
          from { offset-distance: 0%; }
          to   { offset-distance: 100%; }
        }
        @keyframes ${uid}-fallback {
          ${angles.map((a, i) => `${Math.round((i / (angles.length - 1)) * 100)}% { transform: ${pt(a)}; }`).join('\n          ')}
        }
        @keyframes ${uid}-depth {
          0%, 25%  { z-index: 5; opacity: 1; }
          35%, 65% { z-index: 1; opacity: 0.55; }
          75%, 100% { z-index: 5; opacity: 1; }
        }
      `}</style>
      <div
        className={uid}
        style={{
          position: 'absolute',
          left: '50%', top: '50%',
          marginLeft: -60, marginTop: -16,
          offsetPath: path,
          offsetRotate: '0deg',
          animation: `${uid}-travel ${duration}s linear infinite, ${uid}-depth ${duration}s ease-in-out infinite`,
          animationDelay: `${delay}s`,
          transform: `rotate(${tilt}deg)`,
          zIndex: 5,
        }}
      >
        <div style={{ transform: `rotate(${-tilt}deg)` }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: 'var(--hs-badge-bg)', border: `1px solid ${color}44`,
            borderRadius: 8, backdropFilter: 'blur(8px)',
            boxShadow: `0 4px 16px rgba(0,0,0,0.2), 0 0 12px ${color}20`,
            whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span style={{ fontSize: 10, color, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>{label}</span>
          </div>
        </div>
      </div>
      {/* Fallback: if offset-path not supported, override with transform-based loop */}
      <style>{`
        @supports not (offset-path: path("M 0 0")) {
          .${uid} {
            offset-path: none !important;
            transform: none !important;
            animation: ${uid}-fallback ${duration}s linear infinite, ${uid}-depth ${duration}s ease-in-out infinite !important;
            animation-delay: ${delay}s !important;
          }
        }
      `}</style>
    </>
  );
}

interface StarConfig {
  size: number;
  color: string;
  rx: number;
  ry: number;
  tilt: number;
  duration: number;
  delay: number;
  reverse?: boolean;
  glow?: boolean;
}

const STAR_CONFIGS: StarConfig[] = [
  { size: 4, color: 'var(--hs-teal)', rx: 280, ry: 180, tilt: 30, duration: 15, delay: 0, glow: true },
  { size: 3, color: 'currentColor', rx: 350, ry: 150, tilt: -18, duration: 19, delay: -3, reverse: true },
  { size: 5, color: 'var(--hs-teal)', rx: 400, ry: 210, tilt: 10, duration: 23, delay: -7, glow: true },
  { size: 3, color: '#8fbc8f', rx: 310, ry: 250, tilt: -35, duration: 17, delay: -11, reverse: true },
  { size: 2, color: 'currentColor', rx: 260, ry: 160, tilt: 22, duration: 13, delay: -2 },
  { size: 4, color: 'var(--hs-teal)', rx: 370, ry: 130, tilt: -8, duration: 21, delay: -9, reverse: true, glow: true },
  { size: 2, color: 'currentColor', rx: 290, ry: 200, tilt: 40, duration: 16, delay: -14 },
  { size: 3, color: '#8fbc8f', rx: 420, ry: 180, tilt: -22, duration: 25, delay: -6, reverse: true },
  { size: 4, color: 'currentColor', rx: 330, ry: 140, tilt: 5, duration: 18, delay: -16, glow: true },
  { size: 2, color: 'var(--hs-teal)', rx: 380, ry: 230, tilt: -30, duration: 22, delay: -12, reverse: true },
  // Extra stars
  { size: 3, color: 'var(--hs-teal)', rx: 250, ry: 220, tilt: 45, duration: 14, delay: -1, glow: true },
  { size: 2, color: 'currentColor', rx: 410, ry: 170, tilt: -42, duration: 24, delay: -19 },
  { size: 4, color: '#8fbc8f', rx: 320, ry: 200, tilt: 18, duration: 20, delay: -4, reverse: true },
  { size: 2, color: 'var(--hs-teal)', rx: 360, ry: 240, tilt: -15, duration: 17, delay: -8 },
  { size: 3, color: 'currentColor', rx: 270, ry: 150, tilt: 35, duration: 16, delay: -13, reverse: true, glow: true },
  { size: 5, color: 'var(--hs-teal)', rx: 390, ry: 220, tilt: -28, duration: 26, delay: -10, glow: true },
  { size: 2, color: '#8fbc8f', rx: 300, ry: 130, tilt: 12, duration: 14, delay: -17, reverse: true },
  { size: 3, color: 'currentColor', rx: 430, ry: 200, tilt: -40, duration: 27, delay: -5 },
  { size: 4, color: 'var(--hs-teal)', rx: 280, ry: 250, tilt: 28, duration: 19, delay: -15, reverse: true, glow: true },
  { size: 2, color: 'currentColor', rx: 340, ry: 170, tilt: -10, duration: 15, delay: -20 },
];

function OrbitDot({ size, color, rx, ry, tilt, duration, delay, reverse, glow }: StarConfig): React.ReactElement {
  const uid = `star-${rx}-${tilt}-${size}`;
  const dir = reverse ? 0 : 1;
  const path = `path("M ${rx} 0 A ${rx} ${ry} 0 1 ${dir} ${-rx} 0 A ${rx} ${ry} 0 1 ${dir} ${rx} 0 Z")`;

  // Transform fallback waypoints
  const cos = Math.cos((tilt * Math.PI) / 180);
  const sin = Math.sin((tilt * Math.PI) / 180);
  const pt = (angle: number): string => {
    const ex = rx * Math.cos((angle * Math.PI) / 180);
    const ey = ry * Math.sin((angle * Math.PI) / 180);
    return `translate(${Math.round(ex * cos - ey * sin)}px, ${Math.round(ex * sin + ey * cos)}px)`;
  };
  const angles = reverse ? [0, 315, 270, 225, 180, 135, 90, 45, 0] : [0, 45, 90, 135, 180, 225, 270, 315, 0];

  return (
    <>
      <style>{`
        @keyframes ${uid}-go {
          from { offset-distance: 0%; }
          to   { offset-distance: 100%; }
        }
        @keyframes ${uid}-fb {
          ${angles.map((a, i) => `${Math.round((i / (angles.length - 1)) * 100)}% { transform: ${pt(a)}; }`).join('\n          ')}
        }
        @keyframes ${uid}-twinkle {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @supports not (offset-path: path("M 0 0")) {
          .${uid} {
            offset-path: none !important;
            animation: ${uid}-fb ${duration}s linear infinite, ${uid}-twinkle ${duration * 0.3}s ease-in-out infinite !important;
            animation-delay: ${delay}s !important;
          }
        }
      `}</style>
      <div
        className={uid}
        style={{
          position: 'absolute',
          left: '50%', top: '50%',
          marginLeft: -size / 2, marginTop: -size / 2,
          width: size, height: size,
          borderRadius: '50%',
          background: color,
          boxShadow: glow ? `0 0 ${size * 2}px ${color}80` : undefined,
          offsetPath: path,
          offsetRotate: '0deg',
          animation: `${uid}-go ${duration}s linear infinite, ${uid}-twinkle ${duration * 0.3}s ease-in-out infinite`,
          animationDelay: `${delay}s`,
          transform: `rotate(${tilt}deg)`,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

export function HeroShowcase(): React.ReactElement {
  return (
    <div className="hs-root" style={{
      position: 'relative', width: '100%', height: '100%', minHeight: 480,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      // currentColor used by stars — falls back to teal in dark, dark slate in light
      color: 'var(--hs-teal)',
    }}>
      <style>{themeStyles}</style>
      <style>{`
        @keyframes hero-phone-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .lp.light-mode .hs-root { color: #1a1a2e; }
      `}</style>

      {/* Radial glow behind the laptop */}
      <div style={{
        position: 'absolute', left: '45%', top: '48%',
        transform: 'translate(-50%, -50%)',
        width: 500, height: 400,
        background: 'radial-gradient(ellipse at center, var(--hs-glow) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Main layout: laptop + phone */}
      <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'flex-end', gap: 20 }}>
        <LaptopMockup />
        <div style={{ position: 'relative', bottom: 20, animation: 'hero-phone-float 6s ease-in-out infinite' }}>
          <PhoneMockup />
        </div>
      </div>

      {/* Badges looping around the laptop on unique elliptical paths */}
      <LoopBadge icon="🏠" label="Listed on-chain" color="#00d4b8"
        rx={340} ry={200} tilt={-12} duration={22} delay={0} />
      <LoopBadge icon="✅" label="AML Verified" color="#10b981"
        rx={380} ry={170} tilt={15} duration={26} delay={-5} reverse />
      <LoopBadge icon="🔑" label="Keys in 8 weeks" color="#f0c060"
        rx={300} ry={220} tilt={-25} duration={20} delay={-10} />
      <LoopBadge icon="⛓️" label="100% on-chain" color="#00d4b8"
        rx={360} ry={190} tilt={8} duration={28} delay={-14} reverse />
      <LoopBadge icon="📋" label="Searches ordered" color="#8fbc8f"
        rx={320} ry={240} tilt={20} duration={24} delay={-18} />
      <LoopBadge icon="💷" label="£75 AI co-pilot" color="#00d4b8"
        rx={350} ry={160} tilt={-5} duration={19} delay={-8} reverse />

      {/* Star dots orbiting on their own paths */}
      {STAR_CONFIGS.map((s, i) => (
        <OrbitDot key={i} {...s} />
      ))}
    </div>
  );
}
