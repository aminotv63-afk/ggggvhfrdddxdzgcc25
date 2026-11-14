import React, { useMemo, useRef } from 'react';
import { MapPin, Navigation, Compass, X, Trash2 } from 'lucide-react';
import { getCoastlineX } from '../game/sea';

export interface MapCarriagePoint {
  x: number;
  z: number;
  style: 'royal' | 'cart';
}

interface KingdomMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerX: number;
  playerZ: number;
  playerFacing: number;
  isRidingCarriage: boolean;
  gpsTarget: { x: number; z: number } | null;
  gpsDistanceMeters: number;
  carriages: MapCarriagePoint[];
  onSelectGps: (x: number, z: number) => void;
  onClearGps: () => void;
  mode?: 'gps' | 'teleport';
  canCheatTeleport?: boolean;
  onChangeMode?: (mode: 'gps' | 'teleport') => void;
  onTeleport?: (x: number, z: number) => void;
}

const LANDMARKS: { id: string; label: string; x: number; z: number }[] = [
  { id: 'palace', label: 'ساحة القصر', x: 0, z: -24 },
  { id: 'speechPodium', label: 'منصة الخطاب', x: -19.5, z: -25.2 },
  { id: 'militaryCamp', label: 'معسكر الجيش', x: 0, z: -71.5 },
  { id: 'cannon', label: 'المدفع السلطاني', x: -10.0, z: -27.5 },
  { id: 'well', label: 'البئر الملكي', x: 0, z: -4 },
  { id: 'prison', label: 'السجن الملكي', x: 13.8, z: -17.2 },
  { id: 'cemetery', label: 'المقبرة', x: -25.0, z: 50.0 },
  { id: 'cafe', label: 'المقهى', x: 20.0, z: 46.5 },
  { id: 'harbor', label: 'الميناء والبحر', x: -53, z: 3.5 },
  { id: 'farm', label: 'المزرعة', x: 0, z: 41.5 },
  { id: 'forest', label: 'غابة الزيتون', x: 63, z: 3.5 },
  { id: 'border', label: 'الحدود الرومانية', x: 79, z: 3.5 },
];

export const KingdomMapModal: React.FC<KingdomMapModalProps> = ({
  isOpen,
  onClose,
  playerX,
  playerZ,
  playerFacing,
  isRidingCarriage,
  gpsTarget,
  gpsDistanceMeters,
  carriages,
  onSelectGps,
  onClearGps,
  mode = 'gps',
  canCheatTeleport = false,
  onChangeMode,
  onTeleport,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const seaPolygonPoints = useMemo(() => {
    const pts: string[] = ['-95,-95'];
    for (let z = -95; z <= 95; z += 5) {
      pts.push(`${getCoastlineX(z).toFixed(1)},${z}`);
    }
    pts.push('-95,95');
    return pts.join(' ');
  }, []);

  const beachPolygonPoints = useMemo(() => {
    const pts: string[] = [];
    for (let z = -95; z <= 95; z += 5) {
      pts.push(`${(getCoastlineX(z) + 4.8).toFixed(1)},${z}`);
    }
    for (let z = 95; z >= -95; z -= 5) {
      pts.push(`${getCoastlineX(z).toFixed(1)},${z}`);
    }
    return pts.join(' ');
  }, []);

  if (!isOpen) return null;

  const isTeleportMode = canCheatTeleport && mode === 'teleport' && Boolean(onTeleport);

  const selectMapCoordinate = (worldX: number, worldZ: number) => {
    if (isTeleportMode && onTeleport) {
      onTeleport(worldX, worldZ);
      onClose();
    } else {
      onSelectGps(worldX, worldZ);
    }
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const worldX = -95 + nx * 190;
    const worldZ = -95 + ny * 190;

    selectMapCoordinate(worldX, worldZ);
  };

  // Convert facingAngle (0 = +Z South, Math.PI = -Z North, Math.PI/2 = +X East) to SVG rotation
  // SVG arrow points UP (-Z) at 0 deg; facing North (PI) => 0 deg, East (PI/2) => +90 deg, South (0) => 180 deg
  const arrowDeg = 180 - (playerFacing * 180) / Math.PI;

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/88 flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-stone-900 border rounded-2xl p-3.5 max-w-md w-full shadow-2xl text-right space-y-2.5 max-h-[94dvh] overflow-y-auto ${
          isTeleportMode ? 'border-emerald-400/60' : 'border-amber-500/45'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 ${
                isTeleportMode
                  ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              }`}
            >
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                className={`text-sm font-black leading-tight truncate ${
                  isTeleportMode ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {isTeleportMode ? 'خريطة الانتقال الفوري' : 'خريطة المملكة ونظام GPS'}
              </h2>
              <p className="text-[10px] text-stone-400 font-bold truncate">
                {isTeleportMode
                  ? 'اضغط على أي مكان بالخريطة لنقل السلطان إليه فوراً'
                  : 'انقر على أي مكان بالخريطة لتعيين الوجهة'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-stone-300 hover:text-white p-1.5 bg-stone-800 rounded-xl active:scale-95 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cheat Teleport vs GPS Mode Switcher */}
        {canCheatTeleport && onChangeMode && (
          <div className="grid grid-cols-2 gap-1.5 bg-stone-950/90 border border-stone-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => onChangeMode('gps')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all active:scale-95 ${
                !isTeleportMode
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:bg-stone-800'
              }`}
            >
              توجيه GPS
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('teleport')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all active:scale-95 ${
                isTeleportMode
                  ? 'bg-emerald-500 text-stone-950 shadow-sm'
                  : 'text-emerald-300 hover:bg-stone-800'
              }`}
            >
              انتقال فوري (غش)
            </button>
          </div>
        )}

        {/* Interactive Kingdom SVG Map */}
        <div className="relative rounded-2xl overflow-hidden border border-amber-500/35 bg-stone-950 aspect-square w-full max-w-[340px] mx-auto shadow-inner">
          <svg
            ref={svgRef}
            viewBox="-95 -95 190 190"
            onClick={handleMapClick}
            className="w-full h-full cursor-crosshair select-none touch-manipulation"
          >
            <defs>
              <clipPath id="kingdomClip">
                <circle cx="0" cy="0" r="88" />
              </clipPath>
            </defs>

            {/* Outer Mist Border Ring */}
            <rect x="-95" y="-95" width="190" height="190" fill="#18201a" />
            <circle cx="0" cy="0" r="88" fill="#2d5a36" />

            <g clipPath="url(#kingdomClip)">
              {/* Eastern Olive Forest tint */}
              <rect x="44" y="-88" width="46" height="176" fill="#23482b" opacity="0.88" />

              {/* Golden Beach Strip & Western Royal Sea */}
              <polygon points={beachPolygonPoints} fill="#d4b475" />
              <polygon points={seaPolygonPoints} fill="#165e83" />

              {/* Cobblestone Kingdom Roads */}
              <rect x="-3.8" y="-24" width="7.6" height="69.5" fill="#78716c" />
              <rect x="-57.5" y="0.4" width="145" height="6.2" fill="#78716c" />
              <rect x="-33.4" y="-38" width="5.8" height="80" fill="#6b6560" />
              <rect x="27.6" y="-38" width="5.8" height="80" fill="#6b6560" />
              <rect x="-31" y="21.8" width="62" height="5.4" fill="#6b6560" />

              {/* Harbor Pier extending into Western Sea */}
              <rect x="-71.4" y="1.7" width="14.5" height="3.6" rx="0.6" fill="#925e34" />

              {/* Royal Military Camp behind the Palace (North) */}
              <rect
                x="-19"
                y="-83.5"
                width="38"
                height="13.5"
                rx="1.2"
                fill="#423325"
                stroke="#f59e0b"
                strokeWidth="0.8"
              />
              <text
                x="0"
                y="-75.4"
                textAnchor="middle"
                fill="#fde68a"
                fontSize="4.1"
                fontWeight="bold"
              >
                معسكر الجيش
              </text>

              {/* Landmarks: Royal Palace Plaza & Enlarged 2-Story Palace Building (North) */}
              <rect
                x="-28.5"
                y="-69.5"
                width="57"
                height="48"
                rx="2"
                fill="#44403c"
                stroke="#d97706"
                strokeWidth="0.7"
              />
              <rect
                x="-27"
                y="-68"
                width="54"
                height="37.5"
                rx="1.2"
                fill="#6c5e52"
                stroke="#fbbf24"
                strokeWidth="1"
              />
              {/* Second-Floor Scenic South Overlook Balcony */}
              <rect
                x="-17.6"
                y="-30.5"
                width="35.2"
                height="4.1"
                rx="0.7"
                fill="#927d63"
                stroke="#fcd34d"
                strokeWidth="0.65"
              />
              <circle
                cx="0"
                cy="-48.5"
                r="6.2"
                fill="#eab308"
                stroke="#fef3c7"
                strokeWidth="0.7"
              />
              <text
                x="0"
                y="-24.8"
                textAnchor="middle"
                fill="#fde68a"
                fontSize="4.8"
                fontWeight="bold"
              >
                القصر الملكي
              </text>

              {/* Royal Speech Podium (West Palace Forecourt) */}
              <rect
                x="-22.2"
                y="-27.8"
                width="5.4"
                height="5.2"
                rx="0.9"
                fill="#991b1b"
                stroke="#fbbf24"
                strokeWidth="0.8"
              />
              <text
                x="-19.5"
                y="-19.4"
                textAnchor="middle"
                fill="#fde68a"
                fontSize="3.4"
                fontWeight="bold"
              >
                منصة الخطاب
              </text>

              {/* Royal Stone Well (Center) */}
              <circle
                cx="0"
                cy="-9.5"
                r="3.2"
                fill="#38bdf8"
                stroke="#e7e5e4"
                strokeWidth="1"
              />

              {/* Royal Prison */}
              <rect
                x="8.2"
                y="-15.5"
                width="11"
                height="8.4"
                rx="1"
                fill="#3f3f46"
                stroke="#a1a1aa"
                strokeWidth="0.8"
              />
              <text
                x="13.7"
                y="-10"
                textAnchor="middle"
                fill="#e4e4e7"
                fontSize="4.1"
                fontWeight="bold"
              >
                السجن
              </text>

              {/* Royal Livestock Farm (South) */}
              <rect
                x="-10.5"
                y="43.5"
                width="21"
                height="15"
                rx="1.5"
                fill="#4d7c3f"
                stroke="#d97706"
                strokeWidth="0.9"
              />
              <text
                x="0"
                y="52.5"
                textAnchor="middle"
                fill="#fef3c7"
                fontSize="4.8"
                fontWeight="bold"
              >
                المزرعة
              </text>

              {/* Royal Cemetery (South-West) */}
              <rect
                x="-31.5"
                y="50.5"
                width="13"
                height="11"
                rx="1.2"
                fill="#3b4d3b"
                stroke="#a8a29e"
                strokeWidth="0.9"
              />
              <text
                x="-25"
                y="57.4"
                textAnchor="middle"
                fill="#e7e5e4"
                fontSize="3.9"
                fontWeight="bold"
              >
                المقبرة
              </text>

              {/* Royal Kingdom Cafe (South-East) */}
              <rect
                x="16.5"
                y="48.5"
                width="11"
                height="9"
                rx="1.2"
                fill="#7c2d12"
                stroke="#fbbf24"
                strokeWidth="0.9"
              />
              <text
                x="22"
                y="54.2"
                textAnchor="middle"
                fill="#fef3c7"
                fontSize="3.8"
                fontWeight="bold"
              >
                المقهى
              </text>

              {/* Royal Fortress Cannon */}
              <circle
                cx="-10"
                cy="-27.5"
                r="2.9"
                fill="#292524"
                stroke="#f97316"
                strokeWidth="0.9"
              />
              <text
                x="-10"
                y="-31.8"
                textAnchor="middle"
                fill="#fed7aa"
                fontSize="3.7"
                fontWeight="bold"
              >
                المدفع
              </text>

              {/* Olive Forest & Border Labels */}
              <text
                x="-77"
                y="-18"
                textAnchor="middle"
                fill="#bae6fd"
                fontSize="5.2"
                fontWeight="bold"
              >
                البحر
              </text>
              <text
                x="-58"
                y="12"
                textAnchor="middle"
                fill="#fde68a"
                fontSize="4.3"
                fontWeight="bold"
              >
                الميناء
              </text>
              <text
                x="63"
                y="-18"
                textAnchor="middle"
                fill="#bbf7d0"
                fontSize="5"
                fontWeight="bold"
              >
                غابة الزيتون
              </text>

              {/* Roman Border Gate Marker */}
              <rect x="84.5" y="-1" width="3" height="9" fill="#be123c" />
              <text
                x="76"
                y="13"
                textAnchor="middle"
                fill="#fda4af"
                fontSize="4.2"
                fontWeight="bold"
              >
                الحدود
              </text>

              {/* Available Carriages on Map */}
              {carriages.map((c, idx) => (
                <g key={idx} transform={`translate(${c.x}, ${c.z})`}>
                  <rect
                    x="-2.2"
                    y="-1.5"
                    width="4.4"
                    height="3"
                    rx="0.7"
                    fill={c.style === 'royal' ? '#dc2626' : '#d97706'}
                    stroke="#fef3c7"
                    strokeWidth="0.6"
                  />
                </g>
              ))}

              {/* Active GPS Route Line */}
              {gpsTarget && (
                <line
                  x1={playerX}
                  y1={playerZ}
                  x2={gpsTarget.x}
                  y2={gpsTarget.z}
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  strokeDasharray="3.2 2.2"
                />
              )}

              {/* Active GPS Destination Marker */}
              {gpsTarget && (
                <g transform={`translate(${gpsTarget.x}, ${gpsTarget.z})`}>
                  <circle cx="0" cy="0" r="4.8" fill="#f59e0b" opacity="0.28" />
                  <circle
                    cx="0"
                    cy="0"
                    r="2.4"
                    fill="#fbbf24"
                    stroke="#1c1917"
                    strokeWidth="0.9"
                  />
                  <path
                    d="M0 -8.5 C2.8 -8.5 4.8 -6.4 4.8 -3.7 C4.8 -1.2 0 1.2 0 1.2 C0 1.2 -4.8 -1.2 -4.8 -3.7 C-4.8 -6.4 -2.8 -8.5 0 -8.5 Z"
                    fill="#ef4444"
                    stroke="#fef2f2"
                    strokeWidth="0.7"
                  />
                  <circle cx="0" cy="-4.2" r="1.4" fill="#fef3c7" />
                </g>
              )}

              {/* Live Sultan Position Arrow */}
              <g transform={`translate(${playerX}, ${playerZ}) rotate(${arrowDeg})`}>
                <circle cx="0" cy="0" r="4.2" fill="#f59e0b" opacity="0.24" />
                <polygon
                  points="0,-4.6 3.2,3.4 0,1.8 -3.2,3.4"
                  fill="#fbbf24"
                  stroke="#1c1917"
                  strokeWidth="0.8"
                />
              </g>
            </g>

            {/* Kingdom Boundary Circle */}
            <circle
              cx="0"
              cy="0"
              r="87.6"
              fill="none"
              stroke="#fbbf24"
              strokeOpacity="0.45"
              strokeWidth="1.1"
              strokeDasharray="3 2"
            />
          </svg>

          {/* Map Legend Overlay */}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between px-2 py-1 rounded-lg bg-stone-950/85 border border-stone-800 text-[9px] font-bold text-stone-300 pointer-events-none">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              السلطان
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2 rounded-sm bg-red-600 inline-block" />
              عربة ملكية
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              وجهة GPS
            </span>
          </div>
        </div>

        {/* Active GPS Destination / Teleport Hint Bar */}
        {isTeleportMode ? (
          <div className="rounded-xl bg-emerald-950/60 border border-emerald-400/50 px-3 py-2 flex items-center gap-2 text-[11px] text-emerald-200 font-bold">
            <MapPin className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>انقر على أي نقطة في الخريطة أو اختر معلماً للانتقال الفوري إليه</span>
          </div>
        ) : gpsTarget ? (
          <div className="rounded-xl bg-amber-950/55 border border-amber-500/45 p-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Navigation className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-black text-amber-200 truncate">
                  الوجهة محددة • {gpsDistanceMeters} م
                </p>
                <p className="text-[10px] text-stone-300 font-bold truncate">
                  {isRidingCarriage
                    ? 'الحارس سيقود بك العربة تلقائياً نحو الوجهة'
                    : 'اركب أي عربة ليقودك الحارس إلى الوجهة تلقائياً'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClearGps}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600/85 hover:bg-rose-500 text-white text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إلغاء</span>
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-stone-950/75 border border-stone-800 px-3 py-2 flex items-center gap-2 text-[11px] text-stone-300 font-bold">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <span>اضغط على الخريطة أو اختر معلماً لتشغيل التوجيه التلقائي</span>
          </div>
        )}

        {/* Quick Landmark Chips */}
        <div className="flex flex-wrap gap-1.5">
          {LANDMARKS.map((lm) => (
            <button
              key={lm.id}
              type="button"
              onClick={() => selectMapCoordinate(lm.x, lm.z)}
              className={`px-2.5 py-1 rounded-lg bg-stone-950/90 hover:bg-stone-800 border text-[10px] font-black active:scale-95 transition-all ${
                isTeleportMode
                  ? 'border-emerald-700 hover:border-emerald-400 text-emerald-200'
                  : 'border-stone-700 hover:border-amber-500/50 text-amber-200'
              }`}
            >
              {lm.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
