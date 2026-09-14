import { router, type Href } from 'expo-router';

import { HomePlaceholderScreen } from '@/screens/HomePlaceholderScreen';

export default function ShopRoute() {
  return (
    <HomePlaceholderScreen
      title="Shop"
      body="The shop isn’t open yet. Nothing to buy, and no currency is spent here."
      tab="shop"
      onShop={() => undefined}
      onHome={() => router.replace('/')}
      onLeaderboard={() => router.replace('/leaderboard' as Href)}
    />
  );
}
