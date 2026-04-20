import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Vibration } from "react-native";
import { Audio } from "expo-av";
import { apiAddStudyProgress } from "@/services/api";

const BELL_SOUND = require("../assets/sounds/warning.mp3");

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertStyle = "sound_vibration" | "vibration" | "visual";
export type TimerPhase = "work" | "break";

export interface PomodoroSettings {
  enabled: boolean;           // user has opted into Pomodoro
  workMinutes: number;        // default 25
  breakMinutes: number;       // default 5
  alertStyle: AlertStyle;     // how to notify on phase change
  longBreakMinutes: number;   // after 4 sessions, default 15
  sessionsUntilLongBreak: number;
}

export interface PomodoroState {
  isRunning: boolean;
  phase: TimerPhase;
  timeLeft: number;           // seconds
  sessionCount: number;       // completed work sessions this activation
  totalStudiedMinutes: number;// minutes studied this activation (not saved yet)
}

interface PomodoroContextType {
  settings: PomodoroSettings;
  state: PomodoroState;
  updateSettings: (patch: Partial<PomodoroSettings>) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skipBreak: () => void;      // user chooses to skip the break
  endBreak: () => void;       // alias — returns to work phase
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: PomodoroSettings = {
  enabled: false,
  workMinutes: 25,
  breakMinutes: 5,
  alertStyle: "sound_vibration",
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
};

const DEFAULT_STATE: PomodoroState = {
  isRunning: false,
  phase: "work",
  timeLeft: 25 * 60,
  sessionCount: 0,
  totalStudiedMinutes: 0,
};

const STORAGE_KEY = "@pomodoro_settings";

// ─── Context ──────────────────────────────────────────────────────────────────

const PomodoroContext = createContext<PomodoroContextType>({
  settings: DEFAULT_SETTINGS,
  state: DEFAULT_STATE,
  updateSettings: () => {},
  start: () => {},
  pause: () => {},
  reset: () => {},
  skipBreak: () => {},
  endBreak: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<PomodoroState>(DEFAULT_STATE);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  // Track minutes that haven't been saved to backend yet
  const unsavedMinutesRef = useRef(0);

  // ── Load settings on mount ─────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<PomodoroSettings>;
          const merged = { ...DEFAULT_SETTINGS, ...saved };
          setSettings(merged);
          // Reset timer to match loaded work duration
          setState((prev) => ({
            ...prev,
            timeLeft: merged.workMinutes * 60,
          }));
        } catch {}
      }
    });
  }, []);

  // ── Persist settings whenever they change ──────────────────────────────────
  const updateSettings = useCallback(
    (patch: Partial<PomodoroSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});

        // If work/break duration changed, reset the timer to new duration
        if (
          patch.workMinutes !== undefined &&
          patch.workMinutes !== prev.workMinutes
        ) {
          setState((s) =>
            s.phase === "work" && !s.isRunning
              ? { ...s, timeLeft: patch.workMinutes! * 60 }
              : s
          );
        }
        return next;
      });
    },
    []
  );

  // ── Alert helper ───────────────────────────────────────────────────────────
  const triggerAlert = useCallback(
    async (style: AlertStyle) => {
      try {
        if (style === "sound_vibration") {
          Vibration.vibrate([0, 400, 200, 400]);
          // Use a simple beep sound bundled with expo-av
          const { sound } = await Audio.Sound.createAsync(
            BELL_SOUND,
            { shouldPlay: true }
          );
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              sound.unloadAsync().catch(() => {});
            }
          });
        } else if (style === "vibration") {
          Vibration.vibrate([0, 400, 200, 400]);
        }
        // "visual" — no sound/vibration, UI handles it
      } catch {
        // Sound file may not exist — silently fall back to vibration
        if (style !== "visual") Vibration.vibrate(400);
      }
    },
    []
  );

  // ── Save unsaved study minutes to backend ──────────────────────────────────
  const flushStudyMinutes = useCallback(async () => {
    const mins = Math.floor(unsavedMinutesRef.current);
    if (mins <= 0) return;
    unsavedMinutesRef.current = 0;
    try {
      await apiAddStudyProgress(mins);
    } catch {}
  }, []);

  // ── Tick ───────────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    setState((prev) => {
      if (!prev.isRunning) return prev;

      const next = prev.timeLeft - 1;

      // Accumulate study seconds (work phase only)
      if (prev.phase === "work") {
        unsavedMinutesRef.current += 1 / 60;
      }

      if (next > 0) {
        return { ...prev, timeLeft: next };
      }

      // ── Phase ended ────────────────────────────────────────────────────────
      if (prev.phase === "work") {
        // Work session finished → go to break
        const newSessionCount = prev.sessionCount + 1;
        const isLongBreak =
          newSessionCount % settings.sessionsUntilLongBreak === 0;
        const breakSecs = isLongBreak
          ? settings.longBreakMinutes * 60
          : settings.breakMinutes * 60;

        // Flush accumulated study minutes to backend
        flushStudyMinutes();

        // Trigger alert (async, fire-and-forget)
        triggerAlert(settings.alertStyle);

        return {
          ...prev,
          phase: "break",
          timeLeft: breakSecs,
          sessionCount: newSessionCount,
          isRunning: true, // break starts automatically
        };
      } else {
        // Break finished → back to work
        triggerAlert(settings.alertStyle);

        return {
          ...prev,
          phase: "work",
          timeLeft: settings.workMinutes * 60,
          isRunning: true, // next work session starts automatically
        };
      }
    });
  }, [settings, flushStudyMinutes, triggerAlert]);

  // ── Manage interval ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isRunning, tick]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      flushStudyMinutes();
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ── Public controls ────────────────────────────────────────────────────────
  const start = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true }));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
    // Save any unsaved minutes when pausing
    flushStudyMinutes();
  }, [flushStudyMinutes]);

  const reset = useCallback(() => {
    flushStudyMinutes();
    setState({
      isRunning: false,
      phase: "work",
      timeLeft: settings.workMinutes * 60,
      sessionCount: 0,
      totalStudiedMinutes: 0,
    });
    unsavedMinutesRef.current = 0;
  }, [settings.workMinutes, flushStudyMinutes]);

  const skipBreak = useCallback(() => {
    triggerAlert(settings.alertStyle);
    setState((prev) => ({
      ...prev,
      phase: "work",
      timeLeft: settings.workMinutes * 60,
      isRunning: true,
    }));
  }, [settings, triggerAlert]);

  const endBreak = skipBreak; // same behaviour

  return (
    <PomodoroContext.Provider
      value={{ settings, state, updateSettings, start, pause, reset, skipBreak, endBreak }}
    >
      {children}
    </PomodoroContext.Provider>
  );
}

export const usePomodoro = () => useContext(PomodoroContext);
