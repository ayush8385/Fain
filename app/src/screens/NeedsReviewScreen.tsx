import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTransactions, fetchCategories, setTransactionCategory, Transaction, Category } from "../api/transactions";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function CategoryPicker({
  categories,
  onPick,
}: {
  categories: Category[];
  onPick: (categoryId: string) => void;
}) {
  return (
    <View style={styles.pickerGrid}>
      {categories.map((cat) => (
        <TouchableOpacity key={cat.id} style={styles.catChip} onPress={() => onPick(cat.id)}>
          <Text style={styles.catIcon}>{cat.icon ?? "📦"}</Text>
          <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReviewCard({
  transaction,
  categories,
  onConfirm,
  isPending,
}: {
  transaction: Transaction;
  categories: Category[];
  onConfirm: (categoryId: string) => void;
  isPending: boolean;
}) {
  const isDebit = transaction.direction === "debit";
  const sign = isDebit ? "-" : "+";
  const color = isDebit ? "#EF4444" : "#22C55E";
  const date = new Date(transaction.transactionDate).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <Text style={styles.merchant}>{transaction.merchantRaw}</Text>
          <Text style={styles.date}>{date} · {transaction.accountLast4 ? `••${transaction.accountLast4}` : "UPI"}</Text>
        </View>
        <Text style={[styles.amount, { color }]}>
          {sign}₹{Number(transaction.amount).toLocaleString("en-IN")}
        </Text>
      </View>

      <Text style={styles.prompt}>Tag as:</Text>
      {isPending ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : (
        <CategoryPicker categories={categories} onPick={onConfirm} />
      )}
    </View>
  );
}

export function NeedsReviewScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading: loadingTx } = useQuery({
    queryKey: ["transactions", "needs_review"],
    queryFn: () => fetchTransactions("needs_review"),
  });

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const [pendingId, setPendingId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ txId, categoryId }: { txId: string; categoryId: string }) =>
      setTransactionCategory(txId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setPendingId(null);
    },
    onError: () => {
      Alert.alert("Error", "Failed to save category. Please try again.");
      setPendingId(null);
    },
  });

  function handleConfirm(tx: Transaction, categoryId: string) {
    setPendingId(tx.id);
    mutation.mutate({ txId: tx.id, categoryId });
  }

  if (loadingTx || loadingCats) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.heading}>Needs Review</Text>
      {pending.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyBody}>New transactions will appear here when they need a category.</Text>
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <ReviewCard
              transaction={item}
              categories={categories}
              onConfirm={(catId) => handleConfirm(item, catId)}
              isPending={pendingId === item.id}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            <Text style={styles.count}>{pending.length} transaction{pending.length !== 1 ? "s" : ""} to review</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  heading: { fontSize: 26, fontWeight: "700", color: "#F8FAFC", marginBottom: 8, paddingHorizontal: 16 },
  count: { color: "#94A3B8", fontSize: 13, marginBottom: 12 },
  card: { backgroundColor: "#1E293B", borderRadius: 14, padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  cardLeft: { flex: 1, marginRight: 12 },
  merchant: { color: "#F8FAFC", fontSize: 17, fontWeight: "600" },
  date: { color: "#64748B", fontSize: 12, marginTop: 3 },
  amount: { fontSize: 20, fontWeight: "700" },
  prompt: { color: "#94A3B8", fontSize: 13, marginBottom: 10 },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    minWidth: 80,
    borderWidth: 1,
    borderColor: "#334155",
  },
  catIcon: { fontSize: 18 },
  catName: { color: "#CBD5E1", fontSize: 11, marginTop: 3 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: "#F8FAFC", fontSize: 20, fontWeight: "600", marginBottom: 8 },
  emptyBody: { color: "#64748B", fontSize: 14, textAlign: "center", lineHeight: 20 },
});
