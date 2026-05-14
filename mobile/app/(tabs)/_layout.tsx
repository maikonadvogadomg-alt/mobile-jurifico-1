import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={95} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ),
        tabBarLabelStyle: { fontSize: 10, fontFamily: "Inter_500Medium" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Documentos",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="doc.text" tintColor={color} size={22} /> : <Feather name="file-text" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jurisprudencia"
        options={{
          title: "Jurisprudência",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="scale.3d" tintColor={color} size={22} /> : <Feather name="book-open" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="processos"
        options={{
          title: "Processos",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="magnifyingglass.circle" tintColor={color} size={22} /> : <Feather name="search" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ferramentas"
        options={{
          title: "Ferramentas",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="wrench.and.screwdriver" tintColor={color} size={22} /> : <Feather name="tool" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="configuracoes"
        options={{
          title: "Config",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="gearshape" tintColor={color} size={22} /> : <Feather name="settings" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
