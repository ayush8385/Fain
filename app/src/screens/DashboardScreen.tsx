import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchTransactions, Transaction } from "../api/transactions";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TransactionRow({ item }: { item: Transaction }) {
  const isDebit = item.direction === "debit";
  const sign = isDebit ? "-" : "+";
  const color = isDebit ? "#EF4444" : "#22C55E";
  const date = new Date(item.transactionDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.merchant} numberOfLines={1}>{item.merchantRaw}</Text>
        <Text style={styles.meta}>
          {item.category?.icon ?? "📦"} {item.category?.name ?? "Uncategorized"} · {date}
        </Text>
      </View>
      <Text style={[styles.amount, { color }]}>
        {sign}₹{Number(item.amount).toLocaleString("en-IN")}
      </Text>
    </View>
  );
}

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => fetchTransactions(),
  });

  const { totalSpend, needsReviewCount, byCategory } = useMemo(() => {
    let totalSpend = 0;
    let needsReviewCount = 0;
    const byCategory: Record<string, number> = {};

    for (const tx of transactions) {
      if (tx.direction === "debit") {
        totalSpend += Number(tx.amount);
        const cat = tx.category?.name ?? "Uncategorized";
        byCategory[cat] = (byCategory[cat] ?? 0) + Number(tx.amount);
      }
      if (tx.status === "needs_review") needsReviewCount++;
    }
    return { totalSpend, needsReviewCount, byCategory };
  }, [transactions]);

  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.heading}>Dashboard</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Total Spent This Month</Text>
        <Text style={styles.totalAmount}>₹{totalSpend.toLocaleString("en-IN")}</Text>
        {needsReviewCount > 0 && (
          <Text style={styles.reviewBadge}>{needsReviewCount} need review</Text>
        )}
      </View>

      {topCategories.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Top Categories</Text>
          {topCategories.map(([name, amount]) => (
            <View key={name} style={styles.categoryRow}>
              <Text style={styles.categoryName}>{name}</Text>
              <Text style={styles.categoryAmount}>₹{amount.toLocaleString("en-IN")}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={transactions.slice(0, 20)}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <TransactionRow item={item} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No transactions yet. New ones will appear here as your bank emails arrive.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 16 },
  heading: { fontSize: 26, fontWeight: "700", color: "#F8FAFC", marginBottom: 16 },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: { color: "#94A3B8", fontSize: 13, marginBottom: 4 },
  totalAmount: { fontSize: 32, fontWeight: "700", color: "#F8FAFC" },
  reviewBadge: {
    marginTop: 6,
    fontSize: 13,
    color: "#FBBF24",
    fontWeight: "600",
  },
  categoryRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  categoryName: { color: "#CBD5E1", fontSize: 14 },
  categoryAmount: { color: "#F8FAFC", fontSize: 14, fontWeight: "600" },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#F8FAFC", marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  rowLeft: { flex: 1, marginRight: 12 },
  merchant: { color: "#F8FAFC", fontSize: 15, fontWeight: "500" },
  meta: { color: "#64748B", fontSize: 12, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "600" },
  empty: { color: "#64748B", textAlign: "center", marginTop: 48, lineHeight: 22 },
});
