import { celoSepolia, celoMainnet } from "../chain";
import { createConfig, http, type Config } from "wagmi";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "";

export const wagmiConfig: Config = createConfig({
  chains: [celoSepolia, celoMainnet],
  transports: {
    [celoSepolia.id]: http(),
    [celoMainnet.id]: http(),
  },
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Claudelance" }),
    walletConnect({ projectId: wcProjectId }),
  ],
});