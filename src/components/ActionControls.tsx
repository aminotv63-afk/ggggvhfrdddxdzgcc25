import React from 'react';
import { Flame, ArrowUp, Lock, Coins, RotateCcw, RotateCw, ScrollText, BedDouble, Shield, PawPrint } from 'lucide-react';

interface ActionControlsProps {
  isRunning: boolean;
  onToggleRun: () => void;
  onJump: () => void;
  isMounted?: boolean;
  isSailing?: boolean;
  isNearBoat?: boolean;
  mountedHorseLabel?: string | null;
  nearbyHorseLabel?: string | null;
  nearbyHorseHasCarriage?: boolean;
  onMountOrDismount?: () => void;
  isLeadingHorse?: boolean;
  ledHorseLabel?: string | null;
  onToggleLeadHorse?: () => void;
  areGuardsFollowing?: boolean;
  onToggleGuardsFollow?: () => void;
  areGuardsProtecting?: boolean;
  onToggleGuardsProtect?: () => void;
  onGuardsBow?: () => void;
  canExecute?: boolean;
  onExecute?: () => void;
  canFeedLion?: boolean;
  onFeedLion?: () => void;
  canImprison?: boolean;
  onImprison?: () => void;
  nearbyMoneyCitizen?: { id: string; labelAr: string; money: number } | null;
  onOpenTakeMoney?: () => void;
  isNearCannon?: boolean;
  cannonCooldown?: number;
  onFireCannon?: () => void;
  onRotateCannon?: (deltaYaw: number) => void;
  isNearThrone?: boolean;
  isSittingOnThrone?: boolean;
  onToggleSitThrone?: () => void;
  isNearRoyalBed?: boolean;
  isSleepingInBed?: boolean;
  onToggleSleepInBed?: () => void;
  isNearVizier?: boolean;
  onOpenVizierAffairs?: () => void;
  onDismissVizier?: () => void;
  swapButtons?: boolean;
  alignSide?: 'left' | 'right';
  buttonScale?: 'compact' | 'normal';
}

export const ActionControls: React.FC<ActionControlsProps> = React.memo(({
  isRunning,
  onToggleRun,
  onJump,
  isMounted = false,
  isSailing = false,
  isNearBoat = false,
  mountedHorseLabel = null,
  nearbyHorseLabel = null,
  nearbyHorseHasCarriage = false,
  onMountOrDismount,
  isLeadingHorse = false,
  ledHorseLabel = null,
  onToggleLeadHorse,
  areGuardsFollowing = true,
  onToggleGuardsFollow,
  areGuardsProtecting = false,
  onToggleGuardsProtect,
  onGuardsBow,
  canExecute = false,
  onExecute,
  canFeedLion = false,
  onFeedLion,
  canImprison = false,
  onImprison,
  nearbyMoneyCitizen = null,
  onOpenTakeMoney,
  isNearCannon = false,
  cannonCooldown = 0,
  onFireCannon,
  onRotateCannon,
  isNearThrone = false,
  isSittingOnThrone = false,
  onToggleSitThrone,
  isNearRoyalBed = false,
  isSleepingInBed = false,
  onToggleSleepInBed,
  isNearVizier = false,
  onOpenVizierAffairs,
  onDismissVizier,
  swapButtons = false,
  alignSide = 'right',
  buttonScale = 'compact',
}) => {
  const showBoatButton = (isSailing || isNearBoat) && onMountOrDismount;
  const showMountButton = !isSailing && (isMounted || nearbyHorseLabel) && onMountOrDismount;
  const showLeadButton = !isMounted && !isSailing && (isLeadingHorse || nearbyHorseLabel) && onToggleLeadHorse;
  const showMoneyButton = Boolean(nearbyMoneyCitizen && onOpenTakeMoney);
  const showCannonControls = Boolean(isNearCannon && onFireCannon);
  const showThroneButton = Boolean(!isMounted && !isSailing && (isSittingOnThrone || isNearThrone) && onToggleSitThrone);
  const showBedButton = Boolean(!isMounted && !isSailing && !isSittingOnThrone && isNearRoyalBed && onToggleSleepInBed);
  const showVizierControls = Boolean(!isMounted && !isSailing && isNearVizier && (onOpenVizierAffairs || onDismissVizier));
  const isCompact = buttonScale === 'compact';

  const runBtn = (
    <button
      key="run"
      type="button"
      onClick={onToggleRun}
      className={`flex flex-col items-center justify-center rounded-2xl border transition-all active:scale-90 shadow-lg ${
        isCompact ? 'w-10 h-10' : 'w-12 h-12'
      } ${
        isRunning
          ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-stone-950 border-amber-300 ring-2 ring-amber-400/60 shadow-[0_0_12px_rgba(245,195,48,0.45)]'
          : 'bg-stone-900/75 text-amber-300 border-amber-500/35 hover:bg-stone-800/80'
      }`}
    >
      <Flame
        className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} ${
          isRunning ? 'text-stone-950 fill-stone-950' : 'text-amber-400'
        }`}
      />
      <span className="text-[9px] font-black leading-none mt-0.5">
        {isSailing ? 'إسراع' : isMounted ? 'عدو' : 'جري'}
      </span>
    </button>
  );

  const jumpBtn = (
    <button
      key="jump"
      type="button"
      onClick={onJump}
      className={`flex flex-col items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-2 border-emerald-300 shadow-[0_4px_14px_rgba(16,185,129,0.38)] active:scale-90 transition-transform active:bg-emerald-600 ${
        isCompact ? 'w-12 h-12' : 'w-14 h-14'
      }`}
    >
      <ArrowUp className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} stroke-[3] text-white`} />
      <span className="text-[9px] font-black leading-none">{'قفز'}</span>
    </button>
  );

  return (
    <div
      className={`flex flex-col gap-1.5 pointer-events-auto select-none ${
        alignSide === 'left' ? 'items-start' : 'items-end'
      }`}
    >
      {/* Contextual Actions */}
      {(showBedButton ||
        showThroneButton ||
        showVizierControls ||
        showCannonControls ||
        showMoneyButton ||
        canImprison ||
        canFeedLion ||
        canExecute ||
        showBoatButton ||
        showMountButton ||
        showLeadButton) && (
        <div
          className={`flex items-center gap-1.5 flex-wrap ${
            alignSide === 'left' ? 'justify-start' : 'justify-end'
          }`}
        >
          {showBedButton && onToggleSleepInBed && (
            <button
              type="button"
              onClick={onToggleSleepInBed}
              className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black flex items-center gap-1.5 shadow-lg active:scale-95 transition-all ${
                isSleepingInBed
                  ? 'border-amber-200 bg-amber-500 hover:bg-amber-400 text-stone-950'
                  : 'border-indigo-300 bg-gradient-to-r from-indigo-700 to-slate-800 hover:from-indigo-600 hover:to-slate-700 text-amber-100'
              }`}
            >
              <BedDouble className="w-3.5 h-3.5" />
              <span>{isSleepingInBed ? 'النهوض من الفراش' : 'النوم في الفراش'}</span>
            </button>
          )}
          {showVizierControls && (
            <>
              {onOpenVizierAffairs && (
                <button
                  type="button"
                  onClick={onOpenVizierAffairs}
                  className="px-3 py-1.5 rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-[0_0_14px_rgba(16,185,129,0.5)] active:scale-95 transition-all"
                >
                  <ScrollText className="w-3.5 h-3.5 text-amber-200" />
                  <span>أمور الدولة</span>
                </button>
              )}
              {onDismissVizier && (
                <button
                  type="button"
                  onClick={onDismissVizier}
                  className="px-3 py-1.5 rounded-xl border-2 border-slate-400/80 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-amber-200 text-xs font-black flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                >
                  <BedDouble className="w-3.5 h-3.5 text-amber-300" />
                  <span>انصراف</span>
                </button>
              )}
            </>
          )}
          {showThroneButton && onToggleSitThrone && (
            <button
              type="button"
              onClick={onToggleSitThrone}
              className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black flex items-center gap-1.5 shadow-lg active:scale-95 transition-all ${
                isSittingOnThrone
                  ? 'border-rose-300 bg-rose-600/95 hover:bg-rose-500 text-white'
                  : 'border-amber-200 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-stone-950 shadow-[0_0_16px_rgba(245,158,11,0.55)]'
              }`}
            >
              <span className="text-xs">👑</span>
              <span>{isSittingOnThrone ? 'النهوض من العرش' : 'الجلوس على العرش'}</span>
            </button>
          )}
          {showCannonControls && onFireCannon && (
            <div className="flex items-center gap-1.5 shrink-0">
              {onRotateCannon && (
                <>
                  <button
                    type="button"
                    aria-label="تدوير المدفع يساراً"
                    onClick={() => onRotateCannon(0.32)}
                    className="p-2 rounded-xl border border-amber-400/70 bg-stone-900/95 hover:bg-stone-800 text-amber-200 shadow-md active:scale-90 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="تدوير المدفع يميناً"
                    onClick={() => onRotateCannon(-0.32)}
                    className="p-2 rounded-xl border border-amber-400/70 bg-stone-900/95 hover:bg-stone-800 text-amber-200 shadow-md active:scale-90 transition-all"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={cannonCooldown > 0.05}
                onClick={onFireCannon}
                className={`px-3.5 py-2 rounded-xl border-2 text-xs font-black flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shrink-0 ${
                  cannonCooldown > 0.05
                    ? 'border-stone-600 bg-stone-800/90 text-stone-300 cursor-not-allowed'
                    : 'border-amber-200 bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 hover:from-orange-500 hover:to-yellow-400 text-stone-950 shadow-[0_0_16px_rgba(249,115,22,0.6)]'
                }`}
              >
                <span className="text-xs">💥</span>
                <span>
                  {cannonCooldown > 0.05
                    ? `تعبئة المدفع (${cannonCooldown.toFixed(1)}ث)`
                    : 'إطلاق المدفع'}
                </span>
              </button>
            </div>
          )}
          {showMoneyButton && nearbyMoneyCitizen && onOpenTakeMoney && (
            <button
              type="button"
              onClick={onOpenTakeMoney}
              className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black flex items-center gap-1.5 shadow-lg active:scale-95 transition-all ${
                nearbyMoneyCitizen.money > 0
                  ? 'border-yellow-300/90 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 shadow-[0_0_14px_rgba(245,158,11,0.45)]'
                  : 'border-stone-600 bg-stone-800/90 text-stone-300'
              }`}
            >
              <Coins className={`w-3.5 h-3.5 ${nearbyMoneyCitizen.money > 0 ? 'text-stone-950' : 'text-stone-400'}`} />
              <span>
                {nearbyMoneyCitizen.money > 0
                  ? `أخذ مال (${nearbyMoneyCitizen.money.toLocaleString('en-US')})`
                  : 'أخذ مال (0 دينار)'}
              </span>
            </button>
          )}
          {canImprison && onImprison && (
            <button
              type="button"
              onClick={onImprison}
              className="px-3 py-1.5 rounded-xl border-2 border-amber-300/90 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-amber-200 text-xs font-black flex items-center gap-1.5 shadow-[0_0_14px_rgba(245,158,11,0.4)] active:scale-95 transition-all"
            >
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span>سجن</span>
            </button>
          )}
          {canFeedLion && onFeedLion && (
            <button
              type="button"
              onClick={onFeedLion}
              className="px-3 py-1.5 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-orange-800 via-amber-700 to-rose-800 hover:from-orange-700 hover:to-rose-700 text-amber-100 text-xs font-black flex items-center gap-1.5 shadow-[0_0_14px_rgba(245,158,11,0.5)] active:scale-95 transition-all"
            >
              <PawPrint className="w-3.5 h-3.5 text-amber-200" />
              <span>أخذه إلى الأسد</span>
            </button>
          )}
          {canExecute && onExecute && (
            <button
              type="button"
              onClick={onExecute}
              className="px-3 py-1.5 rounded-xl border-2 border-red-300/90 bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 text-white text-xs font-black flex items-center gap-1.5 shadow-[0_0_14px_rgba(220,38,38,0.55)] active:scale-95 transition-all"
            >
              <span className="text-xs">⚔️</span>
              <span>إعدام</span>
            </button>
          )}
          {showLeadButton && (
            <button
              type="button"
              onClick={onToggleLeadHorse}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black flex items-center gap-1 shadow-md active:scale-95 transition-all ${
                isLeadingHorse
                  ? 'bg-emerald-600/95 hover:bg-emerald-500 text-white border-emerald-300'
                  : 'bg-stone-900/90 hover:bg-stone-800 text-amber-200 border-amber-400/60'
              }`}
            >
              <span className="text-xs">🪢</span>
              <span>{isLeadingHorse ? `فك الخيط (${ledHorseLabel || 'الحصان'})` : 'سحب بالخيط'}</span>
            </button>
          )}

          {showBoatButton && (
            <button
              type="button"
              onClick={onMountOrDismount}
              className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all ${
                isSailing
                  ? 'bg-rose-600/95 hover:bg-rose-500 text-white border-rose-300'
                  : 'bg-gradient-to-r from-cyan-400 to-sky-500 text-stone-950 border-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.45)]'
              }`}
            >
              <span className="text-xs">⛵</span>
              <span>{isSailing ? 'نزول من القارب' : 'ركوب القارب'}</span>
            </button>
          )}

          {showMountButton && (
            <button
              type="button"
              onClick={onMountOrDismount}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black flex items-center gap-1 shadow-md active:scale-95 transition-all ${
                isMounted
                  ? 'bg-rose-600/90 hover:bg-rose-500 text-white border-rose-300'
                  : 'bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 border-amber-200'
              }`}
            >
              <span className="text-xs">🐎</span>
              <span>
                {isMounted
                  ? `نزول (${mountedHorseLabel || 'الحصان'})`
                  : nearbyHorseHasCarriage
                  ? `ركوب العربة (${nearbyHorseLabel})`
                  : `ركوب ${nearbyHorseLabel}`}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Small Royal Guard Controls: Protect Formation, Stop/Follow & Bow */}
      {(onToggleGuardsProtect || onToggleGuardsFollow || onGuardsBow) && (
        <div
          className={`flex items-center gap-1.5 flex-wrap ${
            alignSide === 'left' ? 'justify-start' : 'justify-end'
          }`}
        >
          {onToggleGuardsProtect && (
            <button
              type="button"
              onClick={onToggleGuardsProtect}
              className={`px-2.5 py-1 rounded-xl border text-[10px] font-black flex items-center gap-1 shadow-md active:scale-95 transition-all ${
                areGuardsProtecting
                  ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 border-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.55)]'
                  : 'bg-stone-900/85 hover:bg-stone-800 text-amber-200 border-amber-400/50'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>حماية</span>
            </button>
          )}
          {onToggleGuardsFollow && (
            <button
              type="button"
              onClick={onToggleGuardsFollow}
              className={`px-2 py-1 rounded-xl border text-[10px] font-black shadow-md active:scale-95 transition-all ${
                areGuardsFollowing
                  ? 'bg-stone-900/85 hover:bg-stone-800 text-amber-200 border-amber-400/45'
                  : 'bg-rose-600/90 hover:bg-rose-500 text-white border-rose-300'
              }`}
            >
              {areGuardsFollowing ? 'توقيف الحراس' : 'اتبعني'}
            </button>
          )}
          {onGuardsBow && (
            <button
              type="button"
              onClick={onGuardsBow}
              className="px-2 py-1 rounded-xl border text-[10px] font-black bg-stone-900/85 hover:bg-stone-800 text-amber-300 border-amber-400/50 shadow-md active:scale-95 transition-all"
            >
              انحناء
            </button>
          )}
        </div>
      )}

      {/* Compact Main Action Buttons (Run & Jump, customizable order) */}
      <div className="flex items-center gap-2.5">
        {swapButtons ? [jumpBtn, runBtn] : [runBtn, jumpBtn]}
      </div>
    </div>
  );
});
