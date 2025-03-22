import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button, Chip } from 'react-native-paper';
import { Order } from '../../types';

interface OrderStatusProps {
  order: Order;
  isProvider: boolean;
  onUpdateStatus?: (status: Order['status']) => void;
}

export function OrderStatus({ order, isProvider, onUpdateStatus }: OrderStatusProps) {
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
    if (!isProvider) return [];
    
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
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">Order #{order.id.slice(0, 8)}</Text>
        <Text>Service: {order.service}</Text>
        <Text>Amount: ₦{order.amount}</Text>
        <Chip
          style={[styles.statusChip, { backgroundColor: getStatusColor(order.status) }]}
        >
          {order.status.toUpperCase()}
        </Chip>
        
        {isProvider && getAvailableActions(order.status).length > 0 && (
          <View style={styles.actions}>
            {getAvailableActions(order.status).map((action) => (
              <Button
                key={action}
                mode={action === 'cancelled' ? 'outlined' : 'contained'}
                onPress={() => onUpdateStatus?.(action as Order['status'])}
                style={styles.actionButton}
              >
                {action === 'in_progress' ? 'Start Job' : 
                 action === 'completed' ? 'Complete Job' :
                 action.charAt(0).toUpperCase() + action.slice(1)}
              </Button>
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
  },
  statusChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  actionButton: {
    marginLeft: 8,
  },
}); 