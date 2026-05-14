import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Document } from "@/lib/sqlite-service";
import { useColors } from "@/hooks/useColors";

const AREA_LABELS: Record<string, string> = {
  geral: "Geral",
  civil: "Civil",
  trabalhista: "Trabalhista",
  penal: "Penal",
  previdencia: "Previdência",
  tributario: "Tributário",
  administrativo: "Administrativo",
  consumidor: "Consumidor",
};

interface Props {
  doc: Document;
  onOpen: (doc: Document) => void;
  onDelete: (id: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function previewText(content: string): string {
  const plain = content.replace(/\n+/g, " ").trim();
  return plain.length > 80 ? plain.slice(0, 80) + "…" : plain;
}

export default function DocumentCard({ doc, onOpen, onDelete }: Props) {
  const colors = useColors();

  const handleDelete = () => {
    if (Platform.OS !== "web") {
      Alert.alert("Excluir documento", `Deseja excluir "${doc.title}"?`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onDelete(doc.id);
          },
        },
      ]);
    } else {
      onDelete(doc.id);
    }
  };

  return (
    <TouchableOpacity
      testID={`doc-card-${doc.id}`}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => onOpen(doc)}
      activeOpacity={0.75}
    >
      <View style={styles.top}>
        <View style={[styles.areaBadge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.areaText, { color: colors.secondaryForeground }]}>
            {AREA_LABELS[doc.area] ?? doc.area}
          </Text>
        </View>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>{formatDate(doc.updated_at)}</Text>
      </View>

      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
        {doc.title}
      </Text>

      {doc.content ? (
        <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={2}>
          {previewText(doc.content)}
        </Text>
      ) : (
        <Text style={[styles.preview, { color: colors.mutedForeground, fontStyle: "italic" }]}>
          Documento vazio
        </Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.border }]}
          onPress={() => onOpen(doc)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="edit-2" size={14} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.border }]}
          onPress={handleDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="trash-2" size={14} color={colors.destructive} />
          <Text style={[styles.actionText, { color: colors.destructive }]}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  areaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  areaText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  date: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  preview: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
