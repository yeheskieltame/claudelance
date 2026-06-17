/**
 * ERC-8004 agent ids (Identity NFT token ids) for the operator swarm + the
 * protocol's CI relayer agent. The registry has no on-chain reverse lookup
 * (address -> agentId), so these were resolved once from the registry's mint
 * `Transfer` events and pinned here. Used to link the "On-chain" column to the
 * agent's 8004scan profile.
 */
const AGENT_IDS: Record<string, bigint> = {
  "0xc0b31520d602118f67163b9f773b9df04d9e3409": 9061n,
  "0xa2afb427e73438579e7478bb2be4c1a0d067d634": 9062n,
  "0x1699066a71fad9e62f1784c35a6950b15005e8e1": 9063n,
  "0x794f78d2b6f35416ef634c7da4347b1684f2088d": 9064n,
  "0xad533df5ddecc53362e914ecc7f727023da8999e": 9065n,
  "0xc71da3355095674855307bcf6bee5c422eda587f": 9066n,
  "0xa62767fe5e12690585d337ff6ad8feda962b15bf": 9067n,
  "0xf918a6f6c0dcef3708c3388273188f644ba5d5de": 9068n,
  "0x3af1f45c8bd33a12015b108cc26729915e350987": 9069n,
  "0x19e2a3e0195834695fda2f42c8b755a85b9cfcf2": 9070n,
  "0x1cd8475240c68cbd9eb771251139cf75222989ae": 9071n,
  "0x15b6f176d7cfb2edfb0513242710dc46c9120c5d": 9072n,
  "0x6bdce18096514e860524ea238719306a471f0073": 9073n,
  "0xc813a1c39ced9f8c8613a7555ea312a52660708f": 9074n,
  "0x48185e835b7df0c48554879d71a8053304a193f2": 9075n,
  "0xff119bd56f068dc66879e219598213562c044eaf": 9076n,
  "0xe745ce965dcd0ac68c0f1af05e43d26218ebfe24": 9077n,
  "0xb0ac28caad88c3fe0d41af0082664099c67b752e": 9078n,
  "0x80f7a0cfad3aca9ef581ca1ed8e5d7596027a453": 9079n,
  "0x406d02009e91ead41aa16a36ea28e4cf31a71e45": 9080n,
  "0x5bd5033678dde4baf82d99ad2bd8ac3283d21f44": 9081n,
  "0x7ec8c3059509738029696ce690207ed14ce6d7de": 9082n,
  "0xa725f726913b0b3e4f62dc4dc1c820ad2d530dd1": 9083n,
  "0xfffdbac3ae3af5b9ccfb0824d09e15b95a6269a9": 9084n,
  "0x66e1852cb8497bad64be9272eb6896aed7907537": 9085n,
  "0x3c4df50a137b57e488136797b561d8dbb926811f": 9086n,
  "0x70f6996415d8a9eff9cdd4564c61b086b758659c": 9087n,
  "0xba55a2bc8fa37253ae6a03d36189bd91be27672b": 9088n,
  "0x075ed41b16417381abc2c7ccc23494fdd109addf": 9089n,
  "0xb585ba80f958dc77f57ba6af859d8e37c85df320": 9090n,
};

/** Protocol CI relayer agent. */
export const RELAYER_AGENT_ID = 9144n;

/** ERC-8004 agent id for a known swarm address, or `undefined` if unknown. */
export function agentIdFor(address: string): bigint | undefined {
  return AGENT_IDS[address.toLowerCase()];
}

/** 8004scan agent page for an ERC-8004 agent id on Celo (chain 42220). */
export function agent8004Url(agentId: bigint | number | string): string {
  return `https://www.8004scan.io/agents/celo/${agentId}`;
}

/**
 * Best on-chain link for a worker row: the agent's 8004scan profile if we know
 * its ERC-8004 id, otherwise the wallet's Celoscan address page.
 */
export function onchainIdentityUrl(address: string): string {
  const id = agentIdFor(address);
  return id !== undefined
    ? agent8004Url(id)
    : `https://celoscan.io/address/${address}`;
}
