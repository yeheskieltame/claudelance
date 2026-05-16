'use client';

import { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { celo, celoAlfajores } from 'wagmi/chains';
import { PrivyProvider as PrivyAuthProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  chains: [celo, celoAlfajores],
  transports: {
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
});

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

export function PrivyProvider({ children }: { children: ReactNode }) {
  if (!privyAppId) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <PrivyAuthProvider
          appId={privyAppId}
          config={{
            loginMethods: ['email', 'wallet', 'google'],
            appearance: {
              theme: 'light',
              accentColor: '#676FFF',
            },
            embeddedWallets: {
              createOnLogin: 'users-without-wallets',
            },
          }}
        >
          {children}
        </PrivyAuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
