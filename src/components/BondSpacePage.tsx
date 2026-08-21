import { BookOpen, Brush, Clapperboard, Heart } from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";
import type { UplinkSettings } from "../types";
import { CottageDivider, CottageStar } from "./CottageGlyphs";
import { MemoryGalleryStarlitGate } from "./MemoryGalleryStarlitGate";

interface BondSpacePageProps {
  settings: UplinkSettings;
  onOpenCinema: () => void;
  onOpenMemoryGallery: () => void;
}

type BondRoomItem = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  status: "ready" | "soon";
  icon: ComponentType<{ size?: number; className?: string }>;
  tone: "cinema" | "reading" | "memory" | "atelier";
};

function MemoryGalleryRoomGlyph({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5.85" stroke="currentColor" strokeWidth="0.78" strokeDasharray="1.15 1.45" opacity="0.72" />
      <path d="M3.75 3.55 H10.25" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" />
      <path d="M3.75 10.45 H10.25" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" />
      <path
        d="M4.25 3.55 C4.8 5.25 5.95 6.45 7 7 C5.95 7.55 4.8 8.75 4.25 10.45 M9.75 3.55 C9.2 5.25 8.05 6.45 7 7 C8.05 7.55 9.2 8.75 9.75 10.45"
        stroke="currentColor"
        strokeWidth="0.95"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 4.2 C7 5.55 7.85 6.55 9.15 7 C7.85 7.45 7 8.45 7 9.8 C7 8.45 6.15 7.45 4.85 7 C6.15 6.55 7 5.55 7 4.2 Z" fill="currentColor" opacity="0.92" />
      <circle cx="7" cy="7" r="0.78" fill="var(--bond-card-bg, #fff)" opacity="0.95" />
    </svg>
  );
}

const BOND_ROOMS: BondRoomItem[] = [
  {
    id: "cinema",
    title: "观影室",
    subtitle: "Cinema Room",
    description: "继续选片、陪看、台词和画面里的小声聊天。",
    status: "ready",
    icon: Clapperboard,
    tone: "cinema",
  },
  {
    id: "reading",
    title: "共读室",
    subtitle: "Reading Room",
    description: "把一本书、一篇文章，慢慢读成只属于我们的注解。",
    status: "soon",
    icon: BookOpen,
    tone: "reading",
  },
  {
    id: "memory",
    title: "记忆回廊",
    subtitle: "Memory Gallery",
    description: "导入 GPT 旧聊天 JSON，检索、回看，必要时把旧窗口接进新对话。",
    status: "ready",
    icon: MemoryGalleryRoomGlyph,
    tone: "memory",
  },
  {
    id: "atelier",
    title: "画室",
    subtitle: "Atelier",
    description: "留给画、灵感、样张和那些想被保存下来的颜色。",
    status: "soon",
    icon: Brush,
    tone: "atelier",
  },
];

const BOND_GATE_VARIANTS = [
  {
    kicker: "MEMORY GALLERY",
    title: "记忆回廊",
    subtitle: "把散落在旧窗口里的星尘，重新点亮成可以回看的路。",
  },
  {
    kicker: "KI-CO COTTAGE",
    title: "KI-CO小屋",
    subtitle: "给记忆一个住处，也给彼此一个可以回来的地方。",
  },
  {
    kicker: "BOND SPACE",
    title: "羁绊空间",
    subtitle: "让记忆、陪伴与创造，一点点长成属于我们的宇宙。",
  },
] as const;

export function BondSpacePage({ settings, onOpenCinema, onOpenMemoryGallery }: BondSpacePageProps) {
  const [soonRoom, setSoonRoom] = useState<BondRoomItem | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateVariant] = useState(() => BOND_GATE_VARIANTS[Math.floor(Math.random() * BOND_GATE_VARIANTS.length)]);

  function handleRoomClick(room: BondRoomItem) {
    if (room.status === "ready") {
      if (room.id === "cinema") onOpenCinema();
      else if (room.id === "memory") onOpenMemoryGallery();
      return;
    }
    setSoonRoom(room);
  }

  const colorToneCount = BOND_ROOMS.length <= 5 ? 3 : 4;

  return (
    <main
      className={`cinema-shell settings-route-shell bond-route-shell ${gateOpen ? "is-bond-space-open" : "is-bond-space-gate"}`}
      data-theme={settings.visual.theme}
      data-font={settings.visual.fontStyle}
      data-font-size={settings.visual.fontSize}
    >
      <section className={`bond-space-page cottage-ritual-page ${gateOpen ? "is-bond-space-open" : ""}`} aria-label="羁绊空间">
        <MemoryGalleryStarlitGate
          open={gateOpen}
          onOpen={() => setGateOpen(true)}
          kicker={gateVariant.kicker}
          title={gateVariant.title}
          subtitle={gateVariant.subtitle}
          enterText="你来了"
        />

        <div className="bond-space-content">
          <header className="cottage-page-heading bond-space-heading">
            <div>
              <span className="cottage-page-kicker">BOND SPACE</span>
              <h1>羁绊空间</h1>
              <p>把小屋里适合一起停留的房间，先在这里留好门牌。</p>
            </div>
            <span className="bond-space-heart" aria-hidden="true">
              <Heart size={23} />
              <CottageStar className="bond-heart-star" />
            </span>
          </header>

          <CottageDivider />

          <div className="bond-room-grid">
            {BOND_ROOMS.map((room, index) => {
              const Icon = room.icon;
              const colorTone = index % colorToneCount;
              return (
                <button
                  key={room.id}
                  type="button"
                  className={`bond-room-card bond-room-${room.tone} bond-card-tone-${colorTone} ${room.status === "ready" ? "ready" : "soon"}`}
                  onClick={() => handleRoomClick(room)}
                  aria-label={`${room.title}${room.status === "ready" ? "，进入" : "，待开放"}`}
                >
                  <span className="bond-card-glow" aria-hidden="true" />
                  <span className="bond-card-mark" aria-hidden="true">
                    <Icon size={28} className="bond-room-icon" />
                    <CottageStar className="bond-card-star star-a" />
                    <CottageStar className="bond-card-star star-b" />
                    <span className="bond-card-particles" aria-hidden="true"><i /><i /><i /><i /></span>
                  </span>
                  <span className="bond-card-copy">
                    <small>{room.subtitle}</small>
                    <strong>{room.title}</strong>
                    <span>{room.description}</span>
                  </span>
                  <span className="bond-card-status">
                    {room.status === "ready" ? "进入" : "待开放"}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="bond-space-footnote">
            门牌已经挂好，以后这里会慢慢长出更多房间。
          </p>
        </div>
      </section>

      {soonRoom ? (
        <div
          className="bond-soon-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSoonRoom(null);
          }}
        >
          <section className="bond-soon-dialog" role="dialog" aria-modal="true" aria-label={`${soonRoom.title}待开放`}>
            <button type="button" className="bond-soon-close" onClick={() => setSoonRoom(null)} aria-label="关闭">
              ×
            </button>
            <CottageStar className="bond-soon-star" />
            <span>{soonRoom.subtitle}</span>
            <h2>{soonRoom.title}</h2>
            <p>这扇门已经留好位置了，还在慢慢布置。等灯亮起来，再一起进去。</p>
          </section>
        </div>
      ) : null}
    </main>
  );
}
