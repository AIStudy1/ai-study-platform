import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, TextInput, Alert, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  apiGetLeaderboard, apiGetStreak, apiBuyStreakFreeze,
  apiGetFriends, apiSearchUsers, apiAddFriend, apiRespondToFriend,
  apiGetInviteCode,
} from "@/services/api";

const PRIMARY = "#9cd21f";

const LEAGUE_META: Record<string, { emoji: string; color: string; label: string; minXP: number }> = {
  bronze:  { emoji: "🥉", color: "#cd7f32", label: "Bronze",  minXP: 0    },
  silver:  { emoji: "🥈", color: "#9ca3af", label: "Silver",  minXP: 100  },
  gold:    { emoji: "🥇", color: "#eab308", label: "Gold",    minXP: 300  },
  diamond: { emoji: "💎", color: "#3b82f6", label: "Diamond", minXP: 600  },
  legend:  { emoji: "👑", color: "#8b5cf6", label: "Legend",  minXP: 1000 },
};

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

interface BoardEntry {
  rank: number; id: string; fullName: string; username: string | null;
  avatarUrl: string | null; displayXP: number; weeklyXP: number; xp: number;
  level: number; streakDays: number;
  leagueTier: { tier: string; emoji: string; color: string; label: string };
  isMe: boolean;
}

type BoardType   = "global" | "friends";
type PeriodType  = "weekly" | "alltime";

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "white", fontWeight: "bold", fontSize: size * 0.38 }}>
        {(name || "?").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────
function LeaderboardRow({ entry, period }: { entry: BoardEntry; period: PeriodType }) {
  const tierMeta = LEAGUE_META[entry.leagueTier?.tier || "bronze"] || LEAGUE_META.bronze;
  const xp = period === "weekly" ? entry.weeklyXP : entry.xp;
  return (
    <View style={[rs.row, entry.isMe && rs.rowMe]}>
      <View style={rs.rankBox}>
        {entry.rank <= 3
          ? <Text style={{ fontSize: 20 }}>{RANK_MEDALS[entry.rank - 1]}</Text>
          : <Text style={rs.rankNum}>{entry.rank}</Text>}
      </View>
      <Avatar url={entry.avatarUrl} name={entry.fullName} size={42} />
      <View style={rs.info}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={rs.name} numberOfLines={1}>{entry.fullName}</Text>
          {entry.isMe && <View style={rs.meBadge}><Text style={rs.meBadgeText}>You</Text></View>}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 13 }}>{tierMeta.emoji}</Text>
          <Text style={[rs.tier, { color: tierMeta.color }]}>{tierMeta.label}</Text>
          {entry.streakDays > 0 && (
            <Text style={rs.streak}>🔥 {entry.streakDays}</Text>
          )}
        </View>
      </View>
      <View style={rs.xpBox}>
        <Text style={[rs.xp, { color: entry.isMe ? PRIMARY : "#333" }]}>{xp.toLocaleString()}</Text>
        <Text style={rs.xpLabel}>{period === "weekly" ? "weekly XP" : "total XP"}</Text>
      </View>
    </View>
  );
}
const rs = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 14, padding: 12, marginBottom: 8, gap: 12, elevation: 1 },
  rowMe: { borderWidth: 2, borderColor: PRIMARY, backgroundColor: PRIMARY + "08" },
  rankBox: { width: 32, alignItems: "center" },
  rankNum: { fontSize: 16, fontWeight: "bold", color: "#999" },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: "700", color: "#333", maxWidth: 150 },
  meBadge: { backgroundColor: PRIMARY + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  meBadgeText: { fontSize: 10, color: PRIMARY, fontWeight: "700" },
  tier: { fontSize: 11, fontWeight: "600" },
  streak: { fontSize: 11, color: "#f97316" },
  xpBox: { alignItems: "flex-end" },
  xp: { fontSize: 16, fontWeight: "bold" },
  xpLabel: { fontSize: 10, color: "#999" },
});

// ─── Friends tab ──────────────────────────────────────────────────────────────
function FriendsPanel() {
  const [friends, setFriends]         = useState<any[]>([]);
  const [searchQ, setSearchQ]         = useState("");
  const [searchResults, setSearchRes] = useState<any[]>([]);
  const [inviteCode, setInviteCode]   = useState("");
  const [loading, setLoading]         = useState(false);
  const [searching, setSearching]     = useState(false);
  const [showAdd, setShowAdd]         = useState(false);

  useEffect(() => {
    loadFriends();
    loadInviteCode();
  }, []);

  const loadFriends = async () => {
    try {
      const res = await apiGetFriends();
      setFriends(res.data || []);
    } catch {}
  };

  const loadInviteCode = async () => {
    try {
      const res = await apiGetInviteCode();
      setInviteCode(res.data.code);
    } catch {}
  };

  const handleSearch = useCallback(async (q: string) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchRes([]); return; }
    setSearching(true);
    try {
      const res = await apiSearchUsers(q);
      setSearchRes(res.data || []);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleAddById = async (friendId: string) => {
    try {
      await apiAddFriend({ friendId });
      Alert.alert("Friend request sent! 🎉");
      setSearchRes([]);
      setSearchQ("");
      setShowAdd(false);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleAddByCode = async () => {
    const code = searchQ.trim().toUpperCase();
    if (code.length !== 6) { Alert.alert("Invite codes are 6 characters"); return; }
    try {
      await apiAddFriend({ inviteCode: code });
      Alert.alert("Friend request sent! 🎉");
      setSearchQ("");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleRespond = async (id: string, action: "accept" | "reject") => {
    try {
      await apiRespondToFriend(id, action);
      loadFriends();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const pending   = friends.filter(f => f.status === "pending" && f.direction === "received");
  const accepted  = friends.filter(f => f.status === "accepted");

  return (
    <View style={{ flex: 1 }}>
      {/* My invite code */}
      <View style={fp.codeCard}>
        <Text style={fp.codeLabel}>Your invite code</Text>
        <View style={fp.codeRow}>
          <Text style={fp.codeText}>{inviteCode || "------"}</Text>
          <TouchableOpacity style={fp.shareBtn}>
            <Ionicons name="copy-outline" size={16} color={PRIMARY} />
            <Text style={fp.shareText}>Copy</Text>
          </TouchableOpacity>
        </View>
        <Text style={fp.codeSub}>Share this code so friends can add you</Text>
      </View>

      {/* Add friend button */}
      <TouchableOpacity style={fp.addBtn} onPress={() => setShowAdd(true)}>
        <Ionicons name="person-add" size={18} color="white" />
        <Text style={fp.addBtnText}>Add a Friend</Text>
      </TouchableOpacity>

      {/* Pending requests */}
      {pending.length > 0 && (
        <View style={fp.section}>
          <Text style={fp.sectionTitle}>Friend Requests ({pending.length})</Text>
          {pending.map((f) => (
            <View key={f.id} style={fp.requestRow}>
              <Avatar url={f.friend?.avatar_url} name={f.friend?.full_name || "?"} size={40} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={fp.friendName}>{f.friend?.full_name || "Student"}</Text>
                {f.friend?.username && <Text style={fp.friendUsername}>@{f.friend.username}</Text>}
              </View>
              <TouchableOpacity style={fp.acceptBtn} onPress={() => handleRespond(f.id, "accept")}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={fp.rejectBtn} onPress={() => handleRespond(f.id, "reject")}>
                <Ionicons name="close" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Friends list */}
      <View style={fp.section}>
        <Text style={fp.sectionTitle}>Friends ({accepted.length})</Text>
        {accepted.length === 0 ? (
          <Text style={fp.empty}>No friends yet — add some to compete!</Text>
        ) : (
          accepted.map((f) => (
            <View key={f.id} style={fp.friendRow}>
              <Avatar url={f.friend?.avatar_url} name={f.friend?.full_name || "?"} size={42} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={fp.friendName}>{f.friend?.full_name || "Student"}</Text>
                <Text style={fp.friendStats}>
                  Lv {f.friend?.level || 1} · {f.friend?.weekly_xp || 0} XP this week
                  {(f.friend?.streak_days || 0) > 0 ? ` · 🔥${f.friend.streak_days}` : ""}
                </Text>
              </View>
              <Text style={{ fontSize: 20 }}>
                {LEAGUE_META[f.friend?.league_tier || "bronze"]?.emoji || "🥉"}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Add friend modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
          <View style={fp.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAdd(false); setSearchQ(""); setSearchRes([]); }} style={fp.closeBtn}>
              <Ionicons name="arrow-back" size={20} color="#333" />
            </TouchableOpacity>
            <Text style={fp.modalTitle}>Add Friend</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <TextInput
              style={fp.searchInput}
              placeholder="Search by name, username, or enter invite code…"
              placeholderTextColor="#999"
              value={searchQ}
              onChangeText={handleSearch}
              autoFocus
            />
            {searchQ.length === 6 && /^[A-Z0-9]{6}$/i.test(searchQ) && (
              <TouchableOpacity style={fp.codeAddBtn} onPress={handleAddByCode}>
                <Text style={{ color: "white", fontWeight: "700" }}>Add by invite code: {searchQ.toUpperCase()}</Text>
              </TouchableOpacity>
            )}
            {searching && <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />}
            {searchResults.map((u) => (
              <View key={u.id} style={fp.friendRow}>
                <Avatar url={u.avatar_url} name={u.full_name || "?"} size={42} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={fp.friendName}>{u.full_name || "Student"}</Text>
                  {u.username && <Text style={fp.friendUsername}>@{u.username}</Text>}
                </View>
                <TouchableOpacity style={fp.acceptBtn} onPress={() => handleAddById(u.id)}>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>Add</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const fp = StyleSheet.create({
  codeCard: { backgroundColor: "white", margin: 16, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: PRIMARY + "30" },
  codeLabel: { fontSize: 12, color: "#999", fontWeight: "600", marginBottom: 8 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  codeText: { fontSize: 28, fontWeight: "900", color: "#333", letterSpacing: 4 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: PRIMARY + "15", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  shareText: { color: PRIMARY, fontWeight: "700", fontSize: 13 },
  codeSub: { fontSize: 12, color: "#999", marginTop: 6 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: PRIMARY, marginHorizontal: 16, marginBottom: 16, borderRadius: 14, padding: 14 },
  addBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#333", marginBottom: 10 },
  requestRow: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 12, padding: 12, marginBottom: 8, gap: 8, elevation: 1 },
  friendRow: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1 },
  friendName: { fontSize: 14, fontWeight: "700", color: "#333" },
  friendUsername: { fontSize: 12, color: "#999", marginTop: 1 },
  friendStats: { fontSize: 11, color: "#888", marginTop: 2 },
  acceptBtn: { backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  rejectBtn: { padding: 6 },
  empty: { color: "#999", textAlign: "center", paddingVertical: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 17, fontWeight: "bold", color: "#333" },
  searchInput: { backgroundColor: "white", borderRadius: 14, padding: 14, fontSize: 14, color: "#333", borderWidth: 1.5, borderColor: "#e5e7eb", marginBottom: 12 },
  codeAddBtn: { backgroundColor: PRIMARY, borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 12 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const router = useRouter();
  const [boardType, setBoardType]   = useState<BoardType>("global");
  const [period, setPeriod]         = useState<PeriodType>("weekly");
  const [mainTab, setMainTab]       = useState<"board" | "friends" | "streak">("board");
  const [board, setBoard]           = useState<BoardEntry[]>([]);
  const [myRank, setMyRank]         = useState<number | null>(null);
  const [myEntry, setMyEntry]       = useState<BoardEntry | null>(null);
  const [streak, setStreak]         = useState<any>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    loadBoard();
    loadStreak();
  }, [boardType, period]);

  const loadBoard = async () => {
    setLoading(true);
    try {
      const res = await apiGetLeaderboard(boardType, period);
      setBoard(res.data.board || []);
      setMyRank(res.data.myRank);
      setMyEntry(res.data.myEntry);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStreak = async () => {
    try {
      const res = await apiGetStreak();
      setStreak(res.data);
    } catch {}
  };

  const handleBuyFreeze = async () => {
    Alert.alert("Buy Streak Freeze", "Spend 50 XP to protect your streak for 1 day?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Buy (-50 XP)", onPress: async () => {
          try {
            const res = await apiBuyStreakFreeze();
            Alert.alert("❄️ Streak Freeze added!", `You now have ${res.data.freezeCount} freeze(s).`);
            loadStreak();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  const top3  = board.slice(0, 3);
  const rest  = board.slice(3);
  const tierMeta = streak ? (LEAGUE_META[streak.leagueTier?.tier || "bronze"] || LEAGUE_META.bronze) : LEAGUE_META.bronze;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      {/* Header */}
      <View style={ls.header}>
        <TouchableOpacity onPress={() => router.back()} style={ls.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={ls.headerTitle}>Leaderboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Main tabs */}
      <View style={ls.mainTabs}>
        {(["board", "friends", "streak"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[ls.mainTab, mainTab === t && ls.mainTabActive]}
            onPress={() => setMainTab(t)}
          >
            <Text style={[ls.mainTabText, mainTab === t && ls.mainTabTextActive]}>
              {t === "board" ? "Rankings" : t === "friends" ? "Friends" : "My Streak"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mainTab === "friends" ? (
        <ScrollView>
          <FriendsPanel />
        </ScrollView>
      ) : mainTab === "streak" ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {streak ? (
            <>
              {/* Big streak card */}
              <View style={ls.streakHero}>
                <Text style={ls.streakFlame}>🔥</Text>
                <Text style={ls.streakNum}>{streak.currentStreak}</Text>
                <Text style={ls.streakLabel}>day streak</Text>
                <Text style={ls.longestText}>Longest: {streak.longestStreak} days</Text>
              </View>

              {/* League card */}
              <View style={[ls.leagueCard, { borderColor: tierMeta.color + "40" }]}>
                <Text style={{ fontSize: 40 }}>{tierMeta.emoji}</Text>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={[ls.leagueTitle, { color: tierMeta.color }]}>{tierMeta.label} League</Text>
                  <Text style={ls.leagueXP}>{streak.weeklyXP} XP this week</Text>
                  {streak.nextLeagueTier && (
                    <>
                      <View style={ls.leagueBar}>
                        <View style={[ls.leagueBarFill, {
                          width: `${Math.min(100, (streak.weeklyXP / streak.nextLeagueTier.minXP) * 100)}%`,
                          backgroundColor: tierMeta.color,
                        }]} />
                      </View>
                      <Text style={ls.leagueSub}>
                        {streak.leagueXPToNext} XP to {LEAGUE_META[streak.nextLeagueTier.tier]?.label}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              {/* Freeze & shield */}
              <View style={ls.protectRow}>
                <View style={ls.protectCard}>
                  <Text style={{ fontSize: 28 }}>❄️</Text>
                  <Text style={ls.protectNum}>{streak.freezeCount}</Text>
                  <Text style={ls.protectLabel}>Freezes</Text>
                  <TouchableOpacity style={ls.buyBtn} onPress={handleBuyFreeze}>
                    <Text style={ls.buyBtnText}>Buy (-50 XP)</Text>
                  </TouchableOpacity>
                </View>
                <View style={ls.protectCard}>
                  <Text style={{ fontSize: 28 }}>🛡️</Text>
                  <Text style={ls.protectNum}>{streak.shieldActive ? "Active" : "None"}</Text>
                  <Text style={ls.protectLabel}>Shield</Text>
                  <Text style={ls.protectSub}>Earned at 7-day streak</Text>
                </View>
              </View>

              {/* 7-day calendar */}
              <View style={ls.calCard}>
                <Text style={ls.calTitle}>This Week</Text>
                <View style={ls.calRow}>
                  {(() => {
                    const today = new Date();
                    const studied = new Set((streak.recentDays || []).map((r: any) => r.date));
                    return Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(today);
                      d.setDate(today.getDate() - (6 - i));
                      const ds = d.toISOString().split("T")[0];
                      const isStudied = studied.has(ds);
                      const isToday = ds === today.toISOString().split("T")[0];
                      return (
                        <View key={ds} style={ls.calDay}>
                          <Text style={ls.calDayLabel}>
                            {["M","T","W","T","F","S","S"][d.getDay() === 0 ? 6 : d.getDay() - 1]}
                          </Text>
                          <View style={[ls.calDot, isStudied && ls.calDotStudied, isToday && !isStudied && ls.calDotToday]}>
                            {isStudied && <Ionicons name="checkmark" size={12} color="white" />}
                          </View>
                        </View>
                      );
                    });
                  })()}
                </View>
              </View>
            </>
          ) : (
            <ActivityIndicator color={PRIMARY} />
          )}
        </ScrollView>
      ) : (
        /* ── Rankings board ── */
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Sub-controls */}
          <View style={ls.controls}>
            <View style={ls.segControl}>
              {(["global", "friends"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[ls.seg, boardType === t && ls.segActive]}
                  onPress={() => setBoardType(t)}
                >
                  <Text style={[ls.segText, boardType === t && ls.segTextActive]}>
                    {t === "global" ? "🌍 Global" : "👥 Friends"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={ls.segControl}>
              {(["weekly", "alltime"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[ls.seg, period === t && ls.segActive]}
                  onPress={() => setPeriod(t)}
                >
                  <Text style={[ls.segText, period === t && ls.segTextActive]}>
                    {t === "weekly" ? "Weekly" : "All-time"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* My rank pill */}
          {myRank && (
            <View style={ls.myRankPill}>
              <Text style={ls.myRankText}>Your rank: #{myRank}</Text>
              {myEntry && (
                <Text style={ls.myRankXP}>
                  {period === "weekly" ? myEntry.weeklyXP : myEntry.xp} XP
                </Text>
              )}
            </View>
          )}

          {loading ? (
            <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
          ) : board.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Text style={{ fontSize: 48 }}>🏆</Text>
              <Text style={{ color: "#999", marginTop: 12, fontSize: 15 }}>
                {boardType === "friends" ? "Add friends to see their rankings!" : "No data yet"}
              </Text>
            </View>
          ) : (
            <>
              {/* Podium top 3 */}
              {top3.length >= 1 && (
                <View style={ls.podium}>
                  {/* 2nd */}
                  {top3[1] && (
                    <View style={[ls.podiumCol, { marginTop: 30 }]}>
                      <Avatar url={top3[1].avatarUrl} name={top3[1].fullName} size={50} />
                      <Text style={ls.podiumMedal}>🥈</Text>
                      <Text style={ls.podiumName} numberOfLines={1}>{top3[1].fullName.split(" ")[0]}</Text>
                      <Text style={ls.podiumXP}>{period === "weekly" ? top3[1].weeklyXP : top3[1].xp}</Text>
                      <View style={[ls.podiumBlock, { height: 50, backgroundColor: "#9ca3af30" }]} />
                    </View>
                  )}
                  {/* 1st */}
                  <View style={ls.podiumCol}>
                    <View style={ls.crownBox}><Text style={{ fontSize: 20 }}>👑</Text></View>
                    <Avatar url={top3[0].avatarUrl} name={top3[0].fullName} size={64} />
                    <Text style={ls.podiumMedal}>🥇</Text>
                    <Text style={ls.podiumName} numberOfLines={1}>{top3[0].fullName.split(" ")[0]}</Text>
                    <Text style={ls.podiumXP}>{period === "weekly" ? top3[0].weeklyXP : top3[0].xp}</Text>
                    <View style={[ls.podiumBlock, { height: 70, backgroundColor: "#eab30830" }]} />
                  </View>
                  {/* 3rd */}
                  {top3[2] && (
                    <View style={[ls.podiumCol, { marginTop: 50 }]}>
                      <Avatar url={top3[2].avatarUrl} name={top3[2].fullName} size={44} />
                      <Text style={ls.podiumMedal}>🥉</Text>
                      <Text style={ls.podiumName} numberOfLines={1}>{top3[2].fullName.split(" ")[0]}</Text>
                      <Text style={ls.podiumXP}>{period === "weekly" ? top3[2].weeklyXP : top3[2].xp}</Text>
                      <View style={[ls.podiumBlock, { height: 34, backgroundColor: "#cd7f3230" }]} />
                    </View>
                  )}
                </View>
              )}

              {/* Rest of list */}
              {rest.map((entry) => (
                <LeaderboardRow key={entry.id} entry={entry} period={period} />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const ls = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", elevation: 2 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  mainTabs: { flexDirection: "row", backgroundColor: "white", paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  mainTab: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: "center", backgroundColor: "#f3f4f6" },
  mainTabActive: { backgroundColor: PRIMARY },
  mainTabText: { fontSize: 13, fontWeight: "600", color: "#999" },
  mainTabTextActive: { color: "white" },
  controls: { gap: 8, marginBottom: 16 },
  segControl: { flexDirection: "row", backgroundColor: "white", borderRadius: 12, padding: 4, gap: 4 },
  seg: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  segActive: { backgroundColor: PRIMARY + "20" },
  segText: { fontSize: 13, fontWeight: "600", color: "#999" },
  segTextActive: { color: PRIMARY },
  myRankPill: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: PRIMARY + "15", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: PRIMARY + "30" },
  myRankText: { fontSize: 14, fontWeight: "700", color: PRIMARY },
  myRankXP: { fontSize: 14, fontWeight: "700", color: "#666" },
  podium: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 8, marginBottom: 24, paddingBottom: 8 },
  podiumCol: { alignItems: "center", flex: 1 },
  crownBox: { marginBottom: 4 },
  podiumMedal: { fontSize: 20, marginTop: 4 },
  podiumName: { fontSize: 12, fontWeight: "700", color: "#333", maxWidth: 80, textAlign: "center", marginTop: 2 },
  podiumXP: { fontSize: 11, color: "#666", marginBottom: 4 },
  podiumBlock: { width: "100%", borderRadius: 8 },
  streakHero: { backgroundColor: "white", borderRadius: 20, padding: 32, alignItems: "center", marginBottom: 16, elevation: 2 },
  streakFlame: { fontSize: 56 },
  streakNum: { fontSize: 64, fontWeight: "900", color: "#f97316", lineHeight: 72 },
  streakLabel: { fontSize: 16, color: "#999", fontWeight: "600" },
  longestText: { fontSize: 13, color: "#ccc", marginTop: 8 },
  leagueCard: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 2, elevation: 1 },
  leagueTitle: { fontSize: 18, fontWeight: "800" },
  leagueXP: { fontSize: 13, color: "#666", marginTop: 2 },
  leagueBar: { height: 8, backgroundColor: "#f3f4f6", borderRadius: 10, marginVertical: 6 },
  leagueBarFill: { height: 8, borderRadius: 10 },
  leagueSub: { fontSize: 11, color: "#999" },
  protectRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  protectCard: { flex: 1, backgroundColor: "white", borderRadius: 16, padding: 16, alignItems: "center", elevation: 1 },
  protectNum: { fontSize: 20, fontWeight: "bold", color: "#333", marginTop: 4 },
  protectLabel: { fontSize: 12, color: "#666" },
  protectSub: { fontSize: 10, color: "#ccc", textAlign: "center", marginTop: 4 },
  buyBtn: { backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginTop: 8 },
  buyBtnText: { fontSize: 11, color: "#3b82f6", fontWeight: "700" },
  calCard: { backgroundColor: "white", borderRadius: 16, padding: 16, elevation: 1 },
  calTitle: { fontSize: 15, fontWeight: "700", color: "#333", marginBottom: 12 },
  calRow: { flexDirection: "row", justifyContent: "space-between" },
  calDay: { alignItems: "center", gap: 4 },
  calDayLabel: { fontSize: 11, color: "#bbb", fontWeight: "600" },
  calDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#e5e7eb" },
  calDotStudied: { backgroundColor: "#f97316", borderColor: "#f97316" },
  calDotToday: { borderColor: "#f97316", borderWidth: 2 },
});
