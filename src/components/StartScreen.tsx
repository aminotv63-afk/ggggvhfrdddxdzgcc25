import React, { useState } from 'react';
import {
  Crown,
  Play,
  Volume2,
  VolumeX,
  Smartphone,
  Monitor,
  RotateCcw,
  AlertTriangle,
  Download,
} from 'lucide-react';
import heroCover from '../assets/images/sultan_plains_hero_1794563954369.jpg';
import { OrientationMode } from './GameHUD';
import { usePWAInstall } from '../hooks/usePWAInstall';

export type GamePhase = 'start' | 'loading' | 'playing';

interface StartScreenProps {
  phase: 'start' | 'loading';
  progress: number;
  stageLabel: string;
  loadError: string | null;
  sultanName: string;
  onChangeSultanName: (name: string) => void;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  orientationMode: OrientationMode;
  onChangeOrientationMode: (mode: OrientationMode) => void;
  onStartGame: () => void;
  onRetryLoad: () => void;
  onCancelLoad: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  phase,
  progress,
  stageLabel,
  loadError,
  sultanName,
  onChangeSultanName,
  isSoundEnabled,
  onToggleSound,
  orientationMode,
  onChangeOrientationMode,
  onStartGame,
  onRetryLoad,
  onCancelLoad,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const { isInstallable, install } = usePWAInstall();
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      dir="rtl"
      className="absolute inset-0 z-40 flex flex-col justify-between overflow-hidden bg-stone-950 text-stone-100 select-none pointer-events-auto"
    >
      {/* Background Key Art with Graceful Gradient Fallback */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {!imageFailed ? (
          <img
            src={heroCover}
            alt="مشهد السهول الخضراء والقرية الملكية"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover object-center opacity-75"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-emerald-950 via-stone-900 to-stone-950" />
        )}
        {/* Contrast Scrim for WCAG AA Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/75 to-stone-950/45" />
      </div>

      {/* Top Quick Preferences Bar (Visible on Start Screen only) */}
      <header className="relative z-10 w-full max-w-4xl mx-auto px-4 pt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-300">
          <Crown className="w-5 h-5 shrink-0" />
          <span
            className="text-base font-bold whitespace-nowrap shrink-0"
            style={{ fontFamily: "'Marhey', sans-serif" }}
          >
            سلطان البراري
          </span>
        </div>

        {phase === 'start' && (
          <div className="flex items-center gap-2 shrink-0">
            {isInstallable && (
              <button
                type="button"
                onClick={install}
                className="min-h-[44px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/60 text-white flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 active:scale-95"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="text-xs font-black">تثبيت التطبيق</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleSound}
              aria-label={isSoundEnabled ? 'كتم الصوت' : 'تفعيل الصوت'}
              className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-stone-900/90 border border-stone-700 hover:border-amber-500/50 text-stone-200 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 active:scale-95"
            >
              {isSoundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-400" />
              )}
              <span className="text-xs font-bold">
                {isSoundEnabled ? 'الصوت مفعّل' : 'الصوت مكتوم'}
              </span>
            </button>
          </div>
        )}
      </header>

      {/* Center Hero Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        {phase === 'start' ? (
          <section className="w-full max-w-md bg-stone-950/88 border border-amber-500/35 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 text-center">
            {/* Royal Emblem */}
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 shadow-lg">
              <Crown className="w-8 h-8 fill-stone-950 stroke-[1.8]" />
            </div>

            {/* Title & Clean Unboxed Metadata */}
            <div className="space-y-2">
              <h1
                className="text-3xl sm:text-4xl font-bold text-amber-300 leading-tight"
                style={{ fontFamily: "'Marhey', sans-serif", textWrap: 'balance' }}
              >
                سلطان البراري
              </h1>
              <p className="text-sm text-stone-200 font-medium leading-relaxed">
                مغامرة ثلاثية الأبعاد في السهول العشبية والقرية الملكية
              </p>
              <div className="flex items-center justify-center flex-wrap gap-2 text-xs text-stone-400 font-medium pt-0.5">
                <span>ركوب الخيول</span>
                <span aria-hidden="true">·</span>
                <span>مزرعة المواشي</span>
                <span aria-hidden="true">·</span>
                <span>الحرس الملكي</span>
              </div>
            </div>

            {/* Sultan Name Input */}
            <div className="space-y-1.5 text-right">
              <label
                htmlFor="start-sultan-name"
                className="block text-xs font-bold text-stone-300"
              >
                اسم السلطان
              </label>
              <input
                id="start-sultan-name"
                type="text"
                value={sultanName}
                onChange={(e) => onChangeSultanName(e.target.value)}
                maxLength={24}
                placeholder="السلطان"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-700 focus:border-amber-400 outline-none text-amber-200 text-sm font-bold text-center select-text"
                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
              />
            </div>

            {/* Orientation Selector */}
            <div className="space-y-1.5 text-right">
              <span className="block text-xs font-bold text-stone-300">اتجاه الشاشة</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onChangeOrientationMode('portrait')}
                  className={`min-h-[44px] px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap active:scale-95 ${
                    orientationMode === 'portrait'
                      ? 'bg-amber-500 text-stone-950 border-amber-300'
                      : 'bg-stone-900 text-stone-300 border-stone-700 hover:border-amber-500/40'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>عمودي</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeOrientationMode('landscape')}
                  className={`min-h-[44px] px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap active:scale-95 ${
                    orientationMode === 'landscape'
                      ? 'bg-amber-500 text-stone-950 border-amber-300'
                      : 'bg-stone-900 text-stone-300 border-stone-700 hover:border-amber-500/40'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5 shrink-0" />
                  <span>أفقي</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeOrientationMode('auto')}
                  className={`min-h-[44px] px-2 rounded-xl border text-xs font-bold flex items-center justify-center transition-colors whitespace-nowrap active:scale-95 ${
                    orientationMode === 'auto'
                      ? 'bg-amber-500 text-stone-950 border-amber-300'
                      : 'bg-stone-900 text-stone-300 border-stone-700 hover:border-amber-500/40'
                  }`}
                >
                  <span>تلقائي</span>
                </button>
              </div>
            </div>

            {/* Primary Play CTA */}
            <button
              type="button"
              onClick={onStartGame}
              className="w-full min-h-[52px] px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black text-base flex items-center justify-center gap-2.5 shadow-xl active:scale-[0.98] transition-transform cursor-pointer"
            >
              <Play className="w-5 h-5 fill-stone-950 stroke-[2]" />
              <span>تشغيل اللعبة</span>
            </button>
          </section>
        ) : (
          /* Dedicated Loading Overlay (Blocks input until 3D engine & assets are 100% ready) */
          <section
            aria-live="polite"
            className="w-full max-w-md bg-stone-950/92 border border-amber-500/35 rounded-3xl p-6 shadow-2xl space-y-5 text-center"
          >
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 shadow-lg">
              {loadError ? (
                <AlertTriangle className="w-7 h-7 stroke-[2.2]" />
              ) : (
                <Crown className="w-8 h-8 fill-stone-950 stroke-[1.8]" />
              )}
            </div>

            {loadError ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold text-rose-300">تعذّر إكمال التحميل</h2>
                  <p className="text-xs text-stone-300 leading-relaxed">{loadError}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onRetryLoad}
                    className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-black flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة المحاولة</span>
                  </button>
                  <button
                    type="button"
                    onClick={onCancelLoad}
                    className="min-h-[46px] px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 hover:border-stone-500 text-stone-200 text-sm font-bold active:scale-95 transition-transform"
                  >
                    <span>رجوع</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2
                    className="text-2xl font-bold text-amber-300"
                    style={{ fontFamily: "'Marhey', sans-serif" }}
                  >
                    جارٍ تجهيز المملكة...
                  </h2>
                  <p className="text-xs text-stone-300 font-medium min-h-[18px]">{stageLabel}</p>
                </div>

                {/* Progress Bar + Tabular Percentage */}
                <div className="space-y-2">
                  <div className="w-full h-3 rounded-full bg-stone-800 overflow-hidden border border-stone-700/80">
                    <div
                      className="h-full w-full origin-right bg-gradient-to-l from-amber-400 via-amber-500 to-emerald-500 transition-transform duration-200 ease-out"
                      style={{ transform: `scaleX(${clampedProgress / 100})` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-stone-400 font-bold">
                    <span>يرجى الانتظار لمنع الضغط على الجهاز</span>
                    <span className="text-amber-300 font-mono tabular-nums" dir="ltr">
                      {clampedProgress}%
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onCancelLoad}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-900 border border-stone-700 hover:border-stone-500 text-stone-300 text-xs font-bold active:scale-95 transition-colors"
                >
                  إلغاء والعودة للقائمة
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Quiet Footer */}
      <footer className="relative z-10 w-full px-4 pb-4 text-center text-[11px] text-stone-400 font-medium">
        <span>تحكّم باللمس أو لوحة المفاتيح · متوافق مع الوضع العمودي والأفقي</span>
      </footer>
    </div>
  );
};
