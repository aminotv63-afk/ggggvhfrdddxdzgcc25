import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GameEngine, EngineStats } from './game/engine';
import { TouchJoystick } from './components/TouchJoystick';
import { ActionControls } from './components/ActionControls';
import {
  GameHUD,
  OrientationMode,
  ControlScale,
  EconomyBannerInfo,
  PrisonBannerInfo,
  VizierBannerInfo,
  WarNoticeBannerInfo,
} from './components/GameHUD';
import { KingdomMapModal, MapCarriagePoint } from './components/KingdomMapModal';
import { StartScreen, GamePhase } from './components/StartScreen';
import { soundManager } from './game/audio';
import { hasTimeTestAccess } from './game/secretAccess';
import {
  GameSaveData,
  SavedPrisonerRecord,
  TreasuryLogEntry,
  loadAutoSavedGame,
  persistAutoSavedGame,
  saveGameToPhoneFile,
  readSaveFileFromInput,
} from './game/saveData';

const DEFAULT_STATS: EngineStats = {
  speedKmh: 0,
  isGrounded: true,
  proximityToFog: 0,
  isBlockedByFog: false,
  fps: 60,
  isMounted: false,
  isSailing: false,
  isNearBoat: false,
  mountedHorseLabel: null,
  nearbyHorseLabel: null,
  nearbyHorseHasCarriage: false,
  isLeadingHorse: false,
  ledHorseLabel: null,
  areGuardsFollowing: true,
  areGuardsProtecting: false,
  hasNearbyExecutable: false,
  isExecuting: false,
  executionPhaseLabel: null,
  executionCountdown: null,
  isNearRomanBorder: false,
  borderGuardMessage: null,
  isAtBorderGate: false,
  playerX: 0,
  playerZ: 0,
  playerFacing: 0,
  isRidingCarriage: false,
  gpsTarget: null,
  gpsDistanceMeters: 0,
  isAutoDrivingCarriage: false,
  gpsArrivedBanner: false,
  gameMinutes: 8 * 60,
  isNight: false,
  nearbyMoneyCitizen: null,
  nearbyImprisonTarget: null,
  imprisonedCitizens: [],
  isNearPrison: false,
  prisonEvent: null,
  isNearCannon: false,
  cannonCooldown: 0,
  isRaining: false,
  isNearThrone: false,
  isSittingOnThrone: false,
  isNearRoyalBed: false,
  isSleepingInBed: false,
  isOnSpeechPodium: false,
  isNearVizier: false,
  vizierPhase: 'sleeping',
  isIntroTour: false,
  introTourLabel: '',
  warPhase: 'idle',
  warPlayerRemaining: 0,
  warRomanRemaining: 0,
  warOutcomeEvent: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const initialSave = useRef<GameSaveData>(loadAutoSavedGame()).current;

  // Screen lifecycle state: Start -> Loading (blocks controls) -> Playing
  const [gamePhase, setGamePhase] = useState<GamePhase>('start');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStageLabel, setLoadStageLabel] = useState('جارٍ تهيئة اللعبة...');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isContextLost, setIsContextLost] = useState(false);

  // Gameplay state
  const [stats, setStats] = useState<EngineStats>(() => ({
    ...DEFAULT_STATS,
    gameMinutes: initialSave.gameMinutes,
  }));
  const [isRunning, setIsRunning] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [mapMode, setMapMode] = useState<'gps' | 'teleport'>('gps');
  const [mapCarriages, setMapCarriages] = useState<MapCarriagePoint[]>([]);
  const [isCleanRecording, setIsCleanRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedVideo, setRecordedVideo] = useState<{
    url: string;
    filename: string;
    sizeMb: string;
  } | null>(null);
  const [sultanName, setSultanName] = useState(initialSave.sultanName);
  const [treasuryGold, setTreasuryGold] = useState<number>(initialSave.treasuryGold);
  const [treasuryLog, setTreasuryLog] = useState<TreasuryLogEntry[]>(initialSave.treasuryLog);
  const [economyBanner, setEconomyBanner] = useState<EconomyBannerInfo | null>(null);
  const [prisonBanner, setPrisonBanner] = useState<PrisonBannerInfo | null>(null);
  const [vizierBanner, setVizierBanner] = useState<VizierBannerInfo | null>(null);
  const [isVizierAffairsOpen, setIsVizierAffairsOpen] = useState(false);
  const [takeMoneyCitizen, setTakeMoneyCitizen] = useState<{
    id: string;
    labelAr: string;
    money: number;
  } | null>(null);
  const [imprisonTarget, setImprisonTarget] = useState<{
    id: string;
    labelAr: string;
  } | null>(null);
  const [playerArmyCount, setPlayerArmyCount] = useState<number>(initialSave.playerArmyCount);
  const [warNoticeBanner, setWarNoticeBanner] = useState<WarNoticeBannerInfo | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // Settings state (orientation + customizable controls)
  const [orientationMode, setOrientationMode] = useState<OrientationMode>(
    initialSave.settings.orientationMode
  );
  const [controlsSwapped, setControlsSwapped] = useState<boolean>(
    initialSave.settings.controlsSwapped
  );
  const [actionButtonsSwapped, setActionButtonsSwapped] = useState<boolean>(
    initialSave.settings.actionButtonsSwapped
  );
  const [controlScale, setControlScale] = useState<ControlScale>(
    initialSave.settings.controlScale
  );
  const [isLowQuality, setIsLowQuality] = useState<boolean>(false);

  // Live refs for zero-stale access inside engine ticks & background persistence
  const treasuryGoldRef = useRef(treasuryGold);
  treasuryGoldRef.current = treasuryGold;
  const treasuryLogRef = useRef(treasuryLog);
  treasuryLogRef.current = treasuryLog;
  const gameMinutesRef = useRef(initialSave.gameMinutes);
  const lastOliveHourRef = useRef(initialSave.lastOliveHour);
  const lastTaxTenHourRef = useRef(initialSave.lastTaxTenHour);
  const citizenMoneyRef = useRef<Record<string, number>>(initialSave.citizenMoney);
  const prisonersRef = useRef<Record<string, SavedPrisonerRecord>>(initialSave.prisoners);
  const playerPosRef = useRef(initialSave.playerPos);
  const hasSeenIntroTourRef = useRef<boolean>(initialSave.hasSeenIntroTour);
  const playerArmyCountRef = useRef<number>(playerArmyCount);
  playerArmyCountRef.current = playerArmyCount;
  const lastArmyGrowthDayRef = useRef<number>(initialSave.lastArmyGrowthDay);
  const bannerTimerRef = useRef<number | null>(null);
  const prisonBannerTimerRef = useRef<number | null>(null);
  const vizierBannerTimerRef = useRef<number | null>(null);
  const warBannerTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordedVideoUrlRef = useRef<string | null>(null);

  const isLowQualityRef = useRef(isLowQuality);
  isLowQualityRef.current = isLowQuality;
  const sultanNameRef = useRef(sultanName);
  sultanNameRef.current = sultanName;
  const orientationModeRef = useRef(orientationMode);
  orientationModeRef.current = orientationMode;
  const controlsSwappedRef = useRef(controlsSwapped);
  controlsSwappedRef.current = controlsSwapped;
  const actionButtonsSwappedRef = useRef(actionButtonsSwapped);
  actionButtonsSwappedRef.current = actionButtonsSwapped;
  const controlScaleRef = useRef(controlScale);
  controlScaleRef.current = controlScale;

  const buildCurrentSaveData = useCallback((): GameSaveData => {
    const engine = engineRef.current;
    if (engine) {
      gameMinutesRef.current = engine.getGameMinutes();
      citizenMoneyRef.current = engine.getCitizenMoneyMap();
      prisonersRef.current = engine.getPrisonersSaveMap();
      playerPosRef.current = engine.getPlayerTransform();
    }
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      sultanName: sultanNameRef.current.trim() || 'السلطان',
      treasuryGold: Math.max(0, Math.floor(treasuryGoldRef.current)),
      gameMinutes: gameMinutesRef.current,
      lastOliveHour: lastOliveHourRef.current,
      lastTaxTenHour: lastTaxTenHourRef.current,
      citizenMoney: citizenMoneyRef.current,
      prisoners: prisonersRef.current,
      treasuryLog: treasuryLogRef.current.slice(0, 6),
      playerPos: playerPosRef.current,
      hasSeenIntroTour: hasSeenIntroTourRef.current,
      playerArmyCount: Math.max(0, Math.floor(playerArmyCountRef.current)),
      lastArmyGrowthDay: lastArmyGrowthDayRef.current,
      settings: {
        orientationMode: orientationModeRef.current,
        controlsSwapped: controlsSwappedRef.current,
        actionButtonsSwapped: actionButtonsSwappedRef.current,
        controlScale: controlScaleRef.current,
        isLowQuality: isLowQualityRef.current,
      },
    };
  }, []);

  const showPrisonBanner = useCallback(
    (type: 'entered' | 'released', labelAr: string, remainingMinutes: number) => {
      if (prisonBannerTimerRef.current !== null) {
        window.clearTimeout(prisonBannerTimerRef.current);
      }
      setPrisonBanner({
        id: Date.now() + Math.floor(Math.random() * 1000),
        type,
        labelAr,
        remainingMinutes,
      });
      prisonBannerTimerRef.current = window.setTimeout(() => {
        setPrisonBanner(null);
        prisonBannerTimerRef.current = null;
      }, 5500);
    },
    []
  );

  const showEconomyBanner = useCallback((title: string, amountText: string, positive: boolean) => {
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    setEconomyBanner({
      id: Date.now() + Math.floor(Math.random() * 1000),
      title,
      amountText,
      positive,
    });
    bannerTimerRef.current = window.setTimeout(() => {
      setEconomyBanner(null);
      bannerTimerRef.current = null;
    }, 4500);
  }, []);

  const showVizierBanner = useCallback((message: string) => {
    if (vizierBannerTimerRef.current !== null) {
      window.clearTimeout(vizierBannerTimerRef.current);
    }
    setVizierBanner({
      id: Date.now() + Math.floor(Math.random() * 1000),
      message,
    });
    vizierBannerTimerRef.current = window.setTimeout(() => {
      setVizierBanner(null);
      vizierBannerTimerRef.current = null;
    }, 4500);
  }, []);

  const showWarNotice = useCallback((text: string, tone: 'info' | 'win' | 'loss' = 'info') => {
    if (warBannerTimerRef.current !== null) {
      window.clearTimeout(warBannerTimerRef.current);
    }
    setWarNoticeBanner({
      id: Date.now() + Math.floor(Math.random() * 1000),
      text,
      tone,
    });
    warBannerTimerRef.current = window.setTimeout(() => {
      setWarNoticeBanner(null);
      warBannerTimerRef.current = null;
    }, 5200);
  }, []);

  const applyTreasuryDelta = useCallback(
    (delta: number, label: string, playSound: boolean = true) => {
      if (!Number.isFinite(delta) || delta === 0) return;
      const roundedDelta = Math.trunc(delta);
      const nextGold = Math.max(0, Math.floor(treasuryGoldRef.current + roundedDelta));
      treasuryGoldRef.current = nextGold;

      const entry: TreasuryLogEntry = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        label,
        delta: roundedDelta,
      };
      const nextLog = [entry, ...treasuryLogRef.current].slice(0, 6);
      treasuryLogRef.current = nextLog;

      setTreasuryGold(nextGold);
      setTreasuryLog(nextLog);
      if (playSound) {
        soundManager.playCoinChime();
      }
    },
    []
  );

  // Persist user settings & treasury cleanly
  useEffect(() => {
    persistAutoSavedGame(buildCurrentSaveData());
  }, [
    orientationMode,
    controlsSwapped,
    actionButtonsSwapped,
    controlScale,
    isLowQuality,
    sultanName,
    treasuryGold,
    treasuryLog,
    playerArmyCount,
    buildCurrentSaveData,
  ]);

  // Periodic background auto-save during active gameplay + page close flush
  useEffect(() => {
    if (gamePhase !== 'playing') return;
    const interval = window.setInterval(() => {
      persistAutoSavedGame(buildCurrentSaveData());
    }, 5000);
    const onUnload = () => {
      persistAutoSavedGame(buildCurrentSaveData());
    };
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [gamePhase, buildCurrentSaveData]);

  // Keep sound manager synced
  useEffect(() => {
    soundManager.enabled = isSoundEnabled;
  }, [isSoundEnabled]);

  // Apply screen orientation lock when supported & trigger WebGL viewport resize
  useEffect(() => {
    const orientationApi = (screen as unknown as {
      orientation?: { lock?: (type: string) => Promise<void>; unlock?: () => void };
    }).orientation;

    try {
      if (orientationMode === 'portrait') {
        orientationApi?.lock?.('portrait')?.catch(() => {});
      } else if (orientationMode === 'landscape') {
        orientationApi?.lock?.('landscape')?.catch(() => {});
      } else {
        orientationApi?.unlock?.();
      }
    } catch {
      // Orientation lock not supported in iframe/desktop; CSS stage framing handles it seamlessly
    }

    const raf = requestAnimationFrame(() => {
      engineRef.current?.refreshViewportSize();
    });
    return () => cancelAnimationFrame(raf);
  }, [orientationMode]);

  // Touch drag for camera rotation
  const cameraTouchRef = useRef<{ startX: number; startY: number; touchId: number | null }>({
    startX: 0,
    startY: 0,
    touchId: null,
  });

  // Dispose engine cleanly on page unmount
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
      if (prisonBannerTimerRef.current !== null) {
        window.clearTimeout(prisonBannerTimerRef.current);
      }
      if (vizierBannerTimerRef.current !== null) {
        window.clearTimeout(vizierBannerTimerRef.current);
      }
      if (warBannerTimerRef.current !== null) {
        window.clearTimeout(warBannerTimerRef.current);
      }
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore cleanup stop errors
        }
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recordedVideoUrlRef.current) {
        URL.revokeObjectURL(recordedVideoUrlRef.current);
      }
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  // Initialize GameEngine ONLY after the user taps "تشغيل اللعبة" and wait for full load
  useEffect(() => {
    if (gamePhase !== 'loading' || !canvasMountRef.current) return;

    const abortController = new AbortController();
    let mounted = true;

    // Dispose any previous instance before creating a fresh one
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }

    setLoadError(null);
    setLoadProgress(4);
    setLoadStageLabel('جارٍ تهيئة محرك العرض...');
    setIsContextLost(false);

    GameEngine.createAsync(canvasMountRef.current, {
      lowQuality: isLowQualityRef.current,
      sultanName: sultanNameRef.current.trim() || 'السلطان',
      initialGameMinutes: gameMinutesRef.current,
      initialCitizenMoney: citizenMoneyRef.current,
      initialPrisoners: prisonersRef.current,
      initialPlayerPos: playerPosRef.current,
      playIntroTour: !hasSeenIntroTourRef.current,
      onIntroTourComplete: () => {
        hasSeenIntroTourRef.current = true;
        persistAutoSavedGame(buildCurrentSaveData());
      },
      signal: abortController.signal,
      onProgress: (progress, label) => {
        if (!mounted || abortController.signal.aborted) return;
        setLoadProgress(progress);
        setLoadStageLabel(label);
      },
      onContextLost: () => {
        if (mounted) setIsContextLost(true);
      },
      onContextRestored: () => {
        if (mounted) setIsContextLost(false);
      },
    })
      .then((engine) => {
        if (!mounted || abortController.signal.aborted || !engine) {
          engine?.destroy();
          return;
        }
        engineRef.current = engine;
        citizenMoneyRef.current = engine.getCitizenMoneyMap();

        engine.onStatsUpdate = (newStats) => {
          gameMinutesRef.current = newStats.gameMinutes;

          let economyChanged = false;

          // Daily army growth: +100 soldiers every new in-game day (24h = 1,440 game minutes)
          const curDayIndex = Math.floor(newStats.gameMinutes / 1440);
          if (curDayIndex > lastArmyGrowthDayRef.current) {
            const daysPassed = curDayIndex - lastArmyGrowthDayRef.current;
            lastArmyGrowthDayRef.current = curDayIndex;
            const addedSoldiers = daysPassed * 100;
            const nextArmy = playerArmyCountRef.current + addedSoldiers;
            playerArmyCountRef.current = nextArmy;
            setPlayerArmyCount(nextArmy);
            showWarNotice(
              `انضم +${addedSoldiers.toLocaleString('en-US')} جندي جديد إلى جيش المملكة (الإجمالي: ${nextArmy.toLocaleString('en-US')})`,
              'info'
            );
            economyChanged = true;
          }

          // Every 1 in-game hour (60 real seconds): +50,000 from olive harvest
          const curHour = Math.floor(newStats.gameMinutes / 60);
          if (curHour > lastOliveHourRef.current) {
            const hoursElapsed = curHour - lastOliveHourRef.current;
            lastOliveHourRef.current = curHour;
            const oliveIncome = hoursElapsed * 50000;
            applyTreasuryDelta(oliveIncome, 'محصول بيع الزيتون', true);
            showEconomyBanner(
              'محصول بيع الزيتون',
              `+${oliveIncome.toLocaleString('en-US')}`,
              true
            );
            economyChanged = true;
          }

          // Every 10 in-game hours (600 real seconds): Roman tax, Egypt debt, Kingdom supplies/food & People stipend (1,000 each)
          const curTenHour = Math.floor(newStats.gameMinutes / 600);
          if (curTenHour > lastTaxTenHourRef.current) {
            const blocks = curTenHour - lastTaxTenHourRef.current;
            lastTaxTenHourRef.current = curTenHour;
            const romanTax = blocks * 100000;
            const egyptDebt = blocks * 2000;
            const suppliesCost = blocks * 25000;
            const peopleStipend = blocks * 100000;
            applyTreasuryDelta(-romanTax, 'ضرائب الرومان', false);
            applyTreasuryDelta(-egyptDebt, 'دين ملك مصر', false);
            applyTreasuryDelta(-suppliesCost, 'شراء لوازم ومواد غذائية للمملكة', false);
            applyTreasuryDelta(-peopleStipend, 'منحة الشعب (1,000 لكل فرد)', false);
            engine.distributeStipendToCitizens(blocks * 1000);
            citizenMoneyRef.current = engine.getCitizenMoneyMap();
            const totalDeducted = romanTax + egyptDebt + suppliesCost + peopleStipend;
            showEconomyBanner(
              'ضرائب ولوازم المملكة ومنحة الشعب',
              `-${totalDeducted.toLocaleString('en-US')}`,
              false
            );
            economyChanged = true;
          }

          if (newStats.prisonEvent) {
            showPrisonBanner(
              newStats.prisonEvent.type,
              newStats.prisonEvent.labelAr,
              newStats.prisonEvent.remainingMinutes
            );
            economyChanged = true;
          }

          if (newStats.warOutcomeEvent) {
            const ev = newStats.warOutcomeEvent;
            playerArmyCountRef.current = ev.survivingArmy;
            setPlayerArmyCount(ev.survivingArmy);
            if (ev.victory) {
              applyTreasuryDelta(ev.rewardGold, 'غنائم النصر على جيش رومان', true);
              showWarNotice(
                `انتصر جيش المملكة على جيش رومان! غنائم الحرب +${ev.rewardGold.toLocaleString('en-US')} دينار`,
                'win'
              );
            } else {
              showWarNotice(
                `خسر الجيش المعركة أمام جيش رومان — أُعيد تجهيز ${ev.survivingArmy} جندي، وبقي السلطان محمياً`,
                'loss'
              );
            }
            economyChanged = true;
          }

          if (economyChanged) {
            persistAutoSavedGame(buildCurrentSaveData());
          }

          setStats(newStats);
        };
        setIsRunning(false);
        setLoadProgress(100);
        setGamePhase('playing');
      })
      .catch((err) => {
        if (!mounted || abortController.signal.aborted) return;
        console.error('Failed to initialize 3D game engine:', err);
        setLoadError(
          'حدث ضغط أثناء تشغيل الرسوميات ثلاثية الأبعاد. يمكنك إعادة المحاولة أو تفعيل "مانع اللاق" من الإعدادات.'
        );
      });

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [gamePhase, loadAttempt, applyTreasuryDelta, showEconomyBanner, showPrisonBanner, showWarNotice, buildCurrentSaveData]);

  const handleStartGame = () => {
    if (gamePhase !== 'start') return;
    soundManager.unlock();
    setStats({
      ...DEFAULT_STATS,
      gameMinutes: gameMinutesRef.current,
    });
    setLoadAttempt((v) => v + 1);
    setGamePhase('loading');
  };

  const handleRetryLoad = () => {
    setLoadAttempt((v) => v + 1);
    setGamePhase('loading');
  };

  const stopActiveRecordingInternal = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore stop error
      }
    }
    setIsCleanRecording(false);
  }, []);

  const handleReturnToMenu = useCallback(() => {
    stopActiveRecordingInternal();
    persistAutoSavedGame(buildCurrentSaveData());
    soundManager.stopAmbience();
    engineRef.current?.destroy();
    engineRef.current = null;
    setIsRunning(false);
    setIsMapOpen(false);
    setMapMode('gps');
    setIsVizierAffairsOpen(false);
    setVizierBanner(null);
    setTakeMoneyCitizen(null);
    setImprisonTarget(null);
    setStats({
      ...DEFAULT_STATS,
      gameMinutes: gameMinutesRef.current,
    });
    setLoadError(null);
    setLoadProgress(0);
    setIsContextLost(false);
    setGamePhase('start');
  }, [buildCurrentSaveData, stopActiveRecordingInternal]);

  const handleOpenMap = useCallback(() => {
    if (engineRef.current) {
      setMapCarriages(engineRef.current.getCarriagePositions());
    }
    setMapMode('gps');
    setIsMapOpen(true);
  }, []);

  const handleOpenTeleportMap = useCallback(() => {
    if (engineRef.current) {
      setMapCarriages(engineRef.current.getCarriagePositions());
    }
    setMapMode('teleport');
    setIsMapOpen(true);
  }, []);

  const handleSelectGps = useCallback((x: number, z: number) => {
    engineRef.current?.setGpsTarget(x, z);
  }, []);

  const handleClearGps = useCallback(() => {
    engineRef.current?.clearGpsTarget();
  }, []);

  // Keyboard M shortcut for toggling Kingdom Map
  useEffect(() => {
    if (gamePhase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'm') {
        setIsMapOpen((prev) => {
          const next = !prev;
          if (next && engineRef.current) {
            setMapCarriages(engineRef.current.getCarriagePositions());
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gamePhase]);

  // Controls Handlers
  const handleJoystickMove = useCallback((x: number, y: number) => {
    soundManager.unlock();
    if (engineRef.current) {
      engineRef.current.setStickInput(x, y);
    }
  }, []);

  const handleToggleRun = useCallback(() => {
    setIsRunning((prev) => {
      const next = !prev;
      if (engineRef.current) {
        engineRef.current.setRunning(next);
      }
      return next;
    });
  }, []);

  const handleJump = useCallback(() => {
    engineRef.current?.jump();
  }, []);

  const handleMountOrDismount = useCallback(() => {
    engineRef.current?.mountOrDismount();
  }, []);

  const handleToggleSitThrone = useCallback(() => {
    soundManager.unlock();
    engineRef.current?.sitOrStandFromThrone();
  }, []);

  const handleOpenVizierAffairs = useCallback(() => {
    soundManager.unlock();
    setIsVizierAffairsOpen(true);
  }, []);

  const handleDismissVizier = useCallback(() => {
    soundManager.unlock();
    const ok = engineRef.current?.dismissVizier();
    if (ok) {
      setIsVizierAffairsOpen(false);
      showVizierBanner('انصرف الوزير بأمر السلطان — يتجه الآن إلى غرفته للنوم');
    }
  }, [showVizierBanner]);

  const handleToggleLeadHorse = useCallback(() => {
    engineRef.current?.toggleLeadHorse();
  }, []);

  const handleToggleGuardsFollow = useCallback(() => {
    engineRef.current?.toggleGuardsFollow();
  }, []);

  const handleToggleGuardsProtect = useCallback(() => {
    soundManager.unlock();
    engineRef.current?.toggleGuardsProtectMode();
  }, []);

  const handleGuardsBow = useCallback(() => {
    engineRef.current?.triggerGuardsBow();
  }, []);

  const handleExecuteCitizen = useCallback(() => {
    engineRef.current?.executeNearestCitizen();
  }, []);

  const handleFeedLion = useCallback(() => {
    soundManager.unlock();
    engineRef.current?.feedNearestCitizenToLion();
  }, []);

  const handleToggleSleepInBed = useCallback(() => {
    soundManager.unlock();
    engineRef.current?.toggleSleepInRoyalBed();
  }, []);

  const handleFireCannon = useCallback(() => {
    soundManager.unlock();
    engineRef.current?.fireCannon();
  }, []);

  const handleRotateCannon = useCallback((deltaYaw: number) => {
    soundManager.unlock();
    engineRef.current?.rotateCannonAim(deltaYaw);
  }, []);

  const handleImprisonCitizen = useCallback(() => {
    if (stats.nearbyImprisonTarget) {
      setImprisonTarget({ ...stats.nearbyImprisonTarget });
    }
  }, [stats.nearbyImprisonTarget]);

  const handleConfirmImprison = useCallback((sentenceMinutes: number) => {
    setImprisonTarget(null);
    if (engineRef.current) {
      engineRef.current.imprisonNearestCitizen(sentenceMinutes);
    }
  }, []);

  const handleReleasePrisoner = useCallback(
    (citizenId: string) => {
      if (engineRef.current?.releasePrisoner(citizenId)) {
        persistAutoSavedGame(buildCurrentSaveData());
      }
    },
    [buildCurrentSaveData]
  );

  const handleOpenTakeMoney = useCallback(() => {
    if (stats.nearbyMoneyCitizen) {
      setTakeMoneyCitizen({ ...stats.nearbyMoneyCitizen });
    }
  }, [stats.nearbyMoneyCitizen]);

  const handleConfirmTakeMoney = useCallback(
    (citizenId: string, amount: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      const result = engine.takeMoneyFromCitizen(citizenId, amount);
      if (result && result.taken > 0) {
        applyTreasuryDelta(result.taken, `أخذ مال (${result.labelAr})`, true);
        citizenMoneyRef.current = engine.getCitizenMoneyMap();
        showEconomyBanner(
          `أخذ مال من ${result.labelAr}`,
          `+${result.taken.toLocaleString('en-US')}`,
          true
        );
        persistAutoSavedGame(buildCurrentSaveData());
      }
      setTakeMoneyCitizen(null);
    },
    [applyTreasuryDelta, showEconomyBanner, buildCurrentSaveData]
  );

  const handleDistributeStipend = useCallback(() => {
    if (treasuryGoldRef.current < 100000) return;
    applyTreasuryDelta(-100000, 'منحة الشعب (1,000 لكل فرد)', true);
    if (engineRef.current) {
      engineRef.current.distributeStipendToCitizens(1000);
      citizenMoneyRef.current = engineRef.current.getCitizenMoneyMap();
    }
    showEconomyBanner('تم توزيع 1,000 دينار لكل مواطن', '-100,000', false);
    persistAutoSavedGame(buildCurrentSaveData());
  }, [applyTreasuryDelta, showEconomyBanner, buildCurrentSaveData]);

  const handleSaveToFile = useCallback(async (): Promise<
    'picker' | 'download' | 'cancelled' | 'error'
  > => {
    try {
      const data = buildCurrentSaveData();
      persistAutoSavedGame(data);
      return await saveGameToPhoneFile(data);
    } catch {
      return 'error';
    }
  }, [buildCurrentSaveData]);

  const handleLoadFromFile = useCallback(async (file: File): Promise<boolean> => {
    try {
      const loaded = await readSaveFileFromInput(file);
      sultanNameRef.current = loaded.sultanName;
      treasuryGoldRef.current = loaded.treasuryGold;
      treasuryLogRef.current = loaded.treasuryLog;
      gameMinutesRef.current = loaded.gameMinutes;
      lastOliveHourRef.current = loaded.lastOliveHour;
      lastTaxTenHourRef.current = loaded.lastTaxTenHour;
      citizenMoneyRef.current = loaded.citizenMoney;
      prisonersRef.current = loaded.prisoners;
      playerPosRef.current = loaded.playerPos;
      hasSeenIntroTourRef.current = loaded.hasSeenIntroTour;
      playerArmyCountRef.current = loaded.playerArmyCount;
      lastArmyGrowthDayRef.current = loaded.lastArmyGrowthDay;

      setSultanName(loaded.sultanName);
      setTreasuryGold(loaded.treasuryGold);
      setTreasuryLog(loaded.treasuryLog);
      setPlayerArmyCount(loaded.playerArmyCount);
      setOrientationMode(loaded.settings.orientationMode);
      setControlsSwapped(loaded.settings.controlsSwapped);
      setActionButtonsSwapped(loaded.settings.actionButtonsSwapped);
      setControlScale(loaded.settings.controlScale);
      setIsLowQuality(loaded.settings.isLowQuality);

      const engine = engineRef.current;
      if (engine) {
        engine.setSultanName(loaded.sultanName);
        engine.setGameMinutes(loaded.gameMinutes);
        engine.setCitizenMoneyMap(loaded.citizenMoney);
        engine.setPrisonersSaveMap(loaded.prisoners);
        engine.setPerformanceMode(loaded.settings.isLowQuality);
        if (loaded.playerPos) {
          engine.setPlayerTransform(
            loaded.playerPos.x,
            loaded.playerPos.y,
            loaded.playerPos.z,
            loaded.playerPos.facing
          );
        }
      }

      persistAutoSavedGame(loaded);
      soundManager.playCoinChime();
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleToggleSound = () => {
    const next = !isSoundEnabled;
    setIsSoundEnabled(next);
    soundManager.enabled = next;
  };

  const handleToggleLowQuality = () => {
    const next = !isLowQuality;
    setIsLowQuality(next);
    if (engineRef.current) {
      engineRef.current.setPerformanceMode(next);
    }
  };

  const isTimeControlUnlocked = useMemo(() => hasTimeTestAccess(sultanName), [sultanName]);

  const handleSetTimePeriod = useCallback(
    (period: 'day' | 'night') => {
      if (!isTimeControlUnlocked) return;
      const engine = engineRef.current;
      if (!engine) return;
      const currentMinutes = engine.getGameMinutes();
      const currentDay = Math.floor(currentMinutes / 1440);
      const targetMinutes = currentDay * 1440 + (period === 'day' ? 12 : 22) * 60;

      gameMinutesRef.current = targetMinutes;
      lastOliveHourRef.current = Math.floor(targetMinutes / 60);
      lastTaxTenHourRef.current = Math.floor(targetMinutes / 600);
      engine.setGameMinutes(targetMinutes);

      setStats((prev) => ({
        ...prev,
        gameMinutes: targetMinutes,
        isNight: period === 'night',
      }));
      persistAutoSavedGame(buildCurrentSaveData());
    },
    [isTimeControlUnlocked, buildCurrentSaveData]
  );

  const handleToggleRain = useCallback(() => {
    if (!isTimeControlUnlocked) return;
    const engine = engineRef.current;
    if (!engine) return;
    soundManager.unlock();
    const nextRaining = engine.toggleRain();
    setStats((prev) => ({
      ...prev,
      isRaining: nextRaining,
    }));
  }, [isTimeControlUnlocked]);

  const handleTriggerThunder = useCallback(() => {
    if (!isTimeControlUnlocked) return;
    const engine = engineRef.current;
    if (!engine) return;
    soundManager.unlock();
    engine.triggerThunder();
  }, [isTimeControlUnlocked]);

  const handleSetTreasuryGold = useCallback(
    (rawAmount: number) => {
      if (!isTimeControlUnlocked || !Number.isFinite(rawAmount)) return;
      const clamped = Math.max(0, Math.min(999999999, Math.floor(rawAmount)));
      const delta = clamped - treasuryGoldRef.current;
      treasuryGoldRef.current = clamped;
      const entry: TreasuryLogEntry = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        label: 'تعديل الخزينة (قائمة الغش)',
        delta,
      };
      const nextLog = [entry, ...treasuryLogRef.current].slice(0, 6);
      treasuryLogRef.current = nextLog;
      setTreasuryGold(clamped);
      setTreasuryLog(nextLog);
      soundManager.playCoinChime();
      persistAutoSavedGame(buildCurrentSaveData());
    },
    [isTimeControlUnlocked, buildCurrentSaveData]
  );

  const handleTeleportSultan = useCallback(
    (x: number, z: number) => {
      if (!isTimeControlUnlocked) return;
      soundManager.unlock();
      engineRef.current?.teleportSultanTo(x, z);
    },
    [isTimeControlUnlocked]
  );

  const handleDeclareWar = useCallback(() => {
    soundManager.unlock();
    const currentArmy = playerArmyCountRef.current;
    if (currentArmy < 5000) {
      showWarNotice(
        `يلزم 5,000 جندي لإعلان الحرب على جيش رومان (يزيد الجيش +100 كل يوم — لديك الآن ${currentArmy.toLocaleString('en-US')})`,
        'info'
      );
      return;
    }
    const ok = engineRef.current?.declareWar(currentArmy);
    if (ok) {
      showWarNotice(
        'تم إعلان الحرب! تقدم جيش رومان (5,000 جندي بالزي الأحمر)، الرعية تهرب وجيش المملكة يدافع!',
        'info'
      );
    }
  }, [showWarNotice]);

  const handleSetArmyCount = useCallback(
    (rawCount: number) => {
      if (!isTimeControlUnlocked || !Number.isFinite(rawCount)) return;
      const clamped = Math.max(0, Math.min(999999, Math.floor(rawCount)));
      playerArmyCountRef.current = clamped;
      setPlayerArmyCount(clamped);
      soundManager.playCoinChime();
      persistAutoSavedGame(buildCurrentSaveData());
    },
    [isTimeControlUnlocked, buildCurrentSaveData]
  );

  const handleClearRecordedVideo = useCallback(() => {
    if (recordedVideoUrlRef.current) {
      URL.revokeObjectURL(recordedVideoUrlRef.current);
      recordedVideoUrlRef.current = null;
    }
    setRecordedVideo(null);
  }, []);

  const handleStartCleanRecording = useCallback(() => {
    if (!isTimeControlUnlocked || isCleanRecording) return;
    const engine = engineRef.current;
    const canvas = engine?.getCanvasElement();
    if (!canvas || typeof MediaRecorder === 'undefined') return;

    soundManager.unlock();

    if (recordedVideoUrlRef.current) {
      URL.revokeObjectURL(recordedVideoUrlRef.current);
      recordedVideoUrlRef.current = null;
    }
    setRecordedVideo(null);

    let videoStream: MediaStream;
    try {
      videoStream = canvas.captureStream(60);
    } catch {
      videoStream = canvas.captureStream(30);
    }

    const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
    const audioStream = soundManager.getRecordingAudioStream();
    if (audioStream) {
      tracks.push(...audioStream.getAudioTracks());
    }
    const combinedStream = new MediaStream(tracks);
    recordingStreamRef.current = combinedStream;

    const mimeCandidates = [
      'video/mp4;codecs=avc1,mp4a',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    let chosenMime = '';
    for (const mime of mimeCandidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        chosenMime = mime;
        break;
      }
    }

    let recorder: MediaRecorder;
    try {
      const options: MediaRecorderOptions = {
        videoBitsPerSecond: 14_000_000,
        audioBitsPerSecond: 192_000,
      };
      if (chosenMime) options.mimeType = chosenMime;
      recorder = new MediaRecorder(combinedStream, options);
    } catch {
      recorder = chosenMime
        ? new MediaRecorder(combinedStream, { mimeType: chosenMime })
        : new MediaRecorder(combinedStream);
    }

    recordedChunksRef.current = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        recordedChunksRef.current.push(ev.data);
      }
    };

    recorder.onstop = () => {
      const streamToClose = recordingStreamRef.current;
      recordingStreamRef.current = null;
      if (streamToClose) {
        streamToClose.getVideoTracks().forEach((t) => t.stop());
      }
      const chunks = recordedChunksRef.current;
      recordedChunksRef.current = [];
      if (chunks.length === 0) return;

      const finalType = recorder.mimeType || chosenMime || 'video/webm';
      const blob = new Blob(chunks, { type: finalType });
      const url = URL.createObjectURL(blob);
      recordedVideoUrlRef.current = url;
      const ext = finalType.includes('mp4') ? 'mp4' : 'webm';
      const filename = `sultan-kingdom-HD-${Date.now()}.${ext}`;
      const sizeMb = `${(blob.size / (1024 * 1024)).toFixed(1)} MB`;

      setRecordedVideo({ url, filename, sizeMb });

      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        // Fallback manual save banner remains visible in HUD
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start(400);
    setIsMapOpen(false);
    setRecordingSeconds(0);
    setIsCleanRecording(true);

    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
    }
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  }, [isTimeControlUnlocked, isCleanRecording]);

  const handleStopCleanRecording = useCallback(() => {
    stopActiveRecordingInternal();
  }, [stopActiveRecordingInternal]);

  const handleChangeSultanName = (name: string) => {
    setSultanName(name);
    if (engineRef.current) {
      engineRef.current.setSultanName(name.trim() || 'السلطان');
    }
  };

  // Camera Orbit Swiping
  const onCameraTouchStart = (e: React.TouchEvent) => {
    soundManager.unlock();
    if (cameraTouchRef.current.touchId !== null) return;
    const touch = e.changedTouches[0];
    cameraTouchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      touchId: touch.identifier,
    };
  };

  const onCameraTouchMove = (e: React.TouchEvent) => {
    if (cameraTouchRef.current.touchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === cameraTouchRef.current.touchId) {
        const dx = touch.clientX - cameraTouchRef.current.startX;
        const dy = touch.clientY - cameraTouchRef.current.startY;
        cameraTouchRef.current.startX = touch.clientX;
        cameraTouchRef.current.startY = touch.clientY;

        if (engineRef.current) {
          engineRef.current.rotateCameraByDelta(dx * 0.006, dy * 0.005);
        }
        break;
      }
    }
  };

  const onCameraTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === cameraTouchRef.current.touchId) {
        cameraTouchRef.current.touchId = null;
        break;
      }
    }
  };

  // Stage container styling for Portrait vs Landscape orientation modes
  const stageClass =
    orientationMode === 'portrait'
      ? 'relative h-[100dvh] w-full max-w-[min(100vw,calc(100dvh*9/16))] mx-auto overflow-hidden bg-stone-950 shadow-2xl border-x border-stone-800/70'
      : orientationMode === 'landscape'
      ? 'relative w-full h-[min(100dvh,calc(100vw*9/16))] my-auto overflow-hidden bg-stone-950'
      : 'relative w-full h-[100dvh] overflow-hidden bg-stone-950';

  const joystickSize = controlScale === 'compact' ? 88 : 104;

  const joystickNode = (
    <div key="joystick" className="pointer-events-auto">
      <TouchJoystick onMove={handleJoystickMove} size={joystickSize} />
    </div>
  );

  const actionsNode = (
    <div key="actions" className="pointer-events-auto">
      <ActionControls
        isRunning={isRunning}
        onToggleRun={handleToggleRun}
        onJump={handleJump}
        isMounted={stats.isMounted}
        isSailing={stats.isSailing}
        isNearBoat={stats.isNearBoat}
        mountedHorseLabel={stats.mountedHorseLabel}
        nearbyHorseLabel={stats.nearbyHorseLabel}
        nearbyHorseHasCarriage={stats.nearbyHorseHasCarriage}
        onMountOrDismount={handleMountOrDismount}
        isLeadingHorse={stats.isLeadingHorse}
        ledHorseLabel={stats.ledHorseLabel}
        onToggleLeadHorse={handleToggleLeadHorse}
        areGuardsFollowing={stats.areGuardsFollowing}
        onToggleGuardsFollow={handleToggleGuardsFollow}
        areGuardsProtecting={stats.areGuardsProtecting}
        onToggleGuardsProtect={handleToggleGuardsProtect}
        onGuardsBow={handleGuardsBow}
        canExecute={stats.hasNearbyExecutable && !stats.isExecuting}
        onExecute={handleExecuteCitizen}
        canFeedLion={stats.hasNearbyExecutable && !stats.isExecuting}
        onFeedLion={handleFeedLion}
        canImprison={stats.hasNearbyExecutable && !stats.isExecuting}
        onImprison={handleImprisonCitizen}
        nearbyMoneyCitizen={stats.nearbyMoneyCitizen}
        onOpenTakeMoney={handleOpenTakeMoney}
        isNearCannon={stats.isNearCannon}
        cannonCooldown={stats.cannonCooldown}
        onFireCannon={handleFireCannon}
        onRotateCannon={handleRotateCannon}
        isNearThrone={stats.isNearThrone}
        isSittingOnThrone={stats.isSittingOnThrone}
        onToggleSitThrone={handleToggleSitThrone}
        isNearRoyalBed={stats.isNearRoyalBed}
        isSleepingInBed={stats.isSleepingInBed}
        onToggleSleepInBed={handleToggleSleepInBed}
        isNearVizier={stats.isNearVizier}
        onOpenVizierAffairs={handleOpenVizierAffairs}
        onDismissVizier={handleDismissVizier}
        swapButtons={actionButtonsSwapped}
        alignSide={controlsSwapped ? 'left' : 'right'}
        buttonScale={controlScale}
      />
    </div>
  );

  return (
    <main className="relative w-full h-[100dvh] flex items-center justify-center overflow-hidden bg-stone-950 touch-none select-none">
      <div className={stageClass}>
        {/* 1. Isolated WebGL 3D Canvas Container (empty until user presses Play) */}
        <div
          ref={canvasMountRef}
          className="absolute inset-0 w-full h-full z-0 overflow-hidden"
        />

        {/* 2. Start & Blocking Loading Screen (prevents clicks & lag before world finishes loading) */}
        {gamePhase !== 'playing' && (
          <StartScreen
            phase={gamePhase}
            progress={loadProgress}
            stageLabel={loadStageLabel}
            loadError={loadError}
            sultanName={sultanName}
            onChangeSultanName={handleChangeSultanName}
            isSoundEnabled={isSoundEnabled}
            onToggleSound={handleToggleSound}
            orientationMode={orientationMode}
            onChangeOrientationMode={setOrientationMode}
            onStartGame={handleStartGame}
            onRetryLoad={handleRetryLoad}
            onCancelLoad={handleReturnToMenu}
          />
        )}

        {/* 3. Active Gameplay HUD & Touch Controls (hidden during Clean HD Screen Recording & First-Time Aerial Intro Tour) */}
        {gamePhase === 'playing' && stats.isIntroTour && (
          <div className="absolute inset-0 z-40 pointer-events-none flex flex-col justify-between p-4">
            <div className="flex items-start justify-between gap-2 pointer-events-auto">
              <div className="bg-stone-950/88 border border-amber-400/60 rounded-2xl px-3.5 py-2 shadow-2xl text-right">
                <div className="text-[10px] font-bold text-amber-300/90">جولة تعريفية في المملكة</div>
                <div className="text-xs sm:text-sm font-black text-white">
                  {stats.introTourLabel || 'مملكة السلطان'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => engineRef.current?.skipIntroTour()}
                className="px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black shadow-xl active:scale-95 transition-all"
              >
                تخطي الجولة
              </button>
            </div>
            <div className="text-center pb-2">
              <span className="inline-block bg-stone-950/85 border border-amber-500/40 text-amber-200 text-[11px] font-black px-3.5 py-1.5 rounded-xl shadow-lg">
                تستعرض الكاميرا جميع أنحاء المملكة قبل التوقف عند السلطان...
              </span>
            </div>
          </div>
        )}

        {gamePhase === 'playing' && !stats.isIntroTour && (
          <>
            {!isCleanRecording && (
              <>
                <GameHUD
                  stats={stats}
                  sultanName={sultanName}
                  onChangeSultanName={handleChangeSultanName}
                  treasuryGold={treasuryGold}
                  treasuryLog={treasuryLog}
                  onApplyTreasuryDelta={(delta, label) => applyTreasuryDelta(delta, label, true)}
                  onDistributeStipend={handleDistributeStipend}
                  economyBanner={economyBanner}
                  prisonBanner={prisonBanner}
                  vizierBanner={vizierBanner}
                  isVizierAffairsOpen={isVizierAffairsOpen}
                  onCloseVizierAffairs={() => setIsVizierAffairsOpen(false)}
                  onDismissVizier={handleDismissVizier}
                  takeMoneyCitizen={takeMoneyCitizen}
                  onCloseTakeMoney={() => setTakeMoneyCitizen(null)}
                  onConfirmTakeMoney={handleConfirmTakeMoney}
                  imprisonTarget={imprisonTarget}
                  onCloseImprison={() => setImprisonTarget(null)}
                  onConfirmImprison={handleConfirmImprison}
                  onReleasePrisoner={handleReleasePrisoner}
                  onSaveToFile={handleSaveToFile}
                  onLoadFromFile={handleLoadFromFile}
                  isSoundEnabled={isSoundEnabled}
                  onToggleSound={handleToggleSound}
                  orientationMode={orientationMode}
                  onChangeOrientationMode={setOrientationMode}
                  controlsSwapped={controlsSwapped}
                  onToggleSwapControls={() => setControlsSwapped((v) => !v)}
                  actionButtonsSwapped={actionButtonsSwapped}
                  onToggleSwapActionButtons={() => setActionButtonsSwapped((v) => !v)}
                  controlScale={controlScale}
                  onChangeControlScale={setControlScale}
                  isLowQuality={isLowQuality}
                  onToggleLowQuality={handleToggleLowQuality}
                  onOpenMap={handleOpenMap}
                  onClearGps={handleClearGps}
                  onReturnToMenu={handleReturnToMenu}
                  isTimeControlUnlocked={isTimeControlUnlocked}
                  onSetTimePeriod={handleSetTimePeriod}
                  onToggleRain={handleToggleRain}
                  onTriggerThunder={handleTriggerThunder}
                  onSetTreasuryGold={handleSetTreasuryGold}
                  onOpenTeleportMap={handleOpenTeleportMap}
                  onStartCleanRecording={handleStartCleanRecording}
                  recordedVideo={recordedVideo}
                  onClearRecordedVideo={handleClearRecordedVideo}
                  playerArmyCount={playerArmyCount}
                  onDeclareWar={handleDeclareWar}
                  onSetArmyCount={handleSetArmyCount}
                  warNoticeBanner={warNoticeBanner}
                />

                <KingdomMapModal
                  isOpen={isMapOpen}
                  onClose={() => setIsMapOpen(false)}
                  playerX={stats.playerX}
                  playerZ={stats.playerZ}
                  playerFacing={stats.playerFacing}
                  isRidingCarriage={stats.isRidingCarriage}
                  gpsTarget={stats.gpsTarget}
                  gpsDistanceMeters={stats.gpsDistanceMeters}
                  carriages={mapCarriages}
                  onSelectGps={handleSelectGps}
                  onClearGps={handleClearGps}
                  mode={mapMode}
                  canCheatTeleport={isTimeControlUnlocked}
                  onChangeMode={setMapMode}
                  onTeleport={handleTeleportSultan}
                />
              </>
            )}

            {/* Free Touch Area for Camera Orbiting */}
            <div
              onTouchStart={onCameraTouchStart}
              onTouchMove={onCameraTouchMove}
              onTouchEnd={onCameraTouchEnd}
              onTouchCancel={onCameraTouchEnd}
              className="absolute top-14 left-0 right-0 bottom-36 z-10 pointer-events-auto"
              style={{ touchAction: 'none' }}
            />

            {/* Compact Bottom Controls Dock (hides all visible control buttons when Clean HD Recording is active while keeping touch movement usable on mobile) */}
            <div
              dir="ltr"
              className={`absolute bottom-0 left-0 right-0 z-30 pb-5 pt-2 px-4 pointer-events-none flex justify-between items-end max-w-lg mx-auto ${
                isCleanRecording ? 'opacity-0' : ''
              }`}
            >
              {isCleanRecording
                ? joystickNode
                : controlsSwapped
                ? [actionsNode, joystickNode]
                : [joystickNode, actionsNode]}
            </div>

            {/* Discreet Stop Pill during Clean HD Recording (excluded from WebGL canvas recording stream) */}
            {isCleanRecording && (
              <button
                type="button"
                onClick={handleStopCleanRecording}
                className="fixed top-2.5 left-2.5 z-50 px-3 py-1.5 rounded-full bg-rose-600/85 hover:bg-rose-500 border border-rose-300/60 text-white text-[11px] font-black flex items-center gap-1.5 shadow-lg active:scale-95 pointer-events-auto"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />
                <span>
                  إيقاف التسجيل • {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                  {String(recordingSeconds % 60).padStart(2, '0')}
                </span>
              </button>
            )}

            {/* WebGL Context Lost Recovery Overlay */}
            {isContextLost && (
              <div className="absolute inset-0 z-50 bg-stone-950/92 flex items-center justify-center p-4">
                <div className="bg-stone-900 border border-amber-500/40 rounded-2xl p-5 max-w-xs w-full text-center space-y-3">
                  <h2 className="text-base font-black text-amber-300">
                    تم إيقاف محرك العرض مؤقتًا
                  </h2>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    بسبب ضغط الذاكرة على الجهاز تم تعليق الرسوميات. يمكنك إعادة التشغيل أو العودة للقائمة.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleRetryLoad}
                      className="flex-1 min-h-[44px] rounded-xl bg-amber-500 text-stone-950 text-xs font-black"
                    >
                      إعادة التحميل
                    </button>
                    <button
                      type="button"
                      onClick={handleReturnToMenu}
                      className="min-h-[44px] px-3 rounded-xl bg-stone-800 text-stone-200 text-xs font-bold"
                    >
                      القائمة
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
