import React from 'react';
import { View } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { useUserStore } from '../../store/useUserStore';
import { UserWallet } from '../../components/user/UserWallet';
import { ProviderWallet } from '../../components/provider/ProviderWallet';

export default function WalletScreen() {
  const { profile } = useUserStore();

  if (profile?.role === 'user') {
    return (
      <View style={styles.container}>
        <UserWallet />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ProviderWallet />
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
});