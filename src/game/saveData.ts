import type { OrientationMode, ControlScale } from '../components/GameHUD';

export const SAVE_STORAGE_KEY = 'sultan_kingdom_full_save_v1';
export const LEGACY_SETTINGS_KEY = 'sultan_plains_settings_v1';

export interface TreasuryLogEntry {
  id: number;
  label: string;
  delta: number;
}

export interface SavedPrisonerRecord {
  slotIndex: number;
  releaseGameMinute: number;
  sentenceMinutes: number;
}

export interface GameSaveData {
  version: 1;
  savedAt: string;
  sultanName: string;
  treasuryGold: number;
  gameMinutes: number;
  lastOliveHour: number;
  lastTaxTenHour: number;
  citizenMoney: Record<string, number>;
  prisoners: Record<string, SavedPrisonerRecord>;
  treasuryLog: TreasuryLogEntry[];
  hasSeenIntroTour: boolean;
  playerArmyCount: number;
  lastArmyGrowthDay: number;
  playerPos?: {
    x: number;
    y: number;
    z: number;
    facing: number;
  };
  settings: {
    orientationMode: OrientationMode;
    controlsSwapped: boolean;
    actionButtonsSwapped: boolean;
    controlScale: ControlScale;
    isLowQuality: boolean;
  };
}

export function createDefaultSaveData(): GameSaveData {
  // Preserve any legacy settings if present
  let legacy: Partial<{
    orientationMode: OrientationMode;
    controlsSwapped: boolean;
    actionButtonsSwapped: boolean;
    controlScale: ControlScale;
    isLowQuality: boolean;
    sultanName: string;
    treasuryGold: number;
  }> = {};
  try {
    const rawLegacy = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (rawLegacy) legacy = JSON.parse(rawLegacy);
  } catch {
    // ignore
  }

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    sultanName: legacy.sultanName || 'السلطان',
    treasuryGold:
      typeof legacy.treasuryGold === 'number' && Number.isFinite(legacy.treasuryGold)
        ? Math.max(0, Math.floor(legacy.treasuryGold))
        : 25000,
    gameMinutes: 8 * 60, // Start at 08:00 AM Day 1
    lastOliveHour: 8,
    lastTaxTenHour: 0,
    citizenMoney: {},
    prisoners: {},
    treasuryLog: [],
    hasSeenIntroTour: false,
    playerArmyCount: 100,
    lastArmyGrowthDay: 0,
    settings: {
      orientationMode: legacy.orientationMode || 'auto',
      controlsSwapped: Boolean(legacy.controlsSwapped),
      actionButtonsSwapped: Boolean(legacy.actionButtonsSwapped),
      controlScale: legacy.controlScale || 'compact',
      isLowQuality: Boolean(legacy.isLowQuality),
    },
  };
}

export function loadAutoSavedGame(): GameSaveData {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return createDefaultSaveData();
    const parsed = JSON.parse(raw) as Partial<GameSaveData>;
    return normalizeSaveData(parsed);
  } catch {
    return createDefaultSaveData();
  }
}

export function persistAutoSavedGame(data: GameSaveData): void {
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors
  }
}

export function normalizeSaveData(raw: Partial<GameSaveData>): GameSaveData {
  const def = createDefaultSaveData();
  const safeCitizenMoney: Record<string, number> = {};
  if (raw.citizenMoney && typeof raw.citizenMoney === 'object') {
    for (const [k, v] of Object.entries(raw.citizenMoney)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        safeCitizenMoney[k] = Math.max(0, Math.floor(v));
      }
    }
  }

  const gameMinutes =
    typeof raw.gameMinutes === 'number' && Number.isFinite(raw.gameMinutes)
      ? Math.max(0, raw.gameMinutes)
      : def.gameMinutes;

  const safePrisoners: Record<string, SavedPrisonerRecord> = {};
  if (raw.prisoners && typeof raw.prisoners === 'object') {
    for (const [k, rec] of Object.entries(raw.prisoners)) {
      if (
        rec &&
        typeof rec === 'object' &&
        typeof rec.releaseGameMinute === 'number' &&
        Number.isFinite(rec.releaseGameMinute)
      ) {
        safePrisoners[k] = {
          slotIndex:
            typeof rec.slotIndex === 'number' && Number.isFinite(rec.slotIndex)
              ? Math.max(0, Math.floor(rec.slotIndex))
              : 0,
          releaseGameMinute: Math.max(0, rec.releaseGameMinute),
          sentenceMinutes:
            typeof rec.sentenceMinutes === 'number' && Number.isFinite(rec.sentenceMinutes)
              ? Math.max(1, Math.floor(rec.sentenceMinutes))
              : 60,
        };
      }
    }
  }

  return {
    version: 1,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString(),
    sultanName:
      typeof raw.sultanName === 'string' && raw.sultanName.trim()
        ? raw.sultanName.trim()
        : def.sultanName,
    treasuryGold:
      typeof raw.treasuryGold === 'number' && Number.isFinite(raw.treasuryGold)
        ? Math.max(0, Math.floor(raw.treasuryGold))
        : def.treasuryGold,
    gameMinutes,
    lastOliveHour:
      typeof raw.lastOliveHour === 'number' && Number.isFinite(raw.lastOliveHour)
        ? Math.max(0, Math.floor(raw.lastOliveHour))
        : Math.floor(gameMinutes / 60),
    lastTaxTenHour:
      typeof raw.lastTaxTenHour === 'number' && Number.isFinite(raw.lastTaxTenHour)
        ? Math.max(0, Math.floor(raw.lastTaxTenHour))
        : Math.floor(gameMinutes / 600),
    citizenMoney: safeCitizenMoney,
    prisoners: safePrisoners,
    treasuryLog: Array.isArray(raw.treasuryLog)
      ? raw.treasuryLog
          .filter(
            (e) =>
              e &&
              typeof e.label === 'string' &&
              typeof e.delta === 'number' &&
              Number.isFinite(e.delta)
          )
          .slice(0, 6)
      : [],
    hasSeenIntroTour:
      typeof raw.hasSeenIntroTour === 'boolean' ? raw.hasSeenIntroTour : false,
    playerArmyCount:
      typeof raw.playerArmyCount === 'number' && Number.isFinite(raw.playerArmyCount)
        ? Math.max(0, Math.min(1000000, Math.floor(raw.playerArmyCount)))
        : def.playerArmyCount,
    lastArmyGrowthDay:
      typeof raw.lastArmyGrowthDay === 'number' && Number.isFinite(raw.lastArmyGrowthDay)
        ? Math.max(0, Math.floor(raw.lastArmyGrowthDay))
        : Math.floor(gameMinutes / 1440),
    playerPos:
      raw.playerPos &&
      typeof raw.playerPos.x === 'number' &&
      typeof raw.playerPos.z === 'number'
        ? {
            x: raw.playerPos.x,
            y: typeof raw.playerPos.y === 'number' ? raw.playerPos.y : 0,
            z: raw.playerPos.z,
            facing: typeof raw.playerPos.facing === 'number' ? raw.playerPos.facing : 0,
          }
        : undefined,
    settings: {
      orientationMode: raw.settings?.orientationMode || def.settings.orientationMode,
      controlsSwapped:
        typeof raw.settings?.controlsSwapped === 'boolean'
          ? raw.settings.controlsSwapped
          : def.settings.controlsSwapped,
      actionButtonsSwapped:
        typeof raw.settings?.actionButtonsSwapped === 'boolean'
          ? raw.settings.actionButtonsSwapped
          : def.settings.actionButtonsSwapped,
      controlScale: raw.settings?.controlScale || def.settings.controlScale,
      isLowQuality:
        typeof raw.settings?.isLowQuality === 'boolean'
          ? raw.settings.isLowQuality
          : def.settings.isLowQuality,
    },
  };
}

/**
 * Saves game data into a real JSON file in the user's phone/device folders.
 * Uses the native File System Access API (folder picker) when available,
 * and falls back seamlessly to downloading into the phone's Downloads folder.
 */
export async function saveGameToPhoneFile(
  data: GameSaveData
): Promise<'picker' | 'download' | 'cancelled'> {
  const payload = JSON.stringify({ ...data, savedAt: new Date().toISOString() }, null, 2);
  const fileName = `sultan_kingdom_save_${new Date().toISOString().slice(0, 10)}.json`;

  const w = window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<{
      createWritable: () => Promise<{
        write: (content: string) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };

  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'ملف حفظ لعبة سلطان البراري',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(payload);
      await writable.close();
      return 'picker';
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to browser download fallback when blocked in iframe/WebView
    }
  }

  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 400);
  return 'download';
}

export async function readSaveFileFromInput(file: File): Promise<GameSaveData> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<GameSaveData>;
  if (!parsed || typeof parsed !== 'object' || typeof parsed.treasuryGold !== 'number') {
    throw new Error('ملف الحفظ غير صالح');
  }
  return normalizeSaveData(parsed);
}
