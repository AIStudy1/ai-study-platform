import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from "firebase/auth";
import { auth } from "/Users/mac/AiStudy/mobile/firebaseConfig.ts";
import { COLORS, SPACING, RADIUS } from "/Users/mac/AiStudy/mobile/theme.ts";


export default function Dashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to AI Study Platform</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push("/course")}
      >
        <Text style={styles.cardText}>Introduction to AI</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logout} onPress={handleLogout}>
        <Text style={{ color: "white" }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f4f6f8',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  card: {
    backgroundColor: COLORS.card,
    padding: 20,
    borderRadius: RADIUS,
    marginBottom: SPACING.medium,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  
  cardText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  logout: {
    backgroundColor: 'red',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 40,
  },
});
