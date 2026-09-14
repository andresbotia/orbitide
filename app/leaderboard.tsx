import { router, type Href } from 'expo-router';

import { HomePlaceholderScreen } from '@/screens/HomePlaceholderScreen';

export default function LeaderboardRoute() {
  return (
    <HomePlaceholderScreen
      title="Leaderboard"
      body="Rankings aren’t live yet. This tab is a placeholder so Home navigation stays safe."
      tab="leaderboard"
      onShop={() => router.replace('/shop' as Href)}
      onHome={() => router.replace('/')}
      onLeaderboard={() => undefined}
    />
  );
}
