import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Card, Text, Button, Chip, List } from 'react-native-paper';
import { Order } from '../../types';

interface ProviderOrdersProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function ProviderOrders({ orders, onUpdateStatus, onRefresh, refreshing }: ProviderOrdersProps) {
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'accepted': return '#4169E1';
      case 'in_progress': return '#32CD32';
      case 'completed': return '#008000';
      case 'cancelled': return '#FF0000';
      default: return '#808080';
    }
  };

  const getAvailableActions = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return ['accepted', 'cancelled'];
      case 'accepted':
        return ['in_progress', 'cancelled'];
      case 'in_progress':
        return ['completed'];
      default:
        return [];
    }
  };

  return (
    <FlatList
      data={orders}
      refreshing={refreshing}
      onRefresh={onRefresh}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Card.Title
            title={`Order #${item.id.slice(0, 8)}`}
            subtitle={new Date(item.created_at).toLocaleDateString()}
          />
          <Card.Content>
            <Text>Service: {item.service}</Text>
            <Text>Amount: ₦{item.amount}</Text>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
            >
              {item.status.toUpperCase()}
            </Chip>
          </Card.Content>
          {getAvailableActions(item.status).length > 0 && (
            <Card.Actions>
              {getAvailableActions(item.status).map((action) => (
                <Button
                  key={action}
                  onPress={() => onUpdateStatus(item.id, action as Order['status'])}
                  mode={action === 'cancelled' ? 'outlined' : 'contained'}
                >
                  {action === 'in_progress' ? 'Start Job' : 
                   action === 'completed' ? 'Complete Job' :
                   action.charAt(0).toUpperCase() + action.slice(1)}
                </Button>
              ))}
            </Card.Actions>
          )}
        </Card>
      )}
      keyExtractor={(item) => item.id}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    marginTop: 0,
  },
  statusChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
}); 