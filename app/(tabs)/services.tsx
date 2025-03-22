import React from 'react';
import { useUserStore } from '../../store/useUserStore';
import ProviderServices from '../../components/provider/ProviderServices';
import UserServices from '../../components/user/UserServices';

export default function ServicesScreen() {
  const { profile } = useUserStore();

  if (profile?.role === 'provider') {
    return <ProviderServices />;
  }

  return <UserServices />;
}