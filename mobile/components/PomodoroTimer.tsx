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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePomodoro, AlertStyle } from "@/context/PomodoroContext";

const PRIMARY    = "#9cd21f";
const BREAK_COLOR = "#3b82f6";
const WORK_COLOR  = PRIMARY;
const TOMATO      = "#ef4444"; // colour when disabled

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Breathing circle (break overlay) ────────────────────────────────────────

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

// ─── Break overlay ────────────────────────────────────────────────────────────

function BreakOverlay() {
  const { state, skipBreak, settings } = usePomodoro();
  const opacity = useRef(new Animated.Value(0)).current;
  const isLongBreak = state.sessionCount > 0 && state.sessionCount % settings.sessionsUntilLongBreak === 0;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: state.phase === "break" && state.isRunning ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [state.phase, state.isRunning]);

  if (state.phase !== "break") return null;

  const msgs = [
    "Time to rest your eyes 👀",
    "Step away from the screen 🌿",
    "Take a deep breath 🧘",
    "Hydrate! Drink some water 💧",
    "Stretch your body 🤸",
  ];
  const msg = msgs[state.sessionCount % msgs.length];

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
            ? `You've completed ${state.sessionCount} sessions — you've earned this!`
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
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.88)", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  card: { backgroundColor: "white", borderRadius: 28, padding: 32, alignItems: "center", marginHorizontal: 24, width: "90%", maxWidth: 380, elevation: 20 },
  topRow: { marginBottom: 24 },
  breakBadge: { backgroundColor: BREAK_COLOR + "15", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  breakBadgeText: { color: BREAK_COLOR, fontWeight: "700", fontSize: 14 },
  timer: { fontSize: 52, fontWeight: "bold", color: BREAK_COLOR, marginTop: 20, letterSpacing: 2 },
  msg: { fontSize: 18, fontWeight: "700", color: "#333", marginTop: 16, textAlign: "center" },
  sub: { fontSize: 13, color: "#888", textAlign: "center", marginTop: 8, lineHeight: 20 },
  skipBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 28, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 20, backgroundColor: "#f3f4f6" },
  skipText: { fontSize: 13, color: "#666", fontWeight: "600" },
});

// ─── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, reset } = usePomodoro();

  const alertOptions: { value: AlertStyle; label: string; icon: string }[] = [
    { value: "sound_vibration", label: "Sound + Vibration", icon: "musical-note" },
    { value: "vibration",       label: "Vibration only",   icon: "phone-portrait" },
    { value: "visual",          label: "Visual only",      icon: "eye"            },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      {/* Header */}
      <View style={sS.header}>
        <TouchableOpacity onPress={onClose} style={sS.closeBtn}>
          <Ionicons name="arrow-back" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={sS.title}>Pomodoro Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Master toggle ── */}
        <View style={sS.toggleCard}>
          <View style={sS.toggleLeft}>
            <Text style={sS.tomatoEmoji}>🍅</Text>
            <View>
              <Text style={sS.toggleLabel}>Pomodoro Timer</Text>
              <Text style={sS.toggleSub}>
                {settings.enabled ? `Active — ${settings.workMinutes}m work / ${settings.breakMinutes}m break` : "Tap to enable focused study sessions"}
              </Text>
            </View>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={(v) => updateSettings({ enabled: v })}
            trackColor={{ false: "#e5e7eb", true: PRIMARY + "80" }}
            thumbColor={settings.enabled ? PRIMARY : "#f4f3f4"}
          />
        </View>

        {settings.enabled && (
          <>
            {/* Work duration */}
            <Text style={sS.sectionTitle}>🎯 Work Session</Text>
            <View style={sS.durationRow}>
              {[15, 20, 25, 30, 45, 50].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[sS.chip, settings.workMinutes === m && sS.chipActive]}
                  onPress={() => updateSettings({ workMinutes: m })}
                >
                  <Text style={[sS.chipText, settings.workMinutes === m && sS.chipTextActive]}>
                    {m}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Short break */}
            <Text style={sS.sectionTitle}>🌿 Short Break</Text>
            <View style={sS.durationRow}>
              {[3, 5, 10, 15].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[sS.chip, settings.breakMinutes === m && sS.chipActive]}
                  onPress={() => updateSettings({ breakMinutes: m })}
                >
                  <Text style={[sS.chipText, settings.breakMinutes === m && sS.chipTextActive]}>
                    {m}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Long break */}
            <Text style={sS.sectionTitle}>☕ Long Break</Text>
            <View style={sS.durationRow}>
              {[10, 15, 20, 30].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[sS.chip, settings.longBreakMinutes === m && sS.chipActive]}
                  onPress={() => updateSettings({ longBreakMinutes: m })}
                >
                  <Text style={[sS.chipText, settings.longBreakMinutes === m && sS.chipTextActive]}>
                    {m}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sessions until long break */}
            <Text style={sS.sectionTitle}>🔁 Sessions per Long Break</Text>
            <View style={sS.durationRow}>
              {[2, 3, 4, 6].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[sS.chip, settings.sessionsUntilLongBreak === n && sS.chipActive]}
                  onPress={() => updateSettings({ sessionsUntilLongBreak: n })}
                >
                  <Text style={[sS.chipText, settings.sessionsUntilLongBreak === n && sS.chipTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Alert style */}
            <Text style={sS.sectionTitle}>🔔 Alert Style</Text>
            {alertOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[sS.alertRow, settings.alertStyle === opt.value && sS.alertRowActive]}
                onPress={() => updateSettings({ alertStyle: opt.value })}
              >
                <Ionicons name={opt.icon as any} size={18} color={settings.alertStyle === opt.value ? PRIMARY : "#999"} />
                <Text style={[sS.alertLabel, settings.alertStyle === opt.value && { color: PRIMARY }]}>
                  {opt.label}
                </Text>
                {settings.alertStyle === opt.value && (
                  <Ionicons name="checkmark-circle" size={18} color={PRIMARY} style={{ marginLeft: "auto" }} />
                )}
              </TouchableOpacity>
            ))}

            {/* Reset */}
            <TouchableOpacity style={sS.resetBtn} onPress={() => { reset(); onClose(); }}>
              <Ionicons name="refresh" size={16} color="#ef4444" />
              <Text style={sS.resetText}>Reset Timer</Text>
            </TouchableOpacity>

            {/* Tips */}
            <View style={sS.tipCard}>
              <Text style={sS.tipTitle}>💡 How Pomodoro works</Text>
              <Text style={sS.tipText}>
                {"1. Study for " + settings.workMinutes + " minutes without interruption\n" +
                 "2. Take a " + settings.breakMinutes + "-minute break\n" +
                 "3. After " + settings.sessionsUntilLongBreak + " sessions, take a longer " + settings.longBreakMinutes + "-minute break\n" +
                 "4. Your screen will blur during breaks to force you to rest"}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const sS = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "bold", color: "#333" },
  toggleCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "white", margin: 16, borderRadius: 16, padding: 16, elevation: 1 },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  tomatoEmoji: { fontSize: 32 },
  toggleLabel: { fontSize: 16, fontWeight: "700", color: "#333" },
  toggleSub: { fontSize: 12, color: "#888", marginTop: 2, maxWidth: 220 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#888", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  durationRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: "white", borderWidth: 1.5, borderColor: "#e5e7eb" },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 14, fontWeight: "600", color: "#666" },
  chipTextActive: { color: "white" },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginBottom: 8, padding: 14, backgroundColor: "white", borderRadius: 12, borderWidth: 1.5, borderColor: "#e5e7eb" },
  alertRowActive: { borderColor: PRIMARY, backgroundColor: PRIMARY + "10" },
  alertLabel: { fontSize: 14, fontWeight: "500", color: "#555" },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 20, padding: 14, borderRadius: 12, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca" },
  resetText: { color: "#ef4444", fontWeight: "600", fontSize: 14 },
  tipCard: { backgroundColor: "#f0f9e8", borderRadius: 14, padding: 16, margin: 16, borderLeftWidth: 4, borderLeftColor: PRIMARY },
  tipTitle: { fontSize: 14, fontWeight: "bold", color: "#333", marginBottom: 8 },
  tipText: { fontSize: 13, color: "#555", lineHeight: 22 },
});

// ─── Expanded timer modal ─────────────────────────────────────────────────────

function TimerModal({ onClose }: { onClose: () => void }) {
  const { settings, state, start, pause, reset, skipBreak, updateSettings } = usePomodoro();
  const [showSettings, setShowSettings] = useState(!settings.enabled); // open settings first if disabled

  const isWork  = state.phase === "work";
  const color   = isWork ? WORK_COLOR : BREAK_COLOR;
  const total   = isWork ? settings.workMinutes * 60 : settings.breakMinutes * 60;
  const progress = Math.max(0, Math.min(1, 1 - state.timeLeft / total));

  if (showSettings) {
    return <SettingsPanel onClose={() => {
      // After saving settings, if now enabled go to timer view, else close modal
      if (settings.enabled) setShowSettings(false);
      else onClose();
    }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      {/* Header */}
      <View style={mS.header}>
        <TouchableOpacity onPress={onClose} style={mS.headerBtn}>
          <Ionicons name="chevron-down" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={mS.headerTitle}>Pomodoro Timer</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={mS.headerBtn}>
          <Ionicons name="settings-outline" size={22} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={mS.body}>
        {/* Phase badge */}
        <View style={[mS.phaseBadge, { backgroundColor: color + "15" }]}>
          <Text style={[mS.phaseText, { color }]}>
            {isWork
              ? `🎯 Work Session ${state.sessionCount + 1}`
              : state.sessionCount % settings.sessionsUntilLongBreak === 0
                ? "☕ Long Break"
                : "🌿 Short Break"}
          </Text>
        </View>

        {/* Big clock */}
        <View style={mS.clockWrap}>
          {/* Progress ring approximation */}
          <View style={[mS.ringOuter, { borderColor: color + "25" }]}>
            <View style={[mS.ringFill, {
              borderColor: color,
              // show top/right/bottom/left segments based on progress
              borderTopColor:    progress > 0    ? color : color + "25",
              borderRightColor:  progress > 0.25 ? color : color + "25",
              borderBottomColor: progress > 0.5  ? color : color + "25",
              borderLeftColor:   progress > 0.75 ? color : color + "25",
            }]} />
          </View>
          <View style={mS.clockCenter}>
            <Text style={[mS.bigTime, { color }]}>{fmt(state.timeLeft)}</Text>
            <Text style={mS.bigPhase}>{isWork ? "Focus time" : "Rest time"}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={mS.statsRow}>
          <View style={mS.statCard}>
            <Text style={[mS.statNum, { color: PRIMARY }]}>{state.sessionCount}</Text>
            <Text style={mS.statLabel}>Sessions done</Text>
          </View>
          <View style={mS.statCard}>
            <Text style={[mS.statNum, { color: "#8b5cf6" }]}>{settings.workMinutes}m</Text>
            <Text style={mS.statLabel}>Work duration</Text>
          </View>
          <View style={mS.statCard}>
            <Text style={[mS.statNum, { color: BREAK_COLOR }]}>{settings.breakMinutes}m</Text>
            <Text style={mS.statLabel}>Break duration</Text>
          </View>
        </View>

        {/* Session dots */}
        <View style={mS.dotsRow}>
          {Array.from({ length: settings.sessionsUntilLongBreak }).map((_, i) => (
            <View
              key={i}
              style={[mS.dot, {
                backgroundColor: i < (state.sessionCount % settings.sessionsUntilLongBreak)
                  ? PRIMARY : "#e5e7eb",
              }]}
            />
          ))}
          <Ionicons name="cafe" size={16} color="#f97316" style={{ marginLeft: 4 }} />
        </View>
        <Text style={mS.dotsLabel}>
          {settings.sessionsUntilLongBreak - (state.sessionCount % settings.sessionsUntilLongBreak)} session(s) until long break
        </Text>

        {/* Controls */}
        <View style={mS.controls}>
          <TouchableOpacity style={mS.sideBtn} onPress={reset}>
            <Ionicons name="refresh" size={20} color="#999" />
            <Text style={mS.sideBtnLabel}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[mS.playBtn, { backgroundColor: state.phase === "break" ? BREAK_COLOR : color }]}
            onPress={state.isRunning ? pause : start}
          >
            <Ionicons name={state.isRunning ? "pause" : "play"} size={30} color="white" />
          </TouchableOpacity>

          <TouchableOpacity style={mS.sideBtn} onPress={() => setShowSettings(true)}>
            <Ionicons name="options-outline" size={20} color="#999" />
            <Text style={mS.sideBtnLabel}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Tips when not yet started */}
        {!state.isRunning && state.timeLeft === settings.workMinutes * 60 && state.sessionCount === 0 && (
          <View style={mS.tipCard}>
            <Text style={mS.tipTitle}>🚀 Ready to focus?</Text>
            <Text style={mS.tipText}>
              {"Press play to start a " + settings.workMinutes + "-minute focus session.\n" +
               "When time's up, your screen will blur for a " + settings.breakMinutes + "-minute break.\nYou can skip the break anytime."}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const mS = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  body: { alignItems: "center", padding: 24, paddingBottom: 60 },
  phaseBadge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: 28 },
  phaseText: { fontSize: 15, fontWeight: "700" },
  clockWrap: { width: 200, height: 200, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  ringOuter: { position: "absolute", width: 200, height: 200, borderRadius: 100, borderWidth: 12 },
  ringFill:  { position: "absolute", width: 200, height: 200, borderRadius: 100, borderWidth: 12, transform: [{ rotate: "-90deg" }] },
  clockCenter: { alignItems: "center" },
  bigTime: { fontSize: 44, fontWeight: "bold", letterSpacing: 2 },
  bigPhase: { fontSize: 13, color: "#999", marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20, width: "100%" },
  statCard: { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 14, alignItems: "center", elevation: 1 },
  statNum: { fontSize: 20, fontWeight: "bold" },
  statLabel: { fontSize: 11, color: "#999", marginTop: 4, textAlign: "center" },
  dotsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotsLabel: { fontSize: 12, color: "#999", marginBottom: 28 },
  controls: { flexDirection: "row", alignItems: "center", gap: 20, marginBottom: 28 },
  sideBtn: { alignItems: "center", gap: 4, width: 60 },
  sideBtnLabel: { fontSize: 11, color: "#999" },
  playBtn: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", elevation: 3 },
  tipCard: { backgroundColor: "#f0f9e8", borderRadius: 16, padding: 20, width: "100%", borderLeftWidth: 4, borderLeftColor: PRIMARY },
  tipTitle: { fontSize: 14, fontWeight: "bold", color: "#333", marginBottom: 8 },
  tipText: { fontSize: 13, color: "#555", lineHeight: 22 },
});

// ─── Floating Pill — ALWAYS VISIBLE ──────────────────────────────────────────
// Shows as a small tomato 🍅 when disabled, full pill when enabled.

export function PomodoroFloatingPill() {
  const { settings, state, start, pause } = usePomodoro();
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  // Pulse when running
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state.isRunning && state.phase === "work") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [state.isRunning, state.phase]);

  const isWork   = state.phase === "work";
  const color    = settings.enabled ? (isWork ? WORK_COLOR : BREAK_COLOR) : TOMATO;
  const pillBg   = settings.enabled ? (isWork ? "#f0f9e8" : "#eff6ff") : "#fef2f2";
  const pillBorder = color + "50";

  return (
    <>
      {/* Break overlay */}
      {settings.enabled && <BreakOverlay />}

      {/* The pill — always rendered */}
      <Animated.View
        style={[
          pS.pill,
          {
            bottom: insets.bottom + 90,
            backgroundColor: pillBg,
            borderColor: pillBorder,
            transform: [{ scale: pulse }],
          },
        ]}
      >
        {!settings.enabled ? (
          /* ── Disabled state: just a tomato button ── */
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={pS.pillInner}
            activeOpacity={0.8}
          >
            <Text style={pS.tomatoEmoji}>🍅</Text>
            <Text style={[pS.pillLabel, { color: TOMATO }]}>Pomodoro</Text>
          </TouchableOpacity>
        ) : (
          /* ── Enabled state: countdown pill ── */
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={pS.pillInner}
            activeOpacity={0.85}
          >
            <View style={[pS.dot, { backgroundColor: color }]}>
              <Ionicons
                name={isWork ? "timer-outline" : "cafe-outline"}
                size={13}
                color="white"
              />
            </View>
            <Text style={[pS.pillTime, { color }]}>{fmt(state.timeLeft)}</Text>
            <Text style={[pS.pillPhase, { color: color + "cc" }]}>
              {isWork ? `#${state.sessionCount + 1}` : "Break"}
            </Text>
            {/* Inline play/pause so user doesn't need to open modal */}
            <TouchableOpacity
              onPress={state.isRunning ? pause : start}
              style={[pS.playBtn, { backgroundColor: color }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={state.isRunning ? "pause" : "play"}
                size={13}
                color="white"
              />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Full modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <TimerModal onClose={() => setModalVisible(false)} />
      </Modal>
    </>
  );
}

const pS = StyleSheet.create({
  pill: {
    position: "absolute",
    right: 16,
    borderRadius: 30,
    borderWidth: 1.5,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    zIndex: 1000,
  },
  pillInner: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 8 },
  tomatoEmoji: { fontSize: 20 },
  pillLabel: { fontSize: 13, fontWeight: "700" },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pillTime: { fontSize: 15, fontWeight: "bold", letterSpacing: 0.5, minWidth: 44 },
  pillPhase: { fontSize: 11, fontWeight: "600" },
  playBtn: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});

// ─── PomodoroHeaderButton (for screen headers) ────────────────────────────────

export function PomodoroHeaderButton() {
  const { settings, state } = usePomodoro();
  const [visible, setVisible] = useState(false);

  const color = settings.enabled
    ? (state.phase === "work" ? WORK_COLOR : BREAK_COLOR)
    : TOMATO;

  return (
    <>
      <TouchableOpacity
        style={[hS.btn, { backgroundColor: color + "20" }]}
        onPress={() => setVisible(true)}
      >
        <Text style={{ fontSize: 16 }}>🍅</Text>
        {settings.enabled && state.isRunning && (
          <View style={[hS.dot, { backgroundColor: color }]} />
        )}
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <TimerModal onClose={() => setVisible(false)} />
      </Modal>
    </>
  );
}

const hS = StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: "white" },
});
