import React, { useRef, useState } from 'react';
import {
  Settings,
  Gauge,
  Crown,
  AlertTriangle,
  Smartphone,
  Monitor,
  ArrowLeftRight,
  Volume2,
  VolumeX,
  Zap,
  X,
  Check,
  Home,
  ShieldAlert,
  Map as MapIcon,
  LogOut,
  Navigation,
  CheckCircle2,
  Coins,
  Plus,
  Minus,
  Landmark,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  FolderDown,
  FolderUp,
  Clock,
  Lock,
  Unlock,
  CloudRain,
  CloudLightning,
  ScrollText,
  BedDouble,
  Swords,
  Video,
  Sparkles,
  Download,
  Shield,
} from 'lucide-react';
import { EngineStats } from '../game/engine';
import { TreasuryLogEntry } from '../game/saveData';
import {
  durationToMinutes,
  formatRemainingPrisonTime,
  PrisonTimeUnit,
} from '../game/prisonTime';

export type OrientationMode = 'auto' | 'portrait' | 'landscape';
export type ControlScale = 'compact' | 'normal';

export interface EconomyBannerInfo {
  id: number;
  title: string;
  amountText: string;
  positive: boolean;
}

export interface PrisonBannerInfo {
  id: number;
  type: 'entered' | 'released';
  labelAr: string;
  remainingMinutes: number;
}

export interface VizierBannerInfo {
  id: number;
  message: string;
}

export interface WarNoticeBannerInfo {
  id: number;
  text: string;
  tone: 'info' | 'win' | 'loss';
}

interface GameHUDProps {
  stats: EngineStats;
  sultanName: string;
  onChangeSultanName: (name: string) => void;
  treasuryGold: number;
  treasuryLog: TreasuryLogEntry[];
  onApplyTreasuryDelta: (delta: number, label: string) => void;
  onDistributeStipend: () => void;
  economyBanner: EconomyBannerInfo | null;
  prisonBanner: PrisonBannerInfo | null;
  vizierBanner?: VizierBannerInfo | null;
  isVizierAffairsOpen?: boolean;
  onCloseVizierAffairs?: () => void;
  onDismissVizier?: () => void;
  takeMoneyCitizen: { id: string; labelAr: string; money: number } | null;
  onCloseTakeMoney: () => void;
  onConfirmTakeMoney: (citizenId: string, amount: number) => void;
  imprisonTarget: { id: string; labelAr: string } | null;
  onCloseImprison: () => void;
  onConfirmImprison: (sentenceMinutes: number) => void;
  onReleasePrisoner: (citizenId: string) => void;
  onSaveToFile: () => Promise<'picker' | 'download' | 'cancelled' | 'error'>;
  onLoadFromFile: (file: File) => Promise<boolean>;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  orientationMode: OrientationMode;
  onChangeOrientationMode: (mode: OrientationMode) => void;
  controlsSwapped: boolean;
  onToggleSwapControls: () => void;
  actionButtonsSwapped: boolean;
  onToggleSwapActionButtons: () => void;
  controlScale: ControlScale;
  onChangeControlScale: (scale: ControlScale) => void;
  isLowQuality: boolean;
  onToggleLowQuality: () => void;
  onOpenMap: () => void;
  onClearGps: () => void;
  onReturnToMenu?: () => void;
  isTimeControlUnlocked?: boolean;
  onSetTimePeriod?: (period: 'day' | 'night') => void;
  onToggleRain?: () => void;
  onTriggerThunder?: () => void;
  onSetTreasuryGold?: (amount: number) => void;
  onOpenTeleportMap?: () => void;
  onStartCleanRecording?: () => void;
  recordedVideo?: { url: string; filename: string; sizeMb: string } | null;
  onClearRecordedVideo?: () => void;
  playerArmyCount: number;
  onDeclareWar: () => void;
  onSetArmyCount?: (count: number) => void;
  warNoticeBanner?: WarNoticeBannerInfo | null;
}

function formatGameClock(gameMinutes: number) {
  const totalMins = Math.max(0, Math.floor(gameMinutes));
  const day = Math.floor(totalMins / 1440) + 1;
  const minsInDay = totalMins % 1440;
  const hour = Math.floor(minsInDay / 60);
  const minute = minsInDay % 60;
  const hourFloat = minsInDay / 60;

  let period: 'sunrise' | 'day' | 'sunset' | 'night' = 'day';
  let periodLabel = 'نهار';
  if (hourFloat >= 19.0 || hourFloat < 5.5) {
    period = 'night';
    periodLabel = 'ليل';
  } else if (hourFloat < 7.5) {
    period = 'sunrise';
    periodLabel = 'شروق';
  } else if (hourFloat >= 17.0) {
    period = 'sunset';
    periodLabel = 'غروب';
  }

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return { day, timeStr: `${hh}:${mm}`, period, periodLabel };
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  sultanName,
  onChangeSultanName,
  treasuryGold,
  treasuryLog,
  onApplyTreasuryDelta,
  onDistributeStipend,
  economyBanner,
  prisonBanner,
  vizierBanner = null,
  isVizierAffairsOpen = false,
  onCloseVizierAffairs,
  onDismissVizier,
  takeMoneyCitizen,
  onCloseTakeMoney,
  onConfirmTakeMoney,
  imprisonTarget,
  onCloseImprison,
  onConfirmImprison,
  onReleasePrisoner,
  onSaveToFile,
  onLoadFromFile,
  isSoundEnabled,
  onToggleSound,
  orientationMode,
  onChangeOrientationMode,
  controlsSwapped,
  onToggleSwapControls,
  actionButtonsSwapped,
  onToggleSwapActionButtons,
  controlScale,
  onChangeControlScale,
  isLowQuality,
  onToggleLowQuality,
  onOpenMap,
  onClearGps,
  onReturnToMenu,
  isTimeControlUnlocked = false,
  onSetTimePeriod,
  onToggleRain,
  onTriggerThunder,
  onSetTreasuryGold,
  onOpenTeleportMap,
  onStartCleanRecording,
  recordedVideo = null,
  onClearRecordedVideo,
  playerArmyCount,
  onDeclareWar,
  onSetArmyCount,
  warNoticeBanner = null,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showTreasury, setShowTreasury] = useState(false);
  const [showPrisonRoster, setShowPrisonRoster] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showCheatMenu, setShowCheatMenu] = useState(false);
  const [cheatGoldInput, setCheatGoldInput] = useState(String(treasuryGold));
  const [cheatArmyInput, setCheatArmyInput] = useState(String(playerArmyCount));
  const [draftName, setDraftName] = useState(sultanName);
  const [customAmount, setCustomAmount] = useState('1000');
  const [takeAmountInput, setTakeAmountInput] = useState('200');
  const [sentenceValue, setSentenceValue] = useState('1');
  const [sentenceUnit, setSentenceUnit] = useState<PrisonTimeUnit>('hour');
  const [fileFeedback, setFileFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCheatMenu = () => {
    setCheatGoldInput(String(treasuryGold));
    setCheatArmyInput(String(playerArmyCount));
    setShowCheatMenu(true);
  };

  const handleApplyCheatGold = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!onSetTreasuryGold) return;
    const parsed = Math.floor(Number(cheatGoldInput));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onSetTreasuryGold(parsed);
  };

  const handleApplyCheatArmy = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!onSetArmyCount) return;
    const parsed = Math.floor(Number(cheatArmyInput));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onSetArmyCount(parsed);
  };

  const openSettings = () => {
    setDraftName(sultanName);
    setFileFeedback(null);
    setShowSettings(true);
  };

  const handleCustomTreasury = (sign: 1 | -1) => {
    const parsed = Math.floor(Number(customAmount));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onApplyTreasuryDelta(
      sign * parsed,
      sign > 0 ? 'إيداع في الخزينة' : 'سحب من الخزينة'
    );
  };

  const handleSaveName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = draftName.trim() || 'السلطان';
    onChangeSultanName(trimmed);
  };

  const handleSaveFileClick = async () => {
    setFileFeedback(null);
    const res = await onSaveToFile();
    if (res === 'picker') {
      setFileFeedback({ text: 'تم حفظ ملف اللعبة داخل المجلد المختار بنجاح', ok: true });
    } else if (res === 'download') {
      setFileFeedback({ text: 'تم تنزيل ملف الحفظ (.json) إلى مجلد التنزيلات في الهاتف', ok: true });
    } else if (res === 'error') {
      setFileFeedback({ text: 'تعذّر حفظ الملف على الجهاز', ok: false });
    }
  };

  const handleLoadFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ok = await onLoadFromFile(file);
    setFileFeedback(
      ok
        ? { text: 'تمت استعادة بيانات اللعبة من الملف بنجاح', ok: true }
        : { text: 'ملف الحفظ غير صالح أو تالف', ok: false }
    );
  };

  const formattedTreasury = treasuryGold.toLocaleString('en-US');
  const clock = formatGameClock(stats.gameMinutes);

  const parsedTakeAmount = Math.floor(Number(takeAmountInput));
  const isTakeAmountValid =
    takeMoneyCitizen !== null &&
    takeMoneyCitizen.money > 0 &&
    Number.isFinite(parsedTakeAmount) &&
    parsedTakeAmount >= 1 &&
    parsedTakeAmount <= takeMoneyCitizen.money;
  const isOverCitizenLimit =
    takeMoneyCitizen !== null &&
    Number.isFinite(parsedTakeAmount) &&
    parsedTakeAmount > takeMoneyCitizen.money;

  const parsedSentenceNum = Math.floor(Number(sentenceValue));
  const isSentenceValid = Number.isFinite(parsedSentenceNum) && parsedSentenceNum >= 1;
  const computedSentenceMinutes = isSentenceValid
    ? durationToMinutes(parsedSentenceNum, sentenceUnit)
    : 60;

  return (
    <>
      {/* 1. Top Header HUD:
             Right cluster: Sultan badge + In-game Clock/Day
             Left cluster: [Map | Settings | Exit] on row 1, and Treasury Box directly BELOW Exit on row 2 */}
      <header className="absolute top-0 left-0 right-0 z-30 p-2 sm:p-3 pointer-events-none flex justify-between items-start gap-1.5 sm:gap-2">
        {/* Right Side Cluster: Sultan Badge + Game Clock/Day */}
        <div className="flex flex-col items-start gap-1.5 min-w-0 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-stone-950/75 border border-amber-500/35 rounded-2xl p-1.5 px-2 shadow-md max-w-[140px] sm:max-w-[200px]">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 shrink-0">
              <Crown className="w-3.5 h-3.5 fill-stone-950 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[11px] font-black text-amber-300 leading-tight truncate">
                {sultanName}
              </h1>
              <div className="flex items-center gap-1 text-[10px] text-stone-300 font-bold leading-tight">
                <Gauge className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span>{stats.speedKmh} كم/س</span>
              </div>
            </div>
          </div>

          {/* Game Time & Day Badge (1 sec = 1 min) */}
          <div className="flex items-center gap-1.5 bg-stone-950/75 border border-stone-700/80 rounded-xl px-2 py-1 shadow-md">
            {clock.period === 'night' ? (
              <Moon className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            ) : clock.period === 'sunrise' ? (
              <Sunrise className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            ) : clock.period === 'sunset' ? (
              <Sunset className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            )}
            <span className="text-[11px] font-black text-stone-100 tabular-nums leading-none">
              {clock.timeStr}
            </span>
            <span className="text-[10px] font-bold text-amber-300/90 leading-none">
              • {clock.periodLabel}
            </span>
            <span className="text-[10px] font-bold text-stone-400 leading-none">
              • اليوم {clock.day}
            </span>
          </div>

          {/* Unlocked @AAABBB2010 Cheat Menu & Compact Quick Strip */}
          {isTimeControlUnlocked && onSetTimePeriod && (
            <div className="flex items-center gap-1 bg-stone-950/90 border border-amber-500/50 rounded-xl p-1 shadow-md">
              <button
                type="button"
                onClick={openCheatMenu}
                className="px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 bg-gradient-to-l from-amber-500 to-yellow-400 text-stone-950 shadow-sm active:scale-95"
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>قائمة الغش</span>
              </button>
              <button
                type="button"
                onClick={() => onSetTimePeriod('day')}
                aria-label="تحويل للنهار"
                className={`p-1 rounded-lg text-[10px] font-black transition-all active:scale-95 ${
                  !stats.isNight
                    ? 'bg-amber-400 text-stone-950 shadow-sm'
                    : 'bg-stone-900 text-amber-200 hover:bg-stone-800'
                }`}
              >
                <Sun className="w-3.5 h-3.5 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => onSetTimePeriod('night')}
                aria-label="تحويل لليل"
                className={`p-1 rounded-lg text-[10px] font-black transition-all active:scale-95 ${
                  stats.isNight
                    ? 'bg-sky-500 text-stone-950 shadow-sm'
                    : 'bg-stone-900 text-sky-200 hover:bg-stone-800'
                }`}
              >
                <Moon className="w-3.5 h-3.5 shrink-0" />
              </button>
              {onToggleRain && (
                <button
                  type="button"
                  onClick={onToggleRain}
                  aria-label="تبديل المطر"
                  className={`p-1 rounded-lg text-[10px] font-black transition-all active:scale-95 ${
                    stats.isRaining
                      ? 'bg-cyan-500 text-stone-950 shadow-sm'
                      : 'bg-stone-900 text-cyan-200 hover:bg-stone-800'
                  }`}
                >
                  <CloudRain className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}
              {onStartCleanRecording && (
                <button
                  type="button"
                  onClick={onStartCleanRecording}
                  aria-label="تسجيل فيديو HD نظيف"
                  className="p-1 rounded-lg text-[10px] font-black bg-rose-600/90 hover:bg-rose-500 text-white shadow-sm active:scale-95"
                >
                  <Video className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}
            </div>
          )}

          {/* Royal Prison Live Count Chip (shown when prisoners are locked inside) */}
          {stats.imprisonedCitizens.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPrisonRoster(true)}
              className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 border border-amber-400/55 rounded-xl px-2 py-1 shadow-md active:scale-95 transition-transform"
            >
              <Lock className="w-3 h-3 text-amber-300 shrink-0" />
              <span className="text-[10px] font-black text-amber-200 leading-none">
                السجن ({stats.imprisonedCitizens.length})
              </span>
            </button>
          )}
        </div>

        {/* Left Side Cluster: Row 1 [Map | Settings | Exit], Row 2 Treasury Money Slot BELOW Exit */}
        <div className="flex flex-col items-end gap-1.5 pointer-events-auto shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={onOpenMap}
              className={`h-9 px-2 sm:px-2.5 rounded-2xl border active:scale-95 flex items-center gap-1 shadow-md transition-transform ${
                stats.gpsTarget
                  ? 'bg-amber-500 border-amber-300 text-stone-950'
                  : 'bg-stone-950/80 hover:bg-stone-900 border-amber-500/40 text-amber-300'
              }`}
            >
              <MapIcon className="w-4 h-4 shrink-0" />
              <span className="text-xs font-black">
                {stats.gpsTarget ? `${stats.gpsDistanceMeters}م` : 'الخريطة'}
              </span>
            </button>

            <button
              type="button"
              onClick={openSettings}
              aria-label="الإعدادات"
              className="h-9 px-2 sm:px-2.5 rounded-2xl bg-stone-950/80 hover:bg-stone-900 border border-amber-500/40 text-amber-300 active:scale-95 flex items-center gap-1 shadow-md transition-transform"
            >
              <Settings className="w-4 h-4" />
              <span className="text-xs font-black hidden sm:inline">الإعدادات</span>
            </button>

            {onReturnToMenu && (
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="h-9 px-2 sm:px-2.5 rounded-2xl bg-rose-950/85 hover:bg-rose-900 border border-rose-500/50 text-rose-200 active:scale-95 flex items-center gap-1 shadow-md transition-transform"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-black">خروج</span>
              </button>
            )}
          </div>

          {/* Royal Treasury Money Slot positioned cleanly BELOW the Exit button */}
          <button
            type="button"
            onClick={() => setShowTreasury(true)}
            aria-label="خزينة المملكة"
            className="flex items-center gap-1.5 bg-stone-950/85 hover:bg-stone-900 border border-amber-400/55 rounded-2xl py-1 px-2.5 shadow-md active:scale-95 transition-transform"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 flex items-center justify-center text-stone-950 shrink-0 shadow-inner">
              <Coins className="w-3 h-3 stroke-[2.4]" />
            </div>
            <div className="text-right leading-tight">
              <div className="text-[9px] font-bold text-amber-200/80">مال الخزينة</div>
              <div className="text-[11px] font-black text-amber-300 tabular-nums">
                {formattedTreasury}
              </div>
            </div>
          </button>

          {/* Small War Declaration Button ("إعلان الحرب" vs 5,000 Roman Red Army) */}
          <button
            type="button"
            onClick={onDeclareWar}
            disabled={stats.warPhase !== 'idle'}
            aria-label="إعلان الحرب ضد جيش رومان"
            className={`flex items-center gap-1.5 rounded-xl py-1 px-2 border shadow-md transition-all active:scale-95 ${
              stats.warPhase === 'fighting'
                ? 'bg-red-900/90 border-red-400 text-amber-200 cursor-default'
                : playerArmyCount >= 5000
                ? 'bg-gradient-to-l from-red-700 to-rose-800 hover:from-red-600 hover:to-rose-700 border-amber-400 text-white'
                : 'bg-stone-950/85 hover:bg-stone-900 border-rose-500/45 text-rose-200'
            }`}
          >
            <Swords className="w-3 h-3 text-amber-300 shrink-0" />
            <span className="text-[10px] font-black leading-none">
              {stats.warPhase === 'fighting' ? 'معركة جارية' : 'إعلان الحرب'}
            </span>
            <span className="text-[9px] font-black text-amber-200/95 tabular-nums leading-none">
              {playerArmyCount.toLocaleString('en-US')}/5,000
            </span>
          </button>
        </div>
      </header>

      {/* 1B. Active War Live Scoreboard HUD */}
      {stats.warPhase === 'fighting' && !stats.isExecuting && (
        <div className="fixed top-[86px] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[94%] max-w-sm">
          <div className="bg-stone-950/94 border border-red-500/80 rounded-2xl px-3 py-2 shadow-2xl space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px] font-black">
              <span className="text-sky-300 tabular-nums">
                جيش المملكة: {stats.warPlayerRemaining.toLocaleString('en-US')}
              </span>
              <span className="text-amber-300 flex items-center gap-1 text-[10px]">
                <Swords className="w-3.5 h-3.5 text-red-400" />
                <span>ضد</span>
              </span>
              <span className="text-rose-400 tabular-nums">
                جيش رومان: {stats.warRomanRemaining.toLocaleString('en-US')}
              </span>
            </div>
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-300">
              <Shield className="w-3 h-3 shrink-0" />
              <span>السلطان محمي • الرعية في مأمن والعسكر يقاتلون</span>
            </div>
          </div>
        </div>
      )}

      {/* 1C. War / Army Daily Recruitment Notice Banner */}
      {warNoticeBanner && stats.warPhase !== 'fighting' && !stats.isExecuting && (
        <div className="fixed top-[86px] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[94%] max-w-sm">
          <div
            className={`px-3.5 py-2 rounded-2xl border shadow-xl flex items-center gap-2 text-right ${
              warNoticeBanner.tone === 'win'
                ? 'bg-emerald-950/95 border-emerald-400 text-emerald-100'
                : warNoticeBanner.tone === 'loss'
                ? 'bg-rose-950/95 border-rose-400 text-rose-100'
                : 'bg-stone-950/95 border-amber-400/80 text-amber-100'
            }`}
          >
            <Swords className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-[11px] font-black leading-snug">{warNoticeBanner.text}</span>
          </div>
        </div>
      )}

      {/* 2. Economy Event Toast Banner (Olive Harvest +50,000 / Roman Tax & Egypt Debt) */}
      {economyBanner && !stats.isExecuting && (
        <div className="fixed top-[84px] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[92%] max-w-xs">
          <div
            className={`px-3.5 py-2 rounded-xl border flex items-center justify-between gap-2 shadow-xl ${
              economyBanner.positive
                ? 'bg-emerald-950/95 border-emerald-400/75 text-emerald-100'
                : 'bg-rose-950/95 border-rose-400/75 text-rose-100'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Coins
                className={`w-4 h-4 shrink-0 ${
                  economyBanner.positive ? 'text-emerald-300' : 'text-rose-300'
                }`}
              />
              <span className="text-[11px] font-black truncate">{economyBanner.title}</span>
            </div>
            <span
              className={`text-xs font-black tabular-nums shrink-0 ${
                economyBanner.positive ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {economyBanner.amountText}
            </span>
          </div>
        </div>
      )}

      {/* 2B. Prisoner Entry / Release Notification Banner ("عند دخوله يظهر المتبقي") */}
      {prisonBanner && !economyBanner && !stats.isExecuting && (
        <div className="fixed top-[84px] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[94%] max-w-sm">
          <div
            className={`px-3.5 py-2.5 rounded-2xl border shadow-xl text-right space-y-0.5 ${
              prisonBanner.type === 'entered'
                ? 'bg-slate-950/95 border-amber-400/80 text-amber-100'
                : 'bg-emerald-950/95 border-emerald-400/80 text-emerald-100'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {prisonBanner.type === 'entered' ? (
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span className="text-xs font-black">
                {prisonBanner.type === 'entered'
                  ? `دخل ${prisonBanner.labelAr} إلى السجن الملكي`
                  : `تم الإفراج عن ${prisonBanner.labelAr}`}
              </span>
            </div>
            <div className="text-[11px] font-bold text-amber-300">
              {prisonBanner.type === 'entered'
                ? `المدة المتبقية: ${formatRemainingPrisonTime(prisonBanner.remainingMinutes, 4)}`
                : 'انتهت مدة السجن وعاد إلى المملكة'}
            </div>
          </div>
        </div>
      )}

      {/* 2B-2. Royal Vizier Order Toast Banner */}
      {vizierBanner && !prisonBanner && !economyBanner && !stats.isExecuting && (
        <div className="fixed top-[84px] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[94%] max-w-sm">
          <div className="px-3.5 py-2.5 rounded-2xl border border-emerald-400/80 bg-emerald-950/95 text-emerald-100 shadow-xl flex items-center gap-2 text-right">
            <BedDouble className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-xs font-black leading-snug">{vizierBanner.message}</span>
          </div>
        </div>
      )}

      {/* 2C. Near-Prison Live Remaining Sentence Card */}
      {stats.isNearPrison &&
        stats.imprisonedCitizens.length > 0 &&
        !prisonBanner &&
        !economyBanner &&
        !stats.isExecuting &&
        !stats.isNearRomanBorder && (
          <div className="fixed top-[84px] left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-xs pointer-events-auto">
            <button
              type="button"
              onClick={() => setShowPrisonRoster(true)}
              className="w-full bg-slate-950/90 border border-amber-400/60 rounded-2xl px-3 py-2 shadow-xl text-right space-y-1 active:scale-[0.99]"
            >
              <div className="flex items-center justify-between text-[11px] font-black text-amber-300">
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>السجن الملكي ({stats.imprisonedCitizens.length})</span>
                </span>
                <span className="text-[10px] text-stone-400">اضغط للتفاصيل</span>
              </div>
              {stats.imprisonedCitizens.slice(0, 2).map((p) => (
                <div key={p.id} className="text-[11px] font-bold text-stone-100 truncate">
                  {p.labelAr}:{' '}
                  <span className="text-amber-300">
                    {formatRemainingPrisonTime(p.remainingMinutes, 3)}
                  </span>
                </div>
              ))}
            </button>
          </div>
        )}

      {/* 3. Active Royal Execution Status Banner */}
      {stats.isExecuting && stats.executionPhaseLabel && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[92%] max-w-sm">
          <div className="bg-stone-950/92 border border-red-500/75 text-red-100 px-3.5 py-1.5 rounded-xl flex items-center justify-center gap-2 shadow-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <p className="text-[11px] font-black leading-tight text-amber-200 truncate">
              {stats.executionPhaseLabel}
            </p>
          </div>
        </div>
      )}

      {/* 4. Royal Speech Podium Live Banner */}
      {stats.isOnSpeechPodium && !stats.isExecuting && !stats.isNearRomanBorder && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[92%] max-w-sm">
          <div className="bg-emerald-950/92 border border-amber-400/80 text-amber-100 px-3.5 py-2 rounded-2xl shadow-xl flex items-center justify-center gap-2 text-center">
            <Crown className="w-4 h-4 text-amber-300 shrink-0" />
            <p className="text-[11px] font-black leading-snug text-amber-200">
              أنت على منصة الخطاب الملكي — الرعية تتجمع وتنحني أمامك
            </p>
          </div>
        </div>
      )}

      {/* 4b. Roman Border Guard Dialogue Banner */}

      {stats.isNearRomanBorder && stats.borderGuardMessage && !stats.isExecuting && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[92%] max-w-md">
          <div className="bg-stone-950/94 border border-rose-500/75 text-stone-100 px-3.5 py-2.5 rounded-2xl shadow-xl space-y-1 text-right">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-[11px] font-black text-amber-300">
                  حارسا بوابة الحدود الرومانية
                </span>
              </div>
              {stats.isAtBorderGate && (
                <span className="text-[10px] font-black text-rose-300 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded-md">
                  الباب مغلق — لا يمكنك الخروج
                </span>
              )}
            </div>
            <p className="text-xs font-bold leading-relaxed text-amber-100">
              «{stats.borderGuardMessage}»
            </p>
          </div>
        </div>
      )}

      {/* 5. Boundary Smoke & Fence Warning Banner */}
      {(stats.proximityToFog > 0.05 || stats.isBlockedByFog) &&
        !stats.isNearRomanBorder &&
        !stats.isExecuting && (
          <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[90%] max-w-xs">
            <div className="bg-stone-950/90 border border-amber-500/60 text-amber-300 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-[11px] font-black leading-tight text-amber-200 truncate">
                {stats.isSailing
                  ? 'حدود البحر الملكي — لا يمكنك الإبحار أبعد'
                  : 'حدود المملكة: سياج وضباب — لا يمكنك الخروج'}
              </p>
            </div>
          </div>
        )}

      {/* 6. Active GPS & Guard Auto-Drive Banner */}
      {stats.gpsTarget &&
        !stats.isExecuting &&
        !stats.isNearRomanBorder &&
        !(stats.proximityToFog > 0.05 || stats.isBlockedByFog) && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-sm pointer-events-auto ${
              isTimeControlUnlocked ? 'top-[106px]' : 'top-[84px]'
            }`}
          >
            <div className="bg-stone-950/90 border border-amber-500/55 text-amber-200 px-3 py-1.5 rounded-xl flex items-center justify-between gap-2 shadow-lg">
              <div className="flex items-center gap-1.5 min-w-0">
                <Navigation className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-[11px] font-black leading-tight truncate">
                  {stats.isAutoDrivingCarriage
                    ? `الحارس يقود العربة نحو الوجهة • ${stats.gpsDistanceMeters} م`
                    : stats.isRidingCarriage
                    ? `قيادة يدوية • الوجهة ${stats.gpsDistanceMeters} م`
                    : `وجهة GPS: ${stats.gpsDistanceMeters} م — اركب عربة للتوصيل`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClearGps}
                className="text-[10px] font-black text-rose-200 bg-rose-900/75 hover:bg-rose-800 px-2 py-0.5 rounded-lg shrink-0 active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

      {/* 7. GPS Arrival Toast */}
      {stats.gpsArrivedBanner &&
        !stats.gpsTarget &&
        !stats.isExecuting &&
        !stats.isNearRomanBorder && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[90%] max-w-xs ${
              isTimeControlUnlocked ? 'top-[106px]' : 'top-[84px]'
            }`}
          >
            <div className="bg-emerald-950/92 border border-emerald-400/70 text-emerald-100 px-3 py-1.5 rounded-xl flex items-center justify-center gap-2 shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-[11px] font-black">تم الوصول إلى الوجهة بنجاح!</p>
            </div>
          </div>
        )}

      {/* 8. Recorded HD Video Ready Banner */}
      {recordedVideo && !stats.isExecuting && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-sm pointer-events-auto ${
            isTimeControlUnlocked ? 'top-[146px]' : 'top-[122px]'
          }`}
        >
          <div className="bg-stone-950/95 border border-emerald-400/70 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Video className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0 text-right">
                <p className="text-[11px] font-black text-emerald-200 truncate">
                  تم تجهيز فيديو اللعب ({recordedVideo.sizeMb})
                </p>
                <p className="text-[10px] text-stone-400 font-bold truncate">
                  بأعلى جودة وبدون أزرار تحكم
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={recordedVideo.url}
                download={recordedVideo.filename}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-[11px] font-black flex items-center gap-1 active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>حفظ</span>
              </a>
              {onClearRecordedVideo && (
                <button
                  type="button"
                  onClick={onClearRecordedVideo}
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (Orientation Flip + Button Customization + Save/Load File + Sound/Name) */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/80 flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-amber-500/45 rounded-2xl p-4 max-w-xs w-full max-h-[90dvh] overflow-y-auto shadow-2xl text-right space-y-3"
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-black text-amber-300">إعدادات اللعبة</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-stone-400 hover:text-white p-1 bg-stone-800 rounded-lg active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Save & Restore Game File in Phone Folders */}
            <div className="space-y-1.5 bg-stone-950/70 border border-amber-500/30 rounded-xl p-2.5">
              <label className="block text-[11px] font-black text-amber-300">
                حفظ بيانات اللعبة في مجلدات الهاتف
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveFileClick}
                  className="py-2 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all"
                >
                  <FolderDown className="w-3.5 h-3.5 shrink-0" />
                  <span>حفظ في ملف</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-100 text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all"
                >
                  <FolderUp className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>فتح ملف حفظ</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleLoadFileChange}
                  className="hidden"
                />
              </div>
              {fileFeedback && (
                <p
                  className={`text-[10px] font-bold leading-snug ${
                    fileFeedback.ok ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {fileFeedback.text}
                </p>
              )}
            </div>

            {/* Section 2: Flip Game to Portrait / Landscape */}
            <div className="space-y-1.5 border-t border-stone-800 pt-2.5">
              <label className="block text-[11px] font-black text-stone-200">
                اتجاه اللعبة (تقليب الشاشة)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeOrientationMode('portrait')}
                  className={`py-2 px-2 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    orientationMode === 'portrait'
                      ? 'bg-amber-500 text-stone-950 border-amber-300 shadow-sm'
                      : 'bg-stone-950/80 text-stone-300 border-stone-700 hover:border-amber-500/40'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>عمودي</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeOrientationMode('landscape')}
                  className={`py-2 px-2 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    orientationMode === 'landscape'
                      ? 'bg-amber-500 text-stone-950 border-amber-300 shadow-sm'
                      : 'bg-stone-950/80 text-stone-300 border-stone-700 hover:border-amber-500/40'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>أفقي</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeOrientationMode('auto')}
                  className={`py-2 px-2 rounded-xl border text-[11px] font-black flex items-center justify-center transition-all active:scale-95 ${
                    orientationMode === 'auto'
                      ? 'bg-amber-500 text-stone-950 border-amber-300 shadow-sm'
                      : 'bg-stone-950/80 text-stone-300 border-stone-700 hover:border-amber-500/40'
                  }`}
                >
                  <span>تلقائي</span>
                </button>
              </div>
            </div>

            {/* Section 3: Customize Control Buttons */}
            <div className="space-y-2 border-t border-stone-800 pt-2.5">
              <label className="block text-[11px] font-black text-stone-200">
                تغيير أزرار التحكم
              </label>

              <button
                type="button"
                onClick={onToggleSwapControls}
                className="w-full py-2 px-3 rounded-xl bg-stone-950/80 border border-stone-700 hover:border-amber-500/50 flex items-center justify-between text-xs font-bold text-stone-200 active:scale-[0.98] transition-all"
              >
                <span className="flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
                  <span>موضع العصا والأزرار</span>
                </span>
                <span className="text-[11px] font-black text-amber-300">
                  {controlsSwapped ? 'عصا يمين / أزرار يسار' : 'عصا يسار / أزرار يمين'}
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleSwapActionButtons}
                className="w-full py-2 px-3 rounded-xl bg-stone-950/80 border border-stone-700 hover:border-amber-500/50 flex items-center justify-between text-xs font-bold text-stone-200 active:scale-[0.98] transition-all"
              >
                <span className="flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ترتيب القفز والجري</span>
                </span>
                <span className="text-[11px] font-black text-emerald-300">
                  {actionButtonsSwapped ? 'قفز ← جري' : 'جري ← قفز'}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeControlScale('compact')}
                  className={`py-1.5 rounded-xl border text-[11px] font-black transition-all ${
                    controlScale === 'compact'
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-stone-950/80 text-stone-300 border-stone-700'
                  }`}
                >
                  أزرار صغيرة
                </button>
                <button
                  type="button"
                  onClick={() => onChangeControlScale('normal')}
                  className={`py-1.5 rounded-xl border text-[11px] font-black transition-all ${
                    controlScale === 'normal'
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-stone-950/80 text-stone-300 border-stone-700'
                  }`}
                >
                  أزرار متوسطة
                </button>
              </div>
            </div>

            {/* Section 4: Performance, Audio & Sultan Name */}
            <div className="space-y-2 border-t border-stone-800 pt-2.5">
              <button
                type="button"
                onClick={onToggleLowQuality}
                className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-xs font-bold active:scale-[0.98] transition-all ${
                  isLowQuality
                    ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                    : 'bg-stone-950/80 border-stone-700 hover:border-amber-500/50 text-stone-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Zap
                    className={`w-3.5 h-3.5 ${
                      isLowQuality ? 'text-emerald-400 fill-emerald-400' : 'text-amber-400'
                    }`}
                  />
                  <span>مانع اللاق (أداء سريع)</span>
                </span>
                <span
                  className={`text-[11px] font-black ${
                    isLowQuality ? 'text-emerald-300' : 'text-stone-400'
                  }`}
                >
                  {isLowQuality ? 'مفعّل' : 'موقّف'}
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleSound}
                className="w-full py-2 px-3 rounded-xl bg-stone-950/80 border border-stone-700 hover:border-amber-500/50 flex items-center justify-between text-xs font-bold text-stone-200 active:scale-[0.98]"
              >
                <span className="flex items-center gap-1.5">
                  {isSoundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>أصوات اللعبة</span>
                </span>
                <span className={`text-[11px] font-black ${isSoundEnabled ? 'text-emerald-300' : 'text-rose-400'}`}>
                  {isSoundEnabled ? 'مفعّلة' : 'مكتومة'}
                </span>
              </button>

              <form onSubmit={handleSaveName} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={24}
                  placeholder="اسم السلطان"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-stone-950 border border-stone-700 focus:border-amber-400 outline-none text-amber-200 text-xs font-bold text-center select-text"
                  style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500 text-stone-950 text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>حفظ</span>
                </button>
              </form>

              {isTimeControlUnlocked && onSetTimePeriod && (
                <div className="space-y-1.5 bg-stone-950/75 border border-amber-500/35 rounded-xl p-2">
                  <div className="text-[11px] font-black text-amber-300">
                    تحكم الوقت والطقس (وضع الاختبار)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSetTimePeriod('day')}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        !stats.isNight
                          ? 'bg-amber-400 text-stone-950 border-amber-200'
                          : 'bg-stone-900 text-amber-200 border-stone-700 hover:border-amber-400/50'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>تحويل لنهار</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetTimePeriod('night')}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        stats.isNight
                          ? 'bg-sky-500 text-stone-950 border-sky-300'
                          : 'bg-stone-900 text-sky-200 border-stone-700 hover:border-sky-400/50'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>تحويل لليل</span>
                    </button>
                    {onToggleRain && (
                      <button
                        type="button"
                        onClick={onToggleRain}
                        className={`py-2 px-2 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                          stats.isRaining
                            ? 'bg-cyan-500 text-stone-950 border-cyan-300'
                            : 'bg-stone-900 text-cyan-200 border-stone-700 hover:border-cyan-400/50'
                        }`}
                      >
                        <CloudRain className="w-3.5 h-3.5" />
                        <span>{stats.isRaining ? 'إيقاف المطر' : 'تشغيل المطر'}</span>
                      </button>
                    )}
                    {onTriggerThunder && (
                      <button
                        type="button"
                        onClick={onTriggerThunder}
                        className="py-2 px-2 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1.5 bg-stone-900 text-indigo-200 border-indigo-500/40 hover:border-indigo-400 transition-all active:scale-95"
                      >
                        <CloudLightning className="w-3.5 h-3.5 text-amber-300" />
                        <span>تشغيل الرعد</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {onReturnToMenu && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(false);
                    onReturnToMenu();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-stone-950/80 border border-stone-700 hover:border-rose-500/50 text-stone-200 hover:text-rose-200 flex items-center justify-center gap-1.5 text-xs font-bold active:scale-[0.98] transition-all"
                >
                  <Home className="w-3.5 h-3.5 text-amber-400" />
                  <span>العودة لواجهة البداية</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Take Money from Citizen Modal (أخذ مال من الشخص) */}
      {takeMoneyCitizen && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/80 flex items-center justify-center p-4"
          onClick={onCloseTakeMoney}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-amber-500/55 rounded-2xl p-4 max-w-xs w-full shadow-2xl text-right space-y-3"
          >
            <div className="flex justify-between items-center border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-black text-amber-300">
                  أخذ مال — {takeMoneyCitizen.labelAr}
                </h2>
              </div>
              <button
                type="button"
                onClick={onCloseTakeMoney}
                className="text-stone-400 hover:text-white p-1 bg-stone-800 rounded-lg active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-stone-950/90 border border-amber-500/35 rounded-xl p-3 text-center space-y-1">
              <div className="text-[11px] font-bold text-stone-300">المبلغ الموجود لدى المواطن</div>
              <div className="text-xl font-black text-amber-300 tabular-nums">
                {takeMoneyCitizen.money.toLocaleString('en-US')} دينار
              </div>
            </div>

            {takeMoneyCitizen.money <= 0 ? (
              <div className="bg-stone-950/70 border border-stone-700 rounded-xl p-2.5 text-center text-xs font-bold text-stone-300">
                لم يبقَ لدى هذا الشخص أي مال للأخذ.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-stone-200">
                    أدخل المبلغ الذي تريد أخذه:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={takeMoneyCitizen.money}
                    value={takeAmountInput}
                    onChange={(e) => setTakeAmountInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 focus:border-amber-400 outline-none text-amber-200 text-sm font-black text-center tabular-nums select-text"
                    style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                  />
                  <div className="grid grid-cols-4 gap-1.5">
                    {[100, 500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={takeMoneyCitizen.money < preset}
                        onClick={() => setTakeAmountInput(String(preset))}
                        className="py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-35 text-amber-200 text-[11px] font-black"
                      >
                        {preset}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setTakeAmountInput(String(Math.max(1, Math.floor(takeMoneyCitizen.money / 2))))
                      }
                      className="py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-200 text-[11px] font-black"
                    >
                      النصف
                    </button>
                    <button
                      type="button"
                      onClick={() => setTakeAmountInput(String(takeMoneyCitizen.money))}
                      className="py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-300 text-[11px] font-black"
                    >
                      الكل
                    </button>
                  </div>
                </div>

                {isOverCitizenLimit && (
                  <p className="text-[11px] font-bold text-rose-400 text-center">
                    لا يمكنك أخذ أكثر من ما يملكه ({takeMoneyCitizen.money.toLocaleString('en-US')} دينار)
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!isTakeAmountValid}
                    onClick={() => {
                      if (isTakeAmountValid) {
                        onConfirmTakeMoney(takeMoneyCitizen.id, parsedTakeAmount);
                      }
                    }}
                    className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-stone-950 text-xs font-black active:scale-95"
                  >
                    أخذ المبلغ
                  </button>
                  <button
                    type="button"
                    onClick={onCloseTakeMoney}
                    className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-black active:scale-95"
                  >
                    إلغاء
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Royal Treasury Modal (خزينة المملكة) */}
      {showTreasury && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/80 flex items-center justify-center p-4"
          onClick={() => setShowTreasury(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-amber-500/50 rounded-2xl p-4 max-w-xs w-full max-h-[90dvh] overflow-y-auto shadow-2xl text-right space-y-3"
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-black text-amber-300">خزينة المملكة</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTreasury(false)}
                className="text-stone-400 hover:text-white p-1 bg-stone-800 rounded-lg active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Balance Card */}
            <div className="bg-gradient-to-br from-stone-950 to-stone-900 border border-amber-500/40 rounded-2xl p-3 text-center space-y-1">
              <div className="text-[11px] font-bold text-stone-300">رصيد مال الخزينة</div>
              <div className="flex items-center justify-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span className="text-2xl font-black text-amber-300 tabular-nums">
                  {formattedTreasury}
                </span>
                <span className="text-xs font-bold text-amber-200/80">دينار</span>
              </div>
            </div>

            {/* Kingdom Economy Schedule Summary */}
            <div className="bg-stone-950/75 border border-stone-800 rounded-xl p-2.5 space-y-1 text-[10px] font-bold">
              <div className="flex items-center gap-1 text-amber-300 mb-0.5">
                <Clock className="w-3 h-3" />
                <span>الدخل والضرائب التلقائية (1 ثانية = 1 دقيقة باللعبة)</span>
              </div>
              <div className="flex justify-between text-emerald-300">
                <span>محصول بيع الزيتون (كل ساعة):</span>
                <span className="tabular-nums">+50,000</span>
              </div>
              <div className="flex justify-between text-rose-300">
                <span>ضرائب الرومان (كل 10 ساعات):</span>
                <span className="tabular-nums">-100,000</span>
              </div>
              <div className="flex justify-between text-rose-300">
                <span>دين ملك مصر (كل 10 ساعات):</span>
                <span className="tabular-nums">-2,000</span>
              </div>
              <div className="flex justify-between text-rose-300">
                <span>لوازم ومواد غذائية للمملكة (كل 10 ساعات):</span>
                <span className="tabular-nums">-25,000</span>
              </div>
              <div className="flex justify-between text-rose-300">
                <span>منحة الشعب — 1,000 لكل فرد (كل 10 ساعات):</span>
                <span className="tabular-nums">-100,000</span>
              </div>
            </div>

            {/* Quick Royal Treasury Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onApplyTreasuryDelta(500, 'تحصيل ضرائب المملكة')}
                className="py-2 px-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>تحصيل (+500)</span>
              </button>
              <button
                type="button"
                disabled={treasuryGold < 250}
                onClick={() => onApplyTreasuryDelta(-250, 'منحة ملكية للرعية')}
                className="py-2 px-2 rounded-xl bg-rose-950/75 hover:bg-rose-900 disabled:opacity-40 disabled:pointer-events-none border border-rose-500/45 text-rose-200 text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all"
              >
                <Minus className="w-3.5 h-3.5 text-rose-400" />
                <span>منحة (-250)</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                disabled={treasuryGold < 25000}
                onClick={() =>
                  onApplyTreasuryDelta(-25000, 'شراء لوازم ومواد غذائية للمملكة')
                }
                className="w-full py-2 px-2.5 rounded-xl bg-rose-950/75 hover:bg-rose-900 disabled:opacity-40 disabled:pointer-events-none border border-rose-500/45 text-rose-200 text-[11px] font-black flex items-center justify-between gap-1 active:scale-95 transition-all"
              >
                <span>شراء لوازم ومواد غذائية للمملكة</span>
                <span className="tabular-nums text-rose-300">-25,000</span>
              </button>
              <button
                type="button"
                disabled={treasuryGold < 100000}
                onClick={onDistributeStipend}
                className="w-full py-2 px-2.5 rounded-xl bg-amber-950/80 hover:bg-amber-900/85 disabled:opacity-40 disabled:pointer-events-none border border-amber-500/50 text-amber-200 text-[11px] font-black flex items-center justify-between gap-1 active:scale-95 transition-all"
              >
                <span>منحة الشعب (1,000 لكل فرد)</span>
                <span className="tabular-nums text-rose-300">-100,000</span>
              </button>
            </div>

            {/* Custom Deposit / Withdraw */}
            <div className="space-y-1.5 border-t border-stone-800 pt-2">
              <label className="block text-[11px] font-black text-stone-300">
                إيداع أو سحب مبلغ مخصص
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={10000000}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-stone-950 border border-stone-700 focus:border-amber-400 outline-none text-amber-200 text-xs font-black text-center tabular-nums select-text"
                  style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                />
                <button
                  type="button"
                  onClick={() => handleCustomTreasury(1)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-black active:scale-95"
                >
                  إيداع
                </button>
                <button
                  type="button"
                  disabled={treasuryGold <= 0}
                  onClick={() => handleCustomTreasury(-1)}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 text-[11px] font-black active:scale-95"
                >
                  سحب
                </button>
              </div>
            </div>

            {/* Recent Ledger */}
            {treasuryLog.length > 0 && (
              <div className="space-y-1 border-t border-stone-800 pt-2">
                <div className="text-[10px] font-bold text-stone-400">آخر حركات الخزينة</div>
                <div className="space-y-1">
                  {treasuryLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-[11px] font-bold bg-stone-950/60 px-2.5 py-1 rounded-lg"
                    >
                      <span className="text-stone-300">{entry.label}</span>
                      <span
                        className={`tabular-nums font-black ${
                          entry.delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {entry.delta > 0
                          ? `+${entry.delta.toLocaleString('en-US')}`
                          : entry.delta.toLocaleString('en-US')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Imprisonment Sentence Picker Modal ("تحديد مدة السجن") */}
      {imprisonTarget && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/80 flex items-center justify-center p-4"
          onClick={onCloseImprison}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-amber-500/55 rounded-2xl p-4 max-w-xs w-full shadow-2xl text-right space-y-3"
          >
            <div className="flex justify-between items-center border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-black text-amber-300">
                  سجن — {imprisonTarget.labelAr}
                </h2>
              </div>
              <button
                type="button"
                onClick={onCloseImprison}
                className="text-stone-400 hover:text-white p-1 bg-stone-800 rounded-lg active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-black text-stone-300">اختيار سريع لمدة السجن:</div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: '15 دقيقة', val: '15', unit: 'minute' as PrisonTimeUnit },
                  { label: '3 ساعات', val: '3', unit: 'hour' as PrisonTimeUnit },
                  { label: '12 ساعة', val: '12', unit: 'hour' as PrisonTimeUnit },
                  { label: 'شهر واحد', val: '1', unit: 'month' as PrisonTimeUnit },
                  { label: 'سنة واحدة', val: '1', unit: 'year' as PrisonTimeUnit },
                  { label: '5 سنوات', val: '5', unit: 'year' as PrisonTimeUnit },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setSentenceValue(preset.val);
                      setSentenceUnit(preset.unit);
                    }}
                    className={`py-1.5 px-1.5 rounded-xl border text-[11px] font-black transition-all active:scale-95 ${
                      sentenceValue === preset.val && sentenceUnit === preset.unit
                        ? 'bg-amber-500 text-stone-950 border-amber-300'
                        : 'bg-stone-950/80 text-stone-200 border-stone-700 hover:border-amber-400/50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-stone-300">
                أو حدد المدة بنفسك:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={sentenceValue}
                  onChange={(e) => setSentenceValue(e.target.value)}
                  className="w-20 px-2.5 py-2 rounded-xl bg-stone-950 border border-stone-700 focus:border-amber-400 outline-none text-amber-200 text-sm font-black text-center tabular-nums select-text"
                  style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                />
                <div className="grid grid-cols-4 gap-1 flex-1">
                  {(
                    [
                      { id: 'minute', label: 'دقائق' },
                      { id: 'hour', label: 'ساعات' },
                      { id: 'month', label: 'أشهر' },
                      { id: 'year', label: 'سنوات' },
                    ] as { id: PrisonTimeUnit; label: string }[]
                  ).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSentenceUnit(u.id)}
                      className={`py-2 rounded-xl border text-[10px] font-black transition-all ${
                        sentenceUnit === u.id
                          ? 'bg-amber-500 text-stone-950 border-amber-300'
                          : 'bg-stone-950/80 text-stone-300 border-stone-700'
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-stone-950/90 border border-amber-500/35 rounded-xl p-2.5 text-center space-y-0.5">
              <div className="text-[10px] font-bold text-stone-400">سيتم سجنه لمدة:</div>
              <div className="text-xs font-black text-amber-300">
                {formatRemainingPrisonTime(computedSentenceMinutes, 4)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={!isSentenceValid}
                onClick={() => {
                  if (isSentenceValid) {
                    onConfirmImprison(computedSentenceMinutes);
                  }
                }}
                className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 text-xs font-black active:scale-95"
              >
                إدخال للسجن
              </button>
              <button
                type="button"
                onClick={onCloseImprison}
                className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-black active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Royal Prison Roster Modal ("سجناء السجن الملكي") */}
      {showPrisonRoster && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/80 flex items-center justify-center p-4"
          onClick={() => setShowPrisonRoster(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-amber-500/50 rounded-2xl p-4 max-w-xs w-full max-h-[85dvh] overflow-y-auto shadow-2xl text-right space-y-3"
          >
            <div className="flex justify-between items-center border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-black text-amber-300">سجناء السجن الملكي</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPrisonRoster(false)}
                className="text-stone-400 hover:text-white p-1 bg-stone-800 rounded-lg active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {stats.imprisonedCitizens.length === 0 ? (
              <div className="bg-stone-950/75 border border-stone-800 rounded-xl p-3 text-center text-xs font-bold text-stone-300">
                لا يوجد سجناء حالياً في السجن الملكي.
              </div>
            ) : (
              <div className="space-y-2">
                {stats.imprisonedCitizens.map((p) => (
                  <div
                    key={p.id}
                    className="bg-stone-950/85 border border-stone-700 rounded-xl p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-amber-300">{p.labelAr}</span>
                      <button
                        type="button"
                        onClick={() => onReleasePrisoner(p.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1 active:scale-95"
                      >
                        <Unlock className="w-3 h-3" />
                        <span>إفراج</span>
                      </button>
                    </div>
                    <div className="text-[11px] font-bold text-stone-200">
                      المتبقي:{' '}
                      <span className="text-amber-200">
                        {formatRemainingPrisonTime(p.remainingMinutes, 5)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Royal Vizier State Affairs Modal ("ديوان الوزير — أمور الدولة") */}
      {isVizierAffairsOpen && onCloseVizierAffairs && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/85 flex items-center justify-center p-4"
          onClick={onCloseVizierAffairs}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-emerald-400/60 rounded-2xl p-4 max-w-sm w-full max-h-[86dvh] overflow-y-auto shadow-2xl text-right space-y-3"
          >
            <div className="flex justify-between items-center border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-900/80 border border-emerald-400/50 flex items-center justify-center text-amber-300">
                  <ScrollText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-amber-300">ديوان الوزير — أمور الدولة</h2>
                  <p className="text-[10px] font-bold text-emerald-300/90">
                    سمعاً وطاعة يا مولاي {sultanName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseVizierAffairs}
                className="text-stone-400 hover:text-white p-1 bg-stone-800 rounded-lg active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Treasury & Economy Briefing */}
            <div className="bg-stone-950/85 border border-amber-500/35 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  <span>أحوال الخزينة والاقتصاد</span>
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                    treasuryGold >= 300000
                      ? 'bg-emerald-900/70 text-emerald-300 border border-emerald-500/40'
                      : treasuryGold >= 100000
                      ? 'bg-amber-900/60 text-amber-300 border border-amber-500/40'
                      : 'bg-rose-900/70 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {treasuryGold >= 300000
                    ? 'خزينة عامرة'
                    : treasuryGold >= 100000
                    ? 'مستقرة'
                    : 'تحتاج موارد'}
                </span>
              </div>
              <div className="text-[11px] font-bold text-stone-200 leading-relaxed">
                الرصيد الحالي:{' '}
                <span className="text-amber-300 font-black tabular-nums">
                  {formattedTreasury} دينار
                </span>
              </div>
              <div className="text-[11px] font-bold text-stone-300 leading-relaxed">
                واردات الزيتون تجلب <span className="text-emerald-300">+50,000 دينار</span> كل ساعة، بينما تبلغ التزامات الضرائب واللوازم ومنحة الشعب{' '}
                <span className="text-rose-300">-227,000 دينار</span> كل 10 ساعات.
              </div>
            </div>

            {/* 2. Security, Royal Prison & Border */}
            <div className="bg-stone-950/85 border border-stone-700 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
                  <span>الأمن والسجن الملكي والحدود</span>
                </span>
                <span className="text-[10px] font-black text-sky-300">
                  16 حارساً في القصر
                </span>
              </div>
              <div className="text-[11px] font-bold text-stone-300 leading-relaxed">
                حرس القصر والحدود الشرقية مع الرومان على أتم الاستعداد، وسرية المرافقة{' '}
                <span className="text-amber-200">
                  {stats.areGuardsFollowing ? 'تتبعك الآن' : 'متوقفة في موقعها'}
                </span>
                .
              </div>
              <div className="text-[11px] font-bold text-stone-200">
                {stats.imprisonedCitizens.length === 0 ? (
                  <span className="text-emerald-300">السجن الملكي خالٍ من السجناء والأمن مستتب.</span>
                ) : (
                  <span>
                    عدد الموقوفين في السجن الملكي:{' '}
                    <span className="text-amber-300 font-black">
                      {stats.imprisonedCitizens.length}
                    </span>{' '}
                    ({stats.imprisonedCitizens.map((p) => p.labelAr).join('، ')})
                  </span>
                )}
              </div>
            </div>

            {/* 3. Royal Military Camp & Defense State (strictly state affairs — no Queen or Weather card) */}
            <div className="bg-stone-950/85 border border-stone-700 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-rose-400" />
                  <span>الجيش والمعسكر الملكي</span>
                </span>
                <span className="text-[10px] font-bold text-stone-400">
                  اليوم {clock.day} • {clock.timeStr}
                </span>
              </div>
              <div className="text-[11px] font-bold text-stone-300 leading-relaxed">
                {stats.isNight ? (
                  <span>قوات المعسكر في ثكناتها الليلية والجنرال يرفع تقارير الاستعداد للصباح.</span>
                ) : (
                  <span>
                    الجيش يتدرب في{' '}
                    <span className="text-amber-200">المعسكر خلف القصر</span>{' '}
                    تحت إشراف الجنرال وحرسه الخاص (الضغط، الجري، والقفز).
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Dismissal & Close Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {onDismissVizier && (
                <button
                  type="button"
                  onClick={() => {
                    onDismissVizier();
                    onCloseVizierAffairs();
                  }}
                  className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-400/50 text-amber-200 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <BedDouble className="w-3.5 h-3.5 text-amber-300" />
                  <span>انصراف</span>
                </button>
              )}
              <button
                type="button"
                onClick={onCloseVizierAffairs}
                className="py-2.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black active:scale-95"
              >
                إغلاق الديوان
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && onReturnToMenu && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/85 flex items-center justify-center p-4"
          onClick={() => setShowExitConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-rose-500/50 rounded-2xl p-4 max-w-xs w-full shadow-2xl text-center space-y-3"
          >
            <div className="w-10 h-10 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-300">
              <LogOut className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-black text-amber-300">الخروج من اللعبة</h2>
            <p className="text-xs text-stone-300 font-bold leading-relaxed">
              هل تريد الخروج من المملكة والعودة إلى واجهة البداية؟
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  onReturnToMenu();
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black active:scale-95"
              >
                نعم، خروج
              </button>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-black active:scale-95"
              >
                البقاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret @AAABBB2010 Cheat Menu Modal */}
      {isTimeControlUnlocked && showCheatMenu && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/85 flex items-center justify-center p-4"
          onClick={() => setShowCheatMenu(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-amber-400/60 rounded-2xl p-4 max-w-sm w-full shadow-2xl text-right space-y-3 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-amber-300">
                    قائمة الغش السرية
                  </h2>
                  <p className="text-[10px] font-bold text-stone-400">
                    أدوات التحكم الكاملة بالمملكة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheatMenu(false)}
                className="text-stone-300 hover:text-white p-1.5 bg-stone-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. HD Clean Gameplay Screen Recorder (Hides HUD & Control Buttons) */}
            {onStartCleanRecording && (
              <div className="bg-stone-950/85 border border-rose-500/45 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-rose-300">
                  <Video className="w-4 h-4 shrink-0" />
                  <span>تسجيل شاشة اللعب بدون أزرار تحكم</span>
                </div>
                <p className="text-[11px] font-bold text-stone-300 leading-relaxed">
                  يُسجّل اللعبة بأعلى جودة ممكنة (60 إطار + صوت اللعبة) مع إخفاء جميع أزرار التحكم والقوائم أثناء التصوير.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCheatMenu(false);
                    onStartCleanRecording();
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                >
                  <Video className="w-4 h-4" />
                  <span>بدء التسجيل النظيف (HD)</span>
                </button>
              </div>
            )}

            {/* 2. Treasury Money Editor */}
            {onSetTreasuryGold && (
              <form
                onSubmit={handleApplyCheatGold}
                className="bg-stone-950/85 border border-amber-500/40 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 shrink-0" />
                    <span>تغيير أموال الخزينة</span>
                  </span>
                  <span className="text-[11px] font-black text-emerald-300 tabular-nums">
                    الحالي: {formattedTreasury}
                  </span>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={999999999}
                    value={cheatGoldInput}
                    onChange={(e) => setCheatGoldInput(e.target.value)}
                    dir="ltr"
                    className="flex-1 min-w-0 bg-stone-900 border border-stone-700 focus:border-amber-400 rounded-xl px-2.5 py-2 text-xs text-white font-black text-center outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black shrink-0 active:scale-95"
                  >
                    تعيين
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: '+100 ألف', val: treasuryGold + 100000 },
                    { label: 'مليون', val: 1000000 },
                    { label: '10 مليون', val: 10000000 },
                    { label: 'تصفير', val: 0 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setCheatGoldInput(String(preset.val));
                        onSetTreasuryGold(preset.val);
                      }}
                      className="py-1.5 px-1 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[10px] font-black text-amber-200 active:scale-95"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </form>
            )}

            {/* 2B. Kingdom Army Count Editor (Increase Soldiers Without Waiting) */}
            {onSetArmyCount && (
              <form
                onSubmit={handleApplyCheatArmy}
                className="bg-stone-950/85 border border-rose-500/45 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                    <Swords className="w-4 h-4 shrink-0" />
                    <span>تعديل عدد الجنود (بدون انتظار)</span>
                  </span>
                  <span className="text-[11px] font-black text-amber-300 tabular-nums">
                    {playerArmyCount.toLocaleString('en-US')} / 5,000
                  </span>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={999999}
                    value={cheatArmyInput}
                    onChange={(e) => setCheatArmyInput(e.target.value)}
                    dir="ltr"
                    className="flex-1 min-w-0 bg-stone-900 border border-stone-700 focus:border-rose-400 rounded-xl px-2.5 py-2 text-xs text-white font-black text-center outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shrink-0 active:scale-95"
                  >
                    تعيين
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: '+100', val: playerArmyCount + 100 },
                    { label: '+1,000', val: playerArmyCount + 1000 },
                    { label: '5,000 جاهز', val: 5000 },
                    { label: '8,000', val: 8000 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setCheatArmyInput(String(preset.val));
                        onSetArmyCount(preset.val);
                      }}
                      className="py-1.5 px-1 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[10px] font-black text-rose-200 active:scale-95"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </form>
            )}

            {/* 3. Instant Teleport Map */}
            {onOpenTeleportMap && (
              <div className="bg-stone-950/85 border border-emerald-500/45 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
                  <MapIcon className="w-4 h-4 shrink-0" />
                  <span>خريطة الانتقال الفوري</span>
                </div>
                <p className="text-[11px] font-bold text-stone-300 leading-relaxed">
                  افتح خريطة المملكة واضغط على أي مكان فيها لينتقل السلطان إليه فوراً.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCheatMenu(false);
                    onOpenTeleportMap();
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                >
                  <MapIcon className="w-4 h-4" />
                  <span>فتح خريطة الانتقال الفوري</span>
                </button>
              </div>
            )}

            {/* 4. Time & Weather Controls */}
            {onSetTimePeriod && (
              <div className="bg-stone-950/85 border border-stone-700 rounded-xl p-3 space-y-2">
                <span className="text-xs font-black text-stone-200 block">
                  التحكم في الوقت والطقس
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSetTimePeriod('day')}
                    className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 ${
                      !stats.isNight
                        ? 'bg-amber-400 text-stone-950'
                        : 'bg-stone-900 border border-stone-700 text-amber-200'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>نهار (12:00)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetTimePeriod('night')}
                    className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 ${
                      stats.isNight
                        ? 'bg-sky-500 text-stone-950'
                        : 'bg-stone-900 border border-stone-700 text-sky-200'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>ليل (22:00)</span>
                  </button>
                  {onToggleRain && (
                    <button
                      type="button"
                      onClick={onToggleRain}
                      className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 ${
                        stats.isRaining
                          ? 'bg-cyan-500 text-stone-950'
                          : 'bg-stone-900 border border-stone-700 text-cyan-200'
                      }`}
                    >
                      <CloudRain className="w-4 h-4" />
                      <span>{stats.isRaining ? 'إيقاف المطر' : 'تشغيل المطر'}</span>
                    </button>
                  )}
                  {onTriggerThunder && (
                    <button
                      type="button"
                      onClick={onTriggerThunder}
                      className="py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 bg-stone-900 border border-indigo-400/40 text-indigo-200 hover:bg-indigo-950/70 active:scale-95"
                    >
                      <CloudLightning className="w-4 h-4 text-amber-300" />
                      <span>ضربة رعد</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
