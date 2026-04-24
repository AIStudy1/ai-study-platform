import { Tabs } from 'expo-router';
import React from 'react';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PomodoroProvider } from '@/context/PomodoroContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <PomodoroProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}
      >
        <Tabs.Screen name="moodle-course" options={{ href: null }} />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="rectangle.grid.2x2.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="safari.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="ai"
          options={{
            title: 'AI',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="sparkles" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="planner"
          options={{
            title: 'Planner',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="calendar" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="person.fill" color={color} />
            ),
          }}
        />

        {/* Hidden from tab bar */}
        <Tabs.Screen name="index"      options={{ href: null }} />
        <Tabs.Screen name="login"      options={{ href: null }} />
        <Tabs.Screen name="signup"     options={{ href: null }} />
        <Tabs.Screen name="course"     options={{ href: null }} />
        <Tabs.Screen name="moodle"     options={{ href: null }} />
        <Tabs.Screen name="settings"   options={{ href: null }} />
        <Tabs.Screen name="diagnostic" options={{ href: null }} />
      </Tabs>
    </PomodoroProvider>
  );
}