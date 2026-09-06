import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchTransactions, Transaction } from "../api/transactions";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FILTERS = [
  { label: "All", value: undefined },
  { label: "Auto", value: "auto_categorized" },
  { label: "Review", value: "needs_review" },
  { label: "Confirmed", value: "confirmed" },
] as const;

function TransactionRow({ item }: { item: Transaction }) {
  const isDebit = item.direction === "debit";
  const sign = isDebit ? "-" : "+";
  const color = isDebit ? "#EF4444" : "#22C55E";
  const date = new Date(item.transactionDate).toLocaleDateString("en-IN", {
    day: "numeric", month: "short",
  });

  const statusColor =
    item.status === "confirmed" ? "#22C55E" :
    item.status === "auto_categorized" ? "#6366F1" : "#FBBF24";

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.merchant} numberOfLines={1}>{item.merchantRaw}</Text>
        <Text style={styles.meta}>
          {item.category?.icon ?? "📦"} {item.category?.name ?? "Uncategorized"} · {date}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.amount, { color }]}>
          {sign}₹{Number(item.amount).toLocaleString("en-IN")}
        </Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>
    </View>
  );
}

export function TransactionListScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", filter],
    queryFn: () => fetchTransactions(filter),
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.heading}>Transactions</Text>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterLabel, filter === f.value && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color="#6366F1" />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <TransactionRow item={item} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No transactions found.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 16 },
  heading: { fontSize: 26, fontWeight: "700", color: "#F8FAFC", marginBottom: 12 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
  },
  filterChipActive: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  filterLabel: { color: "#94A3B8", fontSize: 13 },
  filterLabelActive: { color: "#FFFFFF", fontWeight: "600" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  rowLeft: { flex: 1, marginRight: 12 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  merchant: { color: "#F8FAFC", fontSize: 15, fontWeight: "500" },
  meta: { color: "#64748B", fontSize: 12, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "600" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  empty: { color: "#64748B", textAlign: "center", marginTop: 48 },
});
