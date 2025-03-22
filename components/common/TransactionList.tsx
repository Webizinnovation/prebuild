import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { Transaction } from '../../types';

interface TransactionListProps {
  transactions: Transaction[];
  refreshing: boolean;
  onRefresh: () => void;
}

export function TransactionList({ transactions, refreshing, onRefresh }: TransactionListProps) {
  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit': return '↓';
      case 'withdrawal': return '↑';
      case 'payment': return '→';
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FFA500';
      case 'failed': return '#F44336';
    }
  };

  return (
    <FlatList
      data={transactions}
      refreshing={refreshing}
      onRefresh={onRefresh}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Card.Title
            title={`${getTransactionIcon(item.type)} ${item.type.toUpperCase()}`}
            subtitle={new Date(item.created_at).toLocaleDateString()}
            right={() => (
              <Text
                style={[
                  styles.amount,
                  { color: item.type === 'deposit' ? '#4CAF50' : '#F44336' }
                ]}
              >
                ₦{item.amount}
              </Text>
            )}
          />
          <Card.Content>
            <Text style={{ color: getStatusColor(item.status) }}>
              {item.status.toUpperCase()}
            </Text>
            {item.reference && (
              <Text>Ref: {item.reference}</Text>
            )}
          </Card.Content>
        </Card>
      )}
      keyExtractor={(item) => item.id}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
  },
  amount: {
    paddingRight: 16,
    fontWeight: 'bold',
  },
}); 