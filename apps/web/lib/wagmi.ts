"use client";

import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

import { celoMainnet, celoSepolia, supportedChains } from "@/lib/chain";

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected()],
  transports: {
    [celoSepolia.id]: http(),
    [celoMainnet.id]: http(),
  },
  ssr: true,
});
