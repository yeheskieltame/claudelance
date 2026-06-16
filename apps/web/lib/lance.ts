// $LANCE — the internal economy token (Lance Hub, ERC-4626 vault, CELO-backed).
// Buy = deposit CELO → mint $LANCE at NAV. Redeem = burn $LANCE → CELO (−fee).
// See the shared economy plan in the lance-hub repo (ECONOMY.md).

import type { Address } from "viem";

export const LANCE_ADDRESS = "0xb70c9Cd73428Afe51eEEA832C49E8840D3f85cA2" as Address; // Lance Hub proxy (= $LANCE token)
export const LANCE_ASSET = "0x471EcE3750Da237f93B8E339c536989b8978a438" as Address; // CELO ERC20 (pool asset)
export const LANCE_DECIMALS = 18;
export const LANCE_ASSET_SYMBOL = "CELO";

export const lanceAbi = [
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ name: "shares", type: "uint256" }] },
  { type: "function", name: "redeem", stateMutability: "nonpayable", inputs: [{ name: "shares", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ name: "assets", type: "uint256" }] },
  { type: "function", name: "previewDeposit", stateMutability: "view", inputs: [{ name: "assets", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "previewRedeem", stateMutability: "view", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "nav", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "redeemFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
