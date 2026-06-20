import { defineChain } from 'viem';

/**
 * viem chain definition for Celo Mainnet.
 */
export const celoMainnet = defineChain({
  id: 42_220,
  name: 'Celo',
  network: 'celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
    public: { http: ['https://forno.celo.org'] },
  },
  blockExplorers: {
    default: { name: 'Celoscan', url: 'https://celoscan.io' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 13_112_599,
    },
  },
});

/** Friendly network key accepted by SDK factories. `'mainnet'` is an alias for `'celo'`. */
export type NetworkKey = 'celo' | 'mainnet';

export function chainForNetwork(network: NetworkKey) {
  if (network === 'celo' || network === 'mainnet') return celoMainnet;
  throw new Error(`[chainForNetwork] Unknown network: ${network as string}`);
}
