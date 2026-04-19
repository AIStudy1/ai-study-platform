import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePomodoro, AlertStyle, PomodoroSettings } from "@/context/PomodoroContext";

const PRIMARY = "#9cd21f";
const BREAK_COLOR = "#3b82f6";
const WORK_COLOR = PRIMARY;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Breathing animation for break overlay ────────────────────────────────────

function BreathingCircle() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 4000, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 4000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={[breathStyles.outer, { transform: [{ scale }] }]}>
      <View style={breathStyles.middle}>
        <View style={breathStyles.inner} />
      </View>
    </Animated.View>
  );
}

const breathStyles = StyleSheet.create({
  outer:  { width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(59,130,246,0.15)", alignItems: "center", justifyContent: "center" },
  middle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(59,130,246,0.25)", alignItems: "center", justifyContent: "center" },
  inner:  { width:  80, height:  80, borderRadius: 40, backgroundColor: BREAK_COLOR },
});

// ─── Circular progress ring ────────────────────────────────────────────────────

function Ring({ progress, color, size = 120, stroke = 8 }: {
  progress: number; color: string; size?: number; stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - Math.max(0, Math.min(1, progress)));

  // Pure RN approximation using a View ring (SVG not available without extra lib)
  // We'll use a border-based approach
  const angle = progress * 360;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Background ring */}
      <View style={{
        position: "absolute",
        width: size, height: size, borderRadius: size / 2,
        borderWidth: stroke, borderColor: color + "25",
      }} />
      {/* Filled arc — approximated with opacity gradient */}
      <View style={{
        position: "absolute",
        width: size, height: size, borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: color,
        borderTopColor: progress > 0.875 ? color : "transparent",
        borderRightColor: progress > 0.125 ? color : "transparent",
        borderBottomColor: progress > 0.375 ? color : "transparent",
        borderLeftColor: progress > 0.625 ? color : "transparent",
        transform: [{ rotate: "-90deg" }],
        opacity: 0.9,
      }} />
    </View>
  );
}

// ─── Settings panel ────────────────────────────────────────────────────────────

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = usePomodoro();

  const alertOptions: { value: AlertStyle; label: string; icon: string }[] = [
    { value: "sound_vibration", label: "Sound + Vibration", icon: "musical-note" },
    { value: "vibration",       label: "Vibration only",   icon: "phone-portrait" },
    { value: "visual",          label: "Visual only",      icon: "eye" },
  ];

  return (
    <View style={settingsStyles.container}>
      <View style={settingsStyles.header}>
        <Text style={settingsStyles.title}>Timer Settings</Text>
        <TouchableOpacity onPress={onClose} style={settingsStyles.closeBtn}>
          <Ionicons name="close" size={20} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Enable toggle */}
        <View style={settingsStyles.row}>
          <View>
            <Text style={settingsStyles.label}>Pomodoro Technique</Text>
            <Text style={settingsStyles.sublabel}>Structured work + break cycles</Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={(v) => updateSettings({ enabled: v })}
            trackColor={{ false: "#e5e7eb", true: PRIMARY + "80" }}
            thumbColor={settings.enabled ? PRIMARY : "#f4f3f4"}
          />
        </View>

        <View style={settingsStyles.divider} />

        {/* Work duration */}
        <Text style={settingsStyles.sectionTitle}>Work Session</Text>
        <View style={settingsStyles.durationRow}>
          {[15, 20, 25, 30, 45, 50].map((m) => (
            <TouchableOpacity
              key={m}
              style={[settingsStyles.durationBtn, settings.workMinutes === m && settingsStyles.durationBtnActive]}
              onPress={() => updateSettings({ workMinutes: m })}
            >
              <Text style={[settingsStyles.durationText, settings.workMinutes === m && settingsStyles.durationTextActive]}>
                {m}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Break duration */}
        <Text style={settingsStyles.sectionTitle}>Short Break</Text>
        <View style={settingsStyles.durationRow}>
          {[3, 5, 10, 15].map((m) => (
            <TouchableOpacity
              key={m}
              style={[settingsStyles.durationBtn, settings.breakMinutes === m && settingsStyles.durationBtnActive]}
              onPress={() => updateSettings({ breakMinutes: m })}
            >
              <Text style={[settingsStyles.durationText, settings.breakMinutes === m && settingsStyles.durationTextActive]}>
                {m}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Long break */}
        <Text style={settingsStyles.sectionTitle}>Long Break (every {settings.sessionsUntilLongBreak} sessions)</Text>
        <View style={settingsStyles.durationRow}>
          {[10, 15, 20, 30].map((m) => (
            <TouchableOpacity
              key={m}
              style={[settingsStyles.durationBtn, settings.longBreakMinutes === m && settingsStyles.durationBtnActive]}
              onPress={() => updateSettings({ longBreakMinutes: m })}
            >
              <Text style={[settingsStyles.durationText, settings.longBreakMinutes === m && settingsStyles.durationTextActive]}>
                {m}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sessions until long break */}
        <Text style={settingsStyles.sectionTitle}>Sessions per Long Break</Text>
        <View style={settingsStyles.durationRow}>
          {[2, 3, 4, 6].map((n) => (
            <TouchableOpacity
              key={n}
              style={[settingsStyles.durationBtn, settings.sessionsUntilLongBreak === n && settingsStyles.durationBtnActive]}
              onPress={() => updateSettings({ sessionsUntilLongBreak: n })}
            >
              <Text style={[settingsStyles.durationText, settings.sessionsUntilLongBreak === n && settingsStyles.durationTextActive]}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={settingsStyles.divider} />

        {/* Alert style */}
        <Text style={settingsStyles.sectionTitle}>Alert Style</Text>
        {alertOptions.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[settingsStyles.alertRow, settings.alertStyle === opt.value && settingsStyles.alertRowActive]}
            onPress={() => updateSettings({ alertStyle: opt.value })}
          >
            <Ionicons
              name={opt.icon as any}
              size={18}
              color={settings.alertStyle === opt.value ? PRIMARY : "#999"}
            />
            <Text style={[settingsStyles.alertLabel, settings.alertStyle === opt.value && { color: PRIMARY }]}>
              {opt.label}
            </Text>
            {settings.alertStyle === opt.value && (
              <Ionicons name="checkmark-circle" size={18} color={PRIMARY} style={{ marginLeft: "auto" }} />
            )}
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const settingsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8f6" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title: { fontSize: 18, fontWeight: "bold", color: "#333" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: "white" },
  label: { fontSize: 15, fontWeight: "600", color: "#333" },
  sublabel: { fontSize: 12, color: "#999", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#999", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  durationRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8 },
  durationBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "white", borderWidth: 1.5, borderColor: "#e5e7eb" },
  durationBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  durationText: { fontSize: 14, fontWeight: "600", color: "#666" },
  durationTextActive: { color: "white" },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginBottom: 8, padding: 14, backgroundColor: "white", borderRadius: 12, borderWidth: 1.5, borderColor: "#e5e7eb" },
  alertRowActive: { borderColor: PRIMARY, backgroundColor: PRIMARY + "10" },
  alertLabel: { fontSize: 14, fontWeight: "500", color: "#555" },
});

// ─── Break Overlay ─────────────────────────────────────────────────────────────

function BreakOverlay() {
  const { state, skipBreak, settings } = usePomodoro();
  const opacity = useRef(new Animated.Value(0)).current;
  const isLongBreak = state.sessionCount % settings.sessionsUntilLongBreak === 0;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: state.phase === "break" && state.isRunning ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [state.phase, state.isRunning]);

  if (state.phase !== "break") return null;

  const breakMessages = [
    "Time to rest your eyes 👀",
    "Step away from the screen 🌿",
    "Take a deep breath 🧘",
    "Hydrate! Drink some water 💧",
    "Stretch your body 🤸",
  ];
  const msg = breakMessages[state.sessionCount % breakMessages.length];

  return (
    <Animated.View style={[overlayStyles.overlay, { opacity }]} pointerEvents="box-none">
      <View style={overlayStyles.card}>
        <View style={overlayStyles.topRow}>
          <View style={overlayStyles.breakBadge}>
            <Text style={overlayStyles.breakBadgeText}>
              {isLongBreak ? "☕ Long Break" : "🌿 Short Break"}
            </Text>
          </View>
        </View>

        <BreathingCircle />

        <Text style={overlayStyles.timer}>{fmt(state.timeLeft)}</Text>
        <Text style={overlayStyles.msg}>{msg}</Text>
        <Text style={overlayStyles.sub}>
          {isLongBreak
            ? `You've completed ${state.sessionCount} sessions! You've earned this.`
            : "Rest now so you can focus better next session."}
        </Text>

        <TouchableOpacity style={overlayStyles.skipBtn} onPress={skipBreak}>
          <Ionicons name="arrow-forward" size={16} color="#666" />
          <Text style={overlayStyles.skipText}>Skip Break & Continue Studying</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const overlayStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    marginHorizontal: 24,
    width: "90%",
    maxWidth: 380,
    elevation: 20,
  },
  topRow: { marginBottom: 24 },
  breakBadge: { backgroundColor: BREAK_COLOR + "15", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  breakBadgeText: { color: BREAK_COLOR, fontWeight: "700", fontSize: 14 },
  timer: { fontSize: 52, fontWeight: "bold", color: BREAK_COLOR, marginTop: 20, letterSpacing: 2 },
  msg: { fontSize: 18, fontWeight: "700", color: "#333", marginTop: 16, textAlign: "center" },
  sub: { fontSize: 13, color: "#888", textAlign: "center", marginTop: 8, lineHeight: 20 },
  skipBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 28, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 20, backgroundColor: "#f3f4f6" },
  skipText: { fontSize: 13, color: "#666", fontWeight: "600" },
});

// ─── Floating Pill ─────────────────────────────────────────────────────────────

export function PomodoroFloatingPill() {
  const { settings, state, start, pause, reset } = usePomodoro();
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;

  // Pulse animation when running
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state.isRunning && state.phase === "work") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.04, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 1000, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [state.isRunning, state.phase]);

  if (!settings.enabled) return null;

  const isWork  = state.phase === "work";
  const color   = isWork ? WORK_COLOR : BREAK_COLOR;
  const total   = isWork ? settings.workMinutes * 60 : settings.breakMinutes * 60;
  const progress = 1 - state.timeLeft / total;

  return (
    <>
      {/* Break overlay sits behind the pill */}
      <BreakOverlay />

      {/* Floating pill */}
      <Animated.View
        style={[
          pillStyles.pill,
          {
            bottom: insets.bottom + 80, // above tab bar
            transform: [{ scale: pulse }],
            borderColor: color + "40",
            backgroundColor: isWork ? "#f0f9e8" : "#eff6ff",
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setExpanded(true)}
          activeOpacity={0.85}
          style={pillStyles.pillInner}
        >
          {/* Mini ring */}
          <View style={[pillStyles.dot, { backgroundColor: color }]}>
            <Ionicons
              name={isWork ? "timer-outline" : "cafe-outline"}
              size={14}
              color="white"
            />
          </View>
          <Text style={[pillStyles.pillTime, { color }]}>{fmt(state.timeLeft)}</Text>
          <Text style={[pillStyles.pillPhase, { color: color + "bb" }]}>
            {isWork ? `Session ${state.sessionCount + 1}` : "Break"}
          </Text>
          {/* Play/pause inline */}
          <TouchableOpacity
            onPress={state.isRunning ? pause : start}
            style={[pillStyles.pillBtn, { backgroundColor: color }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={state.isRunning ? "pause" : "play"}
              size={14}
              color="white"
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>

      {/* Expanded modal */}
      <Modal visible={expanded} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setExpanded(false)}>
        {showSettings ? (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        ) : (
          <View style={modalStyles.container}>
            {/* Header */}
            <View style={modalStyles.header}>
              <TouchableOpacity onPress={() => setExpanded(false)} style={modalStyles.headerBtn}>
                <Ionicons name="chevron-down" size={22} color="#333" />
              </TouchableOpacity>
              <Text style={modalStyles.headerTitle}>Pomodoro Timer</Text>
              <TouchableOpacity onPress={() => setShowSettings(true)} style={modalStyles.headerBtn}>
                <Ionicons name="settings-outline" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={modalStyles.body}>
              {/* Phase badge */}
              <View style={[modalStyles.phaseBadge, { backgroundColor: color + "15" }]}>
                <Text style={[modalStyles.phaseText, { color }]}>
                  {isWork
                    ? `🎯 Work Session ${state.sessionCount + 1}`
                    : state.sessionCount % settings.sessionsUntilLongBreak === 0
                      ? "☕ Long Break"
                      : "🌿 Short Break"}
                </Text>
              </View>

              {/* Timer ring */}
              <View style={modalStyles.ringWrap}>
                <Ring progress={progress} color={color} size={200} stroke={12} />
                <View style={modalStyles.ringCenter}>
                  <Text style={[modalStyles.bigTime, { color }]}>{fmt(state.timeLeft)}</Text>
                  <Text style={modalStyles.bigPhase}>
                    {isWork ? "Focus time" : "Rest time"}
                  </Text>
                </View>
              </View>

              {/* Stats row */}
              <View style={modalStyles.statsRow}>
                <View style={modalStyles.statCard}>
                  <Text style={[modalStyles.statNum, { color: PRIMARY }]}>{state.sessionCount}</Text>
                  <Text style={modalStyles.statLabel}>Sessions done</Text>
                </View>
                <View style={modalStyles.statCard}>
                  <Text style={[modalStyles.statNum, { color: "#8b5cf6" }]}>
                    {settings.workMinutes}m
                  </Text>
                  <Text style={modalStyles.statLabel}>Work duration</Text>
                </View>
                <View style={modalStyles.statCard}>
                  <Text style={[modalStyles.statNum, { color: BREAK_COLOR }]}>
                    {settings.breakMinutes}m
                  </Text>
                  <Text style={modalStyles.statLabel}>Break duration</Text>
                </View>
              </View>

              {/* Session dots */}
              <View style={modalStyles.dotsRow}>
                {Array.from({ length: settings.sessionsUntilLongBreak }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      modalStyles.dot,
                      { backgroundColor: i < (state.sessionCount % settings.sessionsUntilLongBreak) ? PRIMARY : "#e5e7eb" },
                    ]}
                  />
                ))}
                <Ionicons name="cafe" size={16} color="#f97316" style={{ marginLeft: 4 }} />
              </View>
              <Text style={modalStyles.dotsLabel}>
                {settings.sessionsUntilLongBreak - (state.sessionCount % settings.sessionsUntilLongBreak)} session(s) until long break
              </Text>

              {/* Controls */}
              <View style={modalStyles.controls}>
                <TouchableOpacity style={modalStyles.resetBtn} onPress={reset}>
                  <Ionicons name="refresh" size={20} color="#999" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[modalStyles.playBtn, { backgroundColor: color }]}
                  onPress={state.isRunning ? pause : start}
                >
                  <Ionicons
                    name={state.isRunning ? "pause" : "play"}
                    size={28}
                    color="white"
                  />
                </TouchableOpacity>

                <TouchableOpacity style={modalStyles.settingsBtn} onPress={() => setShowSettings(true)}>
                  <Ionicons name="settings-outline" size={20} color="#999" />
                </TouchableOpacity>
              </View>

              {/* Tips */}
              {isWork && !state.isRunning && state.timeLeft === settings.workMinutes * 60 && (
                <View style={modalStyles.tipCard}>
                  <Text style={modalStyles.tipTitle}>💡 Pomodoro Tips</Text>
                  <Text style={modalStyles.tipText}>
                    • Focus on one task per session{"\n"}
                    • Close distracting apps{"\n"}
                    • Take your breaks — they improve focus!{"\n"}
                    • After {settings.sessionsUntilLongBreak} sessions, take a longer {settings.longBreakMinutes}-minute break
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>
    </>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    position: "absolute",
    right: 16,
    borderRadius: 30,
    borderWidth: 1.5,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 1000,
  },
  pillInner: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 8 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  pillTime: { fontSize: 15, fontWeight: "bold", letterSpacing: 0.5 },
  pillPhase: { fontSize: 11, fontWeight: "600" },
  pillBtn: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8f6" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  body: { alignItems: "center", padding: 24, paddingBottom: 60 },
  phaseBadge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: 32 },
  phaseText: { fontSize: 15, fontWeight: "700" },
  ringWrap: { width: 200, height: 200, alignItems: "center", justifyContent: "center", marginBottom: 32 },
  ringCenter: { position: "absolute", alignItems: "center" },
  bigTime: { fontSize: 44, fontWeight: "bold", letterSpacing: 2 },
  bigPhase: { fontSize: 13, color: "#999", marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24, width: "100%" },
  statCard: { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 14, alignItems: "center", elevation: 1 },
  statNum: { fontSize: 22, fontWeight: "bold" },
  statLabel: { fontSize: 11, color: "#999", marginTop: 4, textAlign: "center" },
  dotsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotsLabel: { fontSize: 12, color: "#999", marginBottom: 32 },
  controls: { flexDirection: "row", alignItems: "center", gap: 20, marginBottom: 32 },
  resetBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: "white", alignItems: "center", justifyContent: "center", elevation: 1 },
  playBtn: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", elevation: 3 },
  settingsBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: "white", alignItems: "center", justifyContent: "center", elevation: 1 },
  tipCard: { backgroundColor: "white", borderRadius: 16, padding: 20, width: "100%", borderLeftWidth: 4, borderLeftColor: PRIMARY },
  tipTitle: { fontSize: 14, fontWeight: "bold", color: "#333", marginBottom: 8 },
  tipText: { fontSize: 13, color: "#666", lineHeight: 22 },
});

// ─── Pill trigger button (shown in screen headers) ────────────────────────────
// Screens import this to show a small timer icon in their header

export function PomodoroHeaderButton() {
  const { settings, state } = usePomodoro();
  const [expanded, setExpanded] = useState(false);

  if (!settings.enabled) return <View style={{ width: 36 }} />;

  const isWork = state.phase === "work";
  const color  = isWork ? WORK_COLOR : BREAK_COLOR;

  return (
    <>
      <TouchableOpacity
        style={[headerBtnStyles.btn, { backgroundColor: color + "20" }]}
        onPress={() => setExpanded(true)}
      >
        <Ionicons name="timer-outline" size={18} color={color} />
        {state.isRunning && (
          <View style={[headerBtnStyles.dot, { backgroundColor: color }]} />
        )}
      </TouchableOpacity>

      <Modal visible={expanded} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setExpanded(false)}>
        <PomodoroFloatingPill />
      </Modal>
    </>
  );
}

const headerBtnStyles = StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: 3.5, borderWidth: 1, borderColor: "white" },
});
