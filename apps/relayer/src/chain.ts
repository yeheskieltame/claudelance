import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  CLAUDELANCE_CORE_V3_ABI,
  ZERO_ADDRESS,
  chainForNetwork,
  type Bounty,
  type Submission,
  type TypeConfig,
} from '@yeheskieltame/claudelance-sdk';

import type { RelayerConfig } from './config.js';

const ABI = CLAUDELANCE_CORE_V3_ABI;

// keccak256("Transfer(address,address,uint256)") — ERC-721 mint scan on the identity registry
const TRANSFER_TOPIC: `0x${string}` =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const ERC721_OWNER_OF_ABI = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
] as const;

/** Decoded fields of a DeliverableSubmitted log passed to a findSubmission matcher. */
export type DeliverableLog = {
  bountyId: bigint;
  worker: Address;
  deliverableUrl: string;
  deliverableHash: string;
};

/**
 * Thin viem wrapper over the ClaudelanceCoreV3 proxy. Exposes exactly the
 * reads the keeper needs plus the three relayer-relevant writes: attestCI is
 * relayer-only, settleStake and cancelExpired are permissionless. Writes throw
 * without a wallet, so callers must gate them behind `config.dryRun`.
 */
export class ChainClient {
  readonly publicClient: PublicClient;
  readonly walletClient?: WalletClient<Transport, Chain, Account>;
  readonly core: Address;
  readonly identityRegistry: Address;

  constructor(cfg: RelayerConfig) {
    const chain = chainForNetwork(cfg.network);
    const transport = http(cfg.rpcUrl);
    this.publicClient = createPublicClient({ chain, transport });
    this.core = cfg.deployment.core;
    this.identityRegistry = cfg.deployment.identityRegistry;
    if (cfg.relayerPrivateKey) {
      const account = privateKeyToAccount(cfg.relayerPrivateKey);
      this.walletClient = createWalletClient({ chain, transport, account });
    }
  }

  /** Native balance of the signing wallet (0n when keyless / dry-run). */
  async relayerBalance(): Promise<bigint> {
    if (!this.walletClient) return 0n;
    return this.publicClient.getBalance({ address: this.walletClient.account.address });
  }

  get relayerAddress(): Address | undefined {
    return this.walletClient?.account.address;
  }

  /**
   * Highest valid bounty id, used as the keeper's scan ceiling. v3 has no
   * public bountyCount getter (EIP-7201 namespaced storage), so probe
   * geometrically then binary-search on getBounty(id).poster, mirroring the
   * SDK's getBountyCountV3. Ids are never reused.
   */
  async bountyCount(): Promise<bigint> {
    const isValid = async (id: bigint): Promise<boolean> => {
      const bounty = await this.getBounty(id);
      return bounty.poster !== ZERO_ADDRESS;
    };

    if (!(await isValid(1n))) return 0n;

    let hi = 1n;
    while (await isValid(hi)) hi *= 2n;

    let lo = hi / 2n;
    while (lo + 1n < hi) {
      const mid = (lo + hi) / 2n;
      if (await isValid(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  async getBounty(bountyId: bigint): Promise<Bounty> {
    return (await this.publicClient.readContract({
      address: this.core,
      abi: ABI,
      functionName: 'getBounty',
      args: [bountyId],
    })) as Bounty;
  }

  async getClaimers(bountyId: bigint): Promise<readonly Address[]> {
    return (await this.publicClient.readContract({
      address: this.core,
      abi: ABI,
      functionName: 'getClaimers',
      args: [bountyId],
    })) as readonly Address[];
  }

  async getSubmission(bountyId: bigint, worker: Address): Promise<Submission> {
    return (await this.publicClient.readContract({
      address: this.core,
      abi: ABI,
      functionName: 'getSubmission',
      args: [bountyId, worker],
    })) as Submission;
  }

  /** Task-type config (enabled, ciSupported, disclaimerRequired, minReviewers). */
  async getTaskTypeConfig(typeId: number): Promise<TypeConfig> {
    return (await this.publicClient.readContract({
      address: this.core,
      abi: ABI,
      functionName: 'getTaskTypeConfig',
      args: [typeId],
    })) as TypeConfig;
  }

  async isReputationAttested(bountyId: bigint): Promise<boolean> {
    return (await this.publicClient.readContract({
      address: this.core,
      abi: ABI,
      functionName: 'isReputationAttested',
      args: [bountyId],
    })) as boolean;
  }

  /** Current owner of an ERC-8004 Identity NFT, or null if the id does not exist. */
  async identityOwnerOf(agentId: bigint): Promise<Address | null> {
    try {
      return (await this.publicClient.readContract({
        address: this.identityRegistry,
        abi: ERC721_OWNER_OF_ABI,
        functionName: 'ownerOf',
        args: [agentId],
      })) as Address;
    } catch {
      return null;
    }
  }

  /**
   * Resolve a worker's ERC-8004 agentId: the registry has no reverse lookup,
   * so scan Identity Transfer mints to the worker, newest-first in fixed
   * windows down to `fromBlock`. Returns the latest minted id, or null.
   */
  async findAgentIdByOwner(worker: Address, fromBlock: bigint): Promise<bigint | null> {
    const WINDOW = 250_000n;
    const MAX_WINDOWS = 100;
    let hi = await this.publicClient.getBlockNumber();
    const padded: `0x${string}` = `0x${worker.slice(2).toLowerCase().padStart(64, '0')}`;
    const topics: [`0x${string}`, null, `0x${string}`] = [TRANSFER_TOPIC, null, padded];

    for (let w = 0; w < MAX_WINDOWS && hi >= fromBlock; w++) {
      const lo = hi > fromBlock + WINDOW ? hi - WINDOW + 1n : fromBlock;
      const logs = (await this.publicClient
        .request({
          method: 'eth_getLogs',
          params: [
            {
              address: this.identityRegistry,
              topics,
              fromBlock: `0x${lo.toString(16)}`,
              toBlock: `0x${hi.toString(16)}`,
            },
          ],
        })
        .catch(() => null)) as Array<{ topics: string[] }> | null;
      const tokenTopic = logs?.[logs.length - 1]?.topics[3];
      if (tokenTopic) return BigInt(tokenTopic);
      if (lo === fromBlock) break;
      hi = lo - 1n;
    }
    return null;
  }

  // Writes: simulate first (never burn gas on a revert) and pin the live gas
  // price — Celo's base fee floats around ~200 gwei; stale estimates have
  // broken writes before.

  async attestCI(bountyId: bigint, worker: Address, passed: boolean): Promise<`0x${string}`> {
    const wallet = this.requireWallet();
    const { request } = await this.publicClient.simulateContract({
      address: this.core,
      abi: ABI,
      functionName: 'attestCI',
      args: [bountyId, worker, passed],
      account: wallet.account,
      gasPrice: await this.publicClient.getGasPrice(),
    });
    return wallet.writeContract(request);
  }

  async settleStake(bountyId: bigint, worker: Address): Promise<`0x${string}`> {
    const wallet = this.requireWallet();
    const { request } = await this.publicClient.simulateContract({
      address: this.core,
      abi: ABI,
      functionName: 'settleStake',
      args: [bountyId, worker],
      account: wallet.account,
      gasPrice: await this.publicClient.getGasPrice(),
    });
    return wallet.writeContract(request);
  }

  async cancelExpired(bountyId: bigint): Promise<`0x${string}`> {
    const wallet = this.requireWallet();
    const { request } = await this.publicClient.simulateContract({
      address: this.core,
      abi: ABI,
      functionName: 'cancelExpired',
      args: [bountyId],
      account: wallet.account,
      gasPrice: await this.publicClient.getGasPrice(),
    });
    return wallet.writeContract(request);
  }

  async attestReputation(bountyId: bigint, agentId: bigint): Promise<`0x${string}`> {
    const wallet = this.requireWallet();
    const { request } = await this.publicClient.simulateContract({
      address: this.core,
      abi: ABI,
      functionName: 'attestReputation',
      args: [bountyId, agentId],
      account: wallet.account,
      gasPrice: await this.publicClient.getGasPrice(),
    });
    return wallet.writeContract(request);
  }

  /** Wait for inclusion so sequential keeper sends never race their own nonce. */
  async waitForReceipt(hash: `0x${string}`): Promise<'success' | 'reverted'> {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
    return receipt.status;
  }

  /**
   * Find the most recent DeliverableSubmitted log satisfying `matches`. Scans
   * newest-first in fixed windows down to `fromBlock`, returning on the first
   * hit. forno times out on an unbounded eth_getLogs, so the range is chunked;
   * a window the provider rejects is skipped rather than failing the lookup,
   * and MAX_WINDOWS caps the walk-back if `fromBlock` is left at 0.
   */
  async findSubmission(
    matches: (ref: DeliverableLog) => boolean,
    fromBlock: bigint,
  ): Promise<{ bountyId: bigint; worker: Address } | null> {
    const WINDOW = 50_000n;
    const MAX_WINDOWS = 200;
    let hi = await this.publicClient.getBlockNumber();

    for (let w = 0; w < MAX_WINDOWS && hi >= fromBlock; w++) {
      const lo = hi > fromBlock + WINDOW ? hi - WINDOW + 1n : fromBlock;
      let logs;
      try {
        logs = await this.publicClient.getContractEvents({
          address: this.core,
          abi: ABI,
          eventName: 'DeliverableSubmitted',
          fromBlock: lo,
          toBlock: hi,
        });
      } catch {
        if (lo === fromBlock) break;
        hi = lo - 1n;
        continue;
      }
      for (let i = logs.length - 1; i >= 0; i--) {
        const args = (logs[i] as unknown as { args?: Record<string, unknown> }).args;
        if (!args || typeof args.bountyId !== 'bigint' || typeof args.worker !== 'string') continue;
        const ref: DeliverableLog = {
          bountyId: args.bountyId,
          worker: args.worker as Address,
          deliverableUrl: typeof args.deliverableUrl === 'string' ? args.deliverableUrl : '',
          deliverableHash: typeof args.deliverableHash === 'string' ? args.deliverableHash : '',
        };
        if (matches(ref)) return { bountyId: ref.bountyId, worker: ref.worker };
      }
      if (lo === fromBlock) break;
      hi = lo - 1n;
    }
    return null;
  }

  private requireWallet(): WalletClient<Transport, Chain, Account> {
    if (!this.walletClient) {
      throw new Error(
        '[relayer] no wallet client. Set RELAYER_PRIVATE_KEY and DRY_RUN=false to broadcast.',
      );
    }
    return this.walletClient;
  }
}
