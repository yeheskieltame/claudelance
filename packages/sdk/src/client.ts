import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Account,
  type Address,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

import {
  CLAUDELANCE_CORE_ABI,
  CLAUDELANCE_CORE_V3_ABI,
  MAINNET,
  SEPOLIA,
  type Bounty,
  type Deployment,
  type Submission,
  type TokenSet,
  type TypeConfig,
} from '@yeheskieltame/claudelance-types';

import { chainForNetwork, type NetworkKey } from './chain.js';
import { CUSD_ABI } from './cusd-abi.js';
import {
  throwTyped,
  AlreadyClaimedError,
  NothingToWithdrawError,
} from './errors.js';
import {
  listBounties,
  listOpenBountiesByType,
  listBountiesByPoster,
  listClaimableByWorker,
  type ListBountiesOptions,
  type BountyPage,
  type BountyWithId,
} from './list-bounties.js';

// setTimeout is a runtime global in both Node and browsers, but the SDK's
// tsconfig keeps `lib` to ES2022 (no DOM/node) to stay portable, so declare it.
declare function setTimeout(handler: () => void, timeout: number): unknown;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

/** Inputs accepted by {@link ClaudelanceClient.fromPrivateKey}. */
export type FromPrivateKeyOptions = {
  privateKey: `0x${string}`;
  network: NetworkKey;
  /** Override the default forno RPC; useful for an Alchemy/Infura key. */
  rpcUrl?: string;
};

/** Inputs accepted by {@link ClaudelanceClient.fromMnemonic}. */
export type FromMnemonicOptions = {
  /** BIP-39 mnemonic phrase (12 or 24 words). */
  mnemonic: string;
  network: NetworkKey;
  /** Override the default forno RPC; useful for an Alchemy/Infura key. */
  rpcUrl?: string;
  /**
   * BIP-44 derivation path. Defaults to `m/44'/60'/0'/0/0` — the Ethereum
   * standard for the first account / first address, which matches what
   * MetaMask + most desktop wallets produce.
   */
  derivationPath?: `m/44'/60'/${string}`;
};

/** Inputs accepted by the {@link ClaudelanceClient} constructor. */
export type ClaudelanceClientOptions = {
  publicClient: PublicClient;
  walletClient?: WalletClient<Transport, Chain, Account>;
  core: Address;
  /** Whitelisted escrow tokens (cUSD, CELO, USDC). */
  tokens: TokenSet;
  /** ERC-8004 Identity Registry. Workers must hold a token here to claimSlot. */
  identityRegistry: Address;
  /** ERC-8004 Reputation Registry — feedback (reputation) about agents. */
  reputationRegistry: Address;
};

/**
 * Payload for {@link ClaudelanceClient.submitDeliverable} (v3).
 * Works for all task types: GitHub PR, Gist, IPFS/Arweave content, etc.
 */
export type SubmitDeliverableOptions = {
  /** Deliverable URL: GitHub PR, Gist, IPFS CID, Arweave TX, or any verifiable URL. */
  deliverableUrl: string;
  /** keccak256 of the deliverable content (or git commit SHA padded to bytes32). */
  deliverableHash: `0x${string}`;
  /** Free-form JSON: worker capabilities, model used, task-type metadata, etc. */
  metadata?: string;
};

/**
 * @deprecated Use {@link SubmitDeliverableOptions}. submitPR is v2-only and does
 * not exist on the v3 contract. This alias is kept for backward compatibility.
 */
export type SubmitPROptions = {
  prUrl: string;
  commitHash: `0x${string}`;
  metadata?: string;
};

/**
 * Stages emitted by {@link ClaudelanceClient.runWorkerLoop} so callers can
 * surface progress in headless logs or a UI progress bar.
 */
export type WorkerStage =
  | "ensure-identity"
  | "approve"
  | "claim"
  | "submit"
  | "done";

export type WorkerProgress = {
  stage: WorkerStage;
  tx?: `0x${string}`;
  detail?: string;
};

export type WorkerProgressFn = (progress: WorkerProgress) => void;

/** Payload accepted by {@link ClaudelanceClient.postBounty} (open marketplace). */
export type PostBountyOptions = {
  /** ERC20 used for escrow + payout. Must be whitelisted on chain. */
  token: Address;
  /** 0 = Code; 0-255 reserved for future tiers. */
  bountyType?: number;
  targetRepoUrl: string;
  instructionUrl: string;
  /** keccak256 of the off-chain JSON spec, or 0x000… for ad-hoc bounties. */
  requirementsHash?: `0x${string}`;
  /** Reward in token wei. Must be >= the per-token `minBounty`. */
  amount: bigint;
  /** Maximum simultaneous claimers (1..MAX_SLOTS=20). */
  maxSlots: number;
  /** Anti-sybil stake in token wei. v2 requires `> 0`. */
  stake: bigint;
  /** Bounty lifetime in seconds (1..14 days). */
  deadlineSeconds: bigint;
  /** Require CI to pass before a winner is eligible. */
  ciRequired: boolean;
};

/** Payload accepted by {@link ClaudelanceClient.postDirectHire} (single chosen worker). */
export type PostDirectHireOptions = {
  token: Address;
  /** Worker who will exclusively own the single slot. Must be non-zero. */
  targetWorker: Address;
  bountyType?: number;
  targetRepoUrl: string;
  instructionUrl: string;
  requirementsHash?: `0x${string}`;
  amount: bigint;
  /** Stake required from the chosen worker. Must be `> 0`. */
  stake: bigint;
  deadlineSeconds: bigint;
};

/**
 * High-level read + write client for ClaudelanceCore (v2 and v3).
 *
 * Default target is the v3 UUPS proxy which supports all 10 task types and
 * `submitDeliverable` (not just GitHub PRs). v2 methods are kept for backward
 * compat but `submitPR` is deprecated — use `submitDeliverable` instead.
 *
 * Multi-token escrow: every write that moves tokens takes (or infers from
 * the bounty) the ERC20 to use. Workers must be registered ERC-8004 agents
 * before they can `claimSlot`.
 */
export class ClaudelanceClient {
  readonly publicClient: PublicClient;
  readonly walletClient?: WalletClient<Transport, Chain, Account>;
  readonly core: Address;
  readonly tokens: TokenSet;
  readonly identityRegistry: Address;
  readonly reputationRegistry: Address;

  constructor(opts: ClaudelanceClientOptions) {
    this.publicClient = opts.publicClient;
    this.walletClient = opts.walletClient;
    this.core = opts.core;
    this.tokens = opts.tokens;
    this.identityRegistry = opts.identityRegistry;
    this.reputationRegistry = opts.reputationRegistry;
  }

  /** The wallet address this client signs with, or `undefined` for a read-only client. */
  get address(): Address | undefined {
    return this.walletClient?.account?.address;
  }

  /**
   * Convenience: build a fully-wired client from a private key + network
   * key. Resolves the canonical addresses from `@yeheskieltame/claudelance-types`.
   *
   * Supported networks: `'sepolia'` (Celo Sepolia) and `'celo'` (Celo Mainnet).
   */
  static fromPrivateKey(opts: FromPrivateKeyOptions): ClaudelanceClient {
    const deployment: Deployment = (opts.network === 'celo' || opts.network === 'mainnet') ? MAINNET : SEPOLIA;
    const chain = chainForNetwork(opts.network);
    const account = privateKeyToAccount(opts.privateKey);
    const transport = http(opts.rpcUrl);

    const publicClient = createPublicClient({ chain, transport });
    const walletClient = createWalletClient({ chain, transport, account });

    return new ClaudelanceClient({
      publicClient,
      walletClient,
      core: deployment.core,
      tokens: deployment.tokens,
      identityRegistry: deployment.identityRegistry,
      reputationRegistry: deployment.reputationRegistry,
    });
  }

  /**
   * Build a fully-wired client from a BIP-39 mnemonic + network key.
   * Friendly onboarding path: an operator can paste their seed phrase
   * (12 or 24 words) without ever extracting the raw private key.
   *
   * Default derivation `m/44'/60'/0'/0/0` (Ethereum standard, first
   * account / first address). Override `derivationPath` to use a
   * different index — e.g. `m/44'/60'/0'/0/1` for the second address.
   *
   * Supported networks: `'sepolia'` (Celo Sepolia) and `'celo'` (Celo Mainnet).
   */
  /**
   * Build a read-only client from an RPC URL + network key.
   * No private key required — only read methods are available.
   * Write methods throw `[ClaudelanceClient] Write methods require a wallet client`.
   */
  static fromRpcUrl(opts: { rpcUrl?: string; network: NetworkKey }): ClaudelanceClient {
    const deployment: Deployment = (opts.network === 'celo' || opts.network === 'mainnet') ? MAINNET : SEPOLIA;
    const chain = chainForNetwork(opts.network);
    const transport = http(opts.rpcUrl);
    const publicClient = createPublicClient({ chain, transport });

    return new ClaudelanceClient({
      publicClient,
      core: deployment.core,
      tokens: deployment.tokens,
      identityRegistry: deployment.identityRegistry,
      reputationRegistry: deployment.reputationRegistry,
    });
  }

  static fromMnemonic(opts: FromMnemonicOptions): ClaudelanceClient {
    const deployment: Deployment = (opts.network === 'celo' || opts.network === 'mainnet') ? MAINNET : SEPOLIA;
    const chain = chainForNetwork(opts.network);
    const account = mnemonicToAccount(opts.mnemonic, {
      path: opts.derivationPath ?? "m/44'/60'/0'/0/0",
    });
    const transport = http(opts.rpcUrl);

    const publicClient = createPublicClient({ chain, transport });
    const walletClient = createWalletClient({ chain, transport, account });

    return new ClaudelanceClient({
      publicClient,
      walletClient,
      core: deployment.core,
      tokens: deployment.tokens,
      identityRegistry: deployment.identityRegistry,
      reputationRegistry: deployment.reputationRegistry,
    });
  }

  // ─── Read API ─────────────────────────────────────────────────────────

  async getBounty(bountyId: bigint): Promise<Bounty> {
    return (await this.publicClient.readContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'getBounty',
      args: [bountyId],
    })) as Bounty;
  }

  /**
   * A worker's submission for a bounty, including the relayer's CI verdict.
   * v3: fields are `deliverableUrl` + `deliverableHash` (not prUrl/commitHash).
   * `submittedAt === 0n` means the worker has not submitted yet.
   */
  async getSubmission(bountyId: bigint, worker: Address): Promise<Submission> {
    return (await this.publicClient.readContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'getSubmission',
      args: [bountyId, worker],
    })) as Submission;
  }

  /**
   * Poll `getBounty` until `predicate` holds (or attempts run out), returning
   * the last-read bounty. Use this to bridge a write and a dependent read:
   * public RPCs like forno load-balance, so a read issued right after a mined
   * write can hit a lagging node and return pre-write state. e.g. after
   * `pickWinner`, `await waitForBounty(id, (b) => b.status === 1)` before
   * `settleStake` so it doesn't revert `BountyNotResolved`.
   */
  async waitForBounty(
    bountyId: bigint,
    predicate: (bounty: Bounty) => boolean,
    opts?: { attempts?: number; intervalMs?: number },
  ): Promise<Bounty> {
    const attempts = opts?.attempts ?? 10;
    const intervalMs = opts?.intervalMs ?? 2500;
    let bounty = await this.getBounty(bountyId);
    for (let i = 1; i < attempts && !predicate(bounty); i++) {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), intervalMs));
      bounty = await this.getBounty(bountyId);
    }
    return bounty;
  }

  /**
   * Total bounty count. On v2, reads the `bountyCount` public getter.
   * On v3 (EIP-7201 storage, no public getter), falls back to `getBountyCountV3`.
   *
   * For new code targeting v3, prefer `getBountyCountV3()` directly.
   */
  async getBountyCount(): Promise<bigint> {
    try {
      return (await this.publicClient.readContract({
        address: this.core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: 'bountyCount',
      })) as bigint;
    } catch {
      return this.getBountyCountV3();
    }
  }

  /**
   * Return every currently-open bounty via multicall.
   * Uses `getBountyCountV3` for scan range on v3 (binary search, O(log n)).
   */
  async listOpenBounties(): Promise<Array<Bounty & { id: bigint }>> {
    const count = await this.getBountyCountV3();
    if (count === 0n) return [];

    const calls = [];
    for (let i = 1n; i <= count; i++) {
      calls.push({
        address: this.core,
        abi: CLAUDELANCE_CORE_V3_ABI,
        functionName: 'getBounty' as const,
        args: [i] as const,
      });
    }
    const results = await this.publicClient.multicall({
      contracts: calls,
      allowFailure: true,
    });

    const out: Array<Bounty & { id: bigint }> = [];
    for (let idx = 0; idx < results.length; idx++) {
      const r = results[idx];
      if (!r || r.status === 'failure') continue;
      const b = r.result as Bounty;
      if (b.status === 0) out.push({ ...b, id: BigInt(idx + 1) });
    }
    return out;
  }

  /**
   * Filtered, paginated bounty list (v3).
   * Scans up to `maxId` in one multicall, applies filters client-side.
   * Uses `getBountyCountV3()` for the scan range if `maxId` is not provided.
   *
   * @example
   * const page = await client.listBounties({ bountyType: 2, pageSize: 10 })
   * page.items.forEach(b => console.log(b.id, b.instructionUrl))
   */
  async listBounties(opts?: ListBountiesOptions, maxId?: bigint): Promise<BountyPage> {
    const count = maxId ?? await this.getBountyCountV3();
    return listBounties(this.publicClient, this.core, count, opts);
  }

  /** List open bounties of a specific task type (v3). */
  async listOpenBountiesByType(bountyType: number, opts?: Omit<ListBountiesOptions, 'status' | 'bountyType'>): Promise<BountyPage> {
    const count = await this.getBountyCountV3();
    return listOpenBountiesByType(this.publicClient, this.core, count, bountyType, opts);
  }

  /** List all bounties posted by a specific address (v3). */
  async listBountiesByPoster(poster: Address, opts?: Omit<ListBountiesOptions, 'poster'>): Promise<BountyPage> {
    const count = await this.getBountyCountV3();
    return listBountiesByPoster(this.publicClient, this.core, count, poster, opts);
  }

  /** List open bounties the given worker address can claim (v3). */
  async listClaimableByWorker(worker?: Address): Promise<BountyWithId[]> {
    const who = worker ?? this.requireAccount();
    const count = await this.getBountyCountV3();
    return listClaimableByWorker(this.publicClient, this.core, count, who);
  }

  /** Per-token marketplace stats. `resolved`, `posters`, `workers` are global. */
  async getStats(token: Address): Promise<{
    volume: bigint;
    revenue: bigint;
    resolved: bigint;
    posters: bigint;
    workers: bigint;
  }> {
    const [volume, revenue, resolved, posters, workers] =
      (await this.publicClient.readContract({
        address: this.core,
        abi: CLAUDELANCE_CORE_V3_ABI,
        functionName: 'getStats',
        args: [token],
      })) as readonly [bigint, bigint, bigint, bigint, bigint];
    return { volume, revenue, resolved, posters, workers };
  }

  /**
   * Pending earnings for an address in a specific token.
   *
   * v2 only: reads the `earnings(address, token)` public mapping getter.
   * On v3 this getter does not exist (EIP-7201 storage). For v3, earnings
   * are opaque until `withdrawEarnings` is called — use `EarningsWithdrawn`
   * event logs via `listProtocolRevenueEvents` or `watchEarningsWithdrawn`
   * to audit past withdrawals.
   */
  async getEarnings(account: Address, token: Address): Promise<bigint> {
    try {
      return (await this.publicClient.readContract({
        address: this.core,
        abi: CLAUDELANCE_CORE_ABI,
        functionName: 'earnings',
        args: [account, token],
      })) as bigint;
    } catch {
      // v3 does not expose the earnings mapping as a public getter.
      return 0n;
    }
  }

  /**
   * Pending earnings for the connected wallet in a specific token.
   * Returns 0 on v3 (earnings not readable — see `getEarnings` for details).
   */
  async getMyEarnings(token: Address): Promise<bigint> {
    return this.getEarnings(this.requireAccount(), token);
  }

  /** True iff `agent` holds at least one ERC-8004 Identity NFT. */
  async hasAgentIdentity(agent: Address): Promise<boolean> {
    const balance = (await this.publicClient.readContract({
      address: this.identityRegistry,
      abi: ERC721_BALANCE_OF_ABI,
      functionName: 'balanceOf',
      args: [agent],
    })) as bigint;
    return balance > 0n;
  }

  /**
   * Resolve an address's ERC-8004 agent id (its Identity NFT token id). The
   * registry has no reverse lookup, so this scans the mint `Transfer` event
   * over a window (default ~2M blocks back; widen via `fromBlock` for older
   * agents). Returns `null` if no mint to `agent` is found in range.
   */
  async agentIdOf(agent: Address, opts?: { fromBlock?: bigint }): Promise<bigint | null> {
    const latest = await this.publicClient.getBlockNumber();
    const fromBlock = opts?.fromBlock ?? (latest > 2_000_000n ? latest - 2_000_000n : 0n);
    const logs = await this.publicClient.getLogs({
      address: this.identityRegistry,
      event: IDENTITY_TRANSFER_EVENT,
      args: { to: agent },
      fromBlock,
      toBlock: latest,
    });
    const minted = logs.find((l) => (l.args as { from?: Address }).from === ZERO_ADDRESS) ?? logs[0];
    return (minted?.args as { tokenId?: bigint } | undefined)?.tokenId ?? null;
  }

  /**
   * Read an agent's ERC-8004 reputation. Feedback is per-(agent, client), so
   * this enumerates the agent's clients then summarises across them.
   * `feedbackCount` is the total number of (non-revoked) feedback entries.
   */
  async getReputation(
    agentId: bigint,
  ): Promise<{ clients: Address[]; feedbackCount: bigint; score: bigint }> {
    const clients = (await this.publicClient.readContract({
      address: this.reputationRegistry,
      abi: REPUTATION_ABI,
      functionName: 'getClients',
      args: [agentId],
    })) as Address[];
    if (clients.length === 0) return { clients, feedbackCount: 0n, score: 0n };
    const [count, score] = (await this.publicClient.readContract({
      address: this.reputationRegistry,
      abi: REPUTATION_ABI,
      functionName: 'getSummary',
      args: [agentId, clients, '', ''],
    })) as readonly [bigint, bigint, number];
    return { clients, feedbackCount: count, score };
  }

  /**
   * Give on-chain feedback (reputation) about an agent via the ERC-8004
   * Reputation Registry. The caller is recorded as the client; it must NOT be
   * the agent's owner/operator (the registry blocks self-feedback). Defaults
   * to a +1 positive rating tagged for a resolved Claudelance bounty.
   */
  async giveFeedback(
    agentId: bigint,
    opts?: {
      value?: bigint;
      valueDecimals?: number;
      tag1?: string;
      tag2?: string;
      endpoint?: string;
      feedbackURI?: string;
      feedbackHash?: `0x${string}`;
    },
  ): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    return wallet.writeContract({
      address: this.reputationRegistry,
      abi: REPUTATION_ABI,
      functionName: 'giveFeedback',
      args: [
        agentId,
        opts?.value ?? 1n,
        opts?.valueDecimals ?? 0,
        opts?.tag1 ?? 'claudelance',
        opts?.tag2 ?? 'bounty-resolved',
        opts?.endpoint ?? '',
        opts?.feedbackURI ?? '',
        opts?.feedbackHash ?? `0x${'0'.repeat(64)}`,
      ],
      account: wallet.account,
      chain: wallet.chain,
    });
  }

  /**
   * Ensure the wallet has an ERC-8004 Identity NFT. Idempotent:
   * - If already registered, returns `{ tokenId: 0n, minted: false }` immediately
   *   (no on-chain write, tokenId 0n is a sentinel meaning "use other lookups").
   * - If not registered, calls `IdentityRegistry.register()` from the wallet,
   *   waits for the receipt, and returns `{ tokenId, minted: true }` where
   *   tokenId is parsed from the simulated return value.
   *
   * Use this at the top of any worker session before `claimSlot` so the
   * on-chain `NoAgentIdentity` guard is guaranteed to pass.
   */
  async ensureIdentity(): Promise<{ tokenId: bigint; minted: boolean; tx?: `0x${string}` }> {
    const wallet = this.requireWalletClient();
    const who = wallet.account.address;

    if (await this.hasAgentIdentity(who)) {
      return { tokenId: 0n, minted: false };
    }

    const { result, request } = await this.publicClient.simulateContract({
      address: this.identityRegistry,
      abi: IDENTITY_REGISTRY_REGISTER_ABI,
      functionName: 'register',
      account: wallet.account,
    });

    const tx = await wallet.writeContract(request);
    await this.publicClient.waitForTransactionReceipt({ hash: tx });

    return { tokenId: result as bigint, minted: true, tx };
  }

  /**
   * Eligibility check before claiming. Mirrors the v3 on-chain guards so
   * agents don't waste gas on a guaranteed-revert `claimSlot` call.
   *
   * Note: the `hasClaimed(bountyId, worker)` mapping getter exists on v2 but
   * is not a public getter on v3 (EIP-7201 namespaced storage). To check if
   * the wallet already claimed on v3, call `getClaimers(bountyId)` and search
   * the result — or just attempt `claimSlot` and catch `AlreadyClaimedError`.
   */
  async canClaim(bountyId: bigint, account?: Address): Promise<boolean> {
    const who = account ?? this.requireAccount();
    const b = await this.getBounty(bountyId);
    if (b.status !== 0) return false;
    if (b.deadline <= BigInt(Math.floor(Date.now() / 1000))) return false;
    if (b.claimedSlots >= b.maxSlots) return false;
    if (b.targetWorker !== ZERO_ADDRESS && b.targetWorker.toLowerCase() !== who.toLowerCase()) {
      return false;
    }
    if (!(await this.hasAgentIdentity(who))) return false;

    // On v3: check the claimers list. On v2: try the hasClaimed getter.
    try {
      const claimers = await this.getClaimers(bountyId);
      return !claimers.some((c) => c.toLowerCase() === who.toLowerCase());
    } catch {
      // v2 fallback: hasClaimed public getter
      try {
        const claimed = (await this.publicClient.readContract({
          address: this.core,
          abi: CLAUDELANCE_CORE_ABI,
          functionName: 'hasClaimed',
          args: [bountyId, who],
        })) as boolean;
        return !claimed;
      } catch {
        return true; // cannot determine — optimistically allow
      }
    }
  }

  // ─── Worker write API ────────────────────────────────────────────────

  async claimSlot(bountyId: bigint): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    return wallet.writeContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'claimSlot',
      args: [bountyId],
      account: wallet.account,
      chain: wallet.chain,
    });
  }

  /**
   * Approve the bounty's token for the required stake (if needed) then
   * claim the slot. Two transactions max; the approval is awaited so
   * `claimSlot` cannot race ahead of an unmined approval.
   */
  async claimSlotWithApproval(bountyId: bigint): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    const who = wallet.account.address;
    const bounty = await this.getBounty(bountyId);
    const stake = bounty.stakeRequired;

    if (stake > 0n) {
      await this.ensureAllowance(bounty.token, who, stake);
    }
    return this.claimSlot(bountyId);
  }

  /**
   * Submit a deliverable for any task type (v3). Replaces `submitPR`.
   * Works for GitHub PRs (type 0), Gist/IPFS/Arweave for all other types.
   */
  async submitDeliverable(bountyId: bigint, opts: SubmitDeliverableOptions): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    return wallet.writeContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'submitDeliverable',
      args: [bountyId, opts.deliverableUrl, opts.deliverableHash, opts.metadata ?? ''],
      account: wallet.account,
      chain: wallet.chain,
    });
  }

  /**
   * @deprecated v3 contract uses `submitDeliverable`. This wrapper maps v2 field
   * names to the v3 call so existing code keeps working against the v3 proxy.
   */
  async submitPR(bountyId: bigint, opts: SubmitPROptions): Promise<`0x${string}`> {
    return this.submitDeliverable(bountyId, {
      deliverableUrl: opts.prUrl,
      deliverableHash: opts.commitHash,
      metadata: opts.metadata,
    });
  }

  async settleStake(bountyId: bigint, worker?: Address): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    return wallet.writeContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'settleStake',
      args: [bountyId, worker ?? wallet.account.address],
      account: wallet.account,
      chain: wallet.chain,
    });
  }

  /** Pull-pattern withdrawal for a single token. Always callable, even when paused. */
  async withdrawEarnings(token: Address): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    return wallet.writeContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'withdrawEarnings',
      args: [token],
      account: wallet.account,
      chain: wallet.chain,
    });
  }

  /**
   * Convenience: sweep earnings for every whitelisted token.
   * On v3, the `earnings` mapping is not a public getter, so this attempts
   * each `withdrawEarnings` and silently skips `NothingToWithdraw` reverts.
   */
  async withdrawAllEarnings(): Promise<Array<{ token: Address; hash: `0x${string}` }>> {
    const tokens: Address[] = [this.tokens.cUSD, this.tokens.CELO, this.tokens.USDC];
    const out: Array<{ token: Address; hash: `0x${string}` }> = [];
    for (const t of tokens) {
      try {
        out.push({ token: t, hash: await this.withdrawEarnings(t) });
      } catch (err) {
        if (err instanceof NothingToWithdrawError) continue;
        throwTyped(err);
      }
    }
    return out;
  }

  /**
   * Approve every whitelisted token in `this.tokens` (cUSD/CELO/USDC) to
   * the Core for `type(uint256).max` if the current allowance is short.
   * Idempotent: tokens already approved are reported with `hash: null`.
   *
   * Useful first-run helper so a worker only signs three approve tx once
   * and can then `claimSlot` against any future bounty regardless of token.
   */
  async approveAllTokens(): Promise<Array<{ token: Address; hash: `0x${string}` | null }>> {
    const wallet = this.requireWalletClient();
    const owner = wallet.account.address;
    const tokens: Address[] = [this.tokens.cUSD, this.tokens.CELO, this.tokens.USDC];
    const max = (2n ** 256n) - 1n;

    const out: Array<{ token: Address; hash: `0x${string}` | null }> = [];
    for (const t of tokens) {
      const allowance = (await this.publicClient.readContract({
        address: t,
        abi: CUSD_ABI,
        functionName: 'allowance',
        args: [owner, this.core],
      })) as bigint;
      if (allowance >= max / 2n) {
        out.push({ token: t, hash: null });
        continue;
      }
      const hash = await wallet.writeContract({
        address: t,
        abi: CUSD_ABI,
        functionName: 'approve',
        args: [this.core, max],
        account: wallet.account,
        chain: wallet.chain,
      });
      await this.publicClient.waitForTransactionReceipt({ hash });
      out.push({ token: t, hash });
    }
    return out;
  }

  /**
   * Orchestrator: claim slot (with auto-approval) then submit the deliverable
   * in one call. Skips `claimSlot` if the wallet already holds the slot.
   * Returns both tx hashes (`claimTx` is `null` when the slot was already claimed).
   *
   * Accepts either v3 `SubmitDeliverableOptions` or the legacy v2 `SubmitPROptions` shape.
   */
  async solveAndSubmit(opts: {
    bountyId: bigint;
    /** v3: deliverable URL (GitHub PR, Gist, IPFS, Arweave). */
    deliverableUrl?: string;
    /** v3: keccak256 content hash (or commit SHA padded to bytes32). */
    deliverableHash?: `0x${string}`;
    /** @deprecated v2 alias for deliverableUrl */
    prUrl?: string;
    /** @deprecated v2 alias for deliverableHash */
    commitHash?: `0x${string}`;
    metadata?: string;
  }): Promise<{ claimTx: `0x${string}` | null; submitTx: `0x${string}` }> {
    const wallet = this.requireWalletClient();
    const me = wallet.account.address;

    // v3 does not expose hasClaimed as a public getter; attempt claim and catch AlreadyClaimed.
    let claimTx: `0x${string}` | null = null;
    try {
      claimTx = await this.claimSlotWithApproval(opts.bountyId);
      await this.publicClient.waitForTransactionReceipt({ hash: claimTx });
    } catch (err) {
      if (err instanceof AlreadyClaimedError) {
        claimTx = null;
      } else {
        throwTyped(err, { bountyId: opts.bountyId });
      }
    }

    const url = opts.deliverableUrl ?? opts.prUrl ?? '';
    const hash = opts.deliverableHash ?? opts.commitHash ?? `0x${'0'.repeat(64)}`;
    const submitTx = await this.submitDeliverable(opts.bountyId, {
      deliverableUrl: url,
      deliverableHash: hash as `0x${string}`,
      metadata: opts.metadata,
    });
    await this.publicClient.waitForTransactionReceipt({ hash: submitTx });
    return { claimTx, submitTx };
  }

  /**
   * Headless worker-side orchestration for any task type (v3). Walks the worker
   * through the full onboarding-to-submission flow with progress events.
   * Use this for cold-start workers; use {@link solveAndSubmit} when already set up.
   *
   * Stages emitted in order:
   *   1. ensure-identity — mints ERC-8004 Identity NFT if missing
   *   2. approve         — approves Core to pull token stake (skipped if already max)
   *   3. claim           — claimSlot(bountyId) (skipped if already claimed)
   *   4. submit          — submitDeliverable(bountyId, ...)
   *   5. done            — terminal event with the final submit tx hash
   */
  async runWorkerLoop(opts: {
    bountyId: bigint;
    /** Deliverable URL: GitHub PR, Gist, IPFS CID, Arweave TX, etc. */
    deliverableUrl?: string;
    deliverableHash?: `0x${string}`;
    /** @deprecated Use deliverableUrl */
    prUrl?: string;
    /** @deprecated Use deliverableHash */
    commitHash?: `0x${string}`;
    metadata?: string;
    onProgress?: WorkerProgressFn;
  }): Promise<{
    identityTx: `0x${string}` | null;
    claimTx: `0x${string}` | null;
    submitTx: `0x${string}`;
  }> {
    const emit = opts.onProgress ?? (() => {});

    emit({ stage: "ensure-identity" });
    const identityRes = await this.ensureIdentity();
    const identityTx = identityRes.minted ? (identityRes.tx ?? null) : null;

    let claimTx: `0x${string}` | null = null;
    try {
      emit({ stage: "approve" });
      claimTx = await this.claimSlotWithApproval(opts.bountyId);
      emit({ stage: "claim", tx: claimTx });
      await this.publicClient.waitForTransactionReceipt({ hash: claimTx });
    } catch (err) {
      if (err instanceof AlreadyClaimedError) {
        emit({ stage: "claim", detail: "already-claimed" });
        claimTx = null;
      } else {
        throwTyped(err, { bountyId: opts.bountyId });
      }
    }

    const url = opts.deliverableUrl ?? opts.prUrl ?? '';
    const hash = opts.deliverableHash ?? opts.commitHash ?? `0x${'0'.repeat(64)}`;
    const submitTx = await this.submitDeliverable(opts.bountyId, {
      deliverableUrl: url,
      deliverableHash: hash as `0x${string}`,
      metadata: opts.metadata,
    });
    emit({ stage: "submit", tx: submitTx });
    await this.publicClient.waitForTransactionReceipt({ hash: submitTx });
    emit({ stage: "done", tx: submitTx });

    return { identityTx, claimTx, submitTx };
  }

  // ─── Poster write API ────────────────────────────────────────────────

  async postBounty(opts: PostBountyOptions): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    return wallet.writeContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'postBounty',
      args: [
        opts.token,
        opts.bountyType ?? 0,
        opts.targetRepoUrl,
        opts.instructionUrl,
        opts.requirementsHash ?? `0x${'0'.repeat(64)}`,
        opts.amount,
        opts.maxSlots,
        opts.stake,
        opts.deadlineSeconds,
        opts.ciRequired,
      ],
      account: wallet.account,
      chain: wallet.chain,
    });
  }

  async postBountyWithApproval(opts: PostBountyOptions): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    await this.ensureAllowance(opts.token, wallet.account.address, opts.amount);
    return this.postBounty(opts);
  }

  /**
   * Post an open bounty (with approval) and return its id parsed from the
   * `BountyPosted` event in the receipt. Prefer this over `postBounty` +
   * `getBountyCount()`: forno load-balances, so a count read right after the
   * post can hit a lagging node and return the pre-post value.
   */
  async postBountyAndGetId(
    opts: PostBountyOptions,
  ): Promise<{ hash: `0x${string}`; bountyId: bigint }> {
    const hash = await this.postBountyWithApproval(opts);
    return { hash, bountyId: await this.bountyIdFromReceipt(hash) };
  }

  async postDirectHire(opts: PostDirectHireOptions): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    return wallet.writeContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'postDirectHire',
      args: [
        opts.token,
        opts.targetWorker,
        opts.bountyType ?? 0,
        opts.targetRepoUrl,
        opts.instructionUrl,
        opts.requirementsHash ?? `0x${'0'.repeat(64)}`,
        opts.amount,
        opts.stake,
        opts.deadlineSeconds,
      ],
      account: wallet.account,
      chain: wallet.chain,
    });
  }

  async postDirectHireWithApproval(opts: PostDirectHireOptions): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    await this.ensureAllowance(opts.token, wallet.account.address, opts.amount);
    return this.postDirectHire(opts);
  }

  /**
   * Post a direct-hire bounty (with approval) and return its id parsed from the
   * `BountyPosted` event in the receipt. Prefer this over `postDirectHire` +
   * `getBountyCount()` — see {@link postBountyAndGetId}.
   */
  async postDirectHireAndGetId(
    opts: PostDirectHireOptions,
  ): Promise<{ hash: `0x${string}`; bountyId: bigint }> {
    const hash = await this.postDirectHireWithApproval(opts);
    return { hash, bountyId: await this.bountyIdFromReceipt(hash) };
  }

  async pickWinner(bountyId: bigint, winner: Address): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    return wallet.writeContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'pickWinner',
      args: [bountyId, winner],
      account: wallet.account,
      chain: wallet.chain,
    });
  }

  /**
   * Resolve a bounty AND reward the winner's ERC-8004 reputation in one call:
   * `pickWinner` then `giveFeedback` about the winner's agent. The Core never
   * touches the Reputation registry, so this is how reputation accrues per
   * resolved bounty. Pass `agentId` to skip the (log-scanning) `agentIdOf`
   * lookup. Returns `feedbackTx: null` if the winner has no resolvable agent id.
   */
  async pickWinnerAndReward(
    bountyId: bigint,
    winner: Address,
    opts?: {
      agentId?: bigint;
      feedback?: Parameters<ClaudelanceClient['giveFeedback']>[1];
    },
  ): Promise<{ pickTx: `0x${string}`; feedbackTx: `0x${string}` | null }> {
    const pickTx = await this.pickWinner(bountyId, winner);
    await this.publicClient.waitForTransactionReceipt({ hash: pickTx });
    const agentId = opts?.agentId ?? (await this.agentIdOf(winner));
    if (agentId === null) return { pickTx, feedbackTx: null };
    const feedbackTx = await this.giveFeedback(agentId, opts?.feedback);
    return { pickTx, feedbackTx };
  }

  async cancelExpired(bountyId: bigint): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    return wallet.writeContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'cancelExpired',
      args: [bountyId],
      account: wallet.account,
      chain: wallet.chain,
    });
  }

  // ─── Relayer write API ───────────────────────────────────────────────

  /**
   * Attest a worker's CI result on-chain. Only callable by the configured
   * `ciRelayer`. For a `ciRequired` bounty, `pickWinner` reverts unless the
   * chosen worker has a passing attestation (`attestCI(..., true)`).
   */
  async attestCI(bountyId: bigint, worker: Address, passed: boolean): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    return wallet.writeContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'attestCI',
      args: [bountyId, worker, passed],
      account: wallet.account,
      chain: wallet.chain,
    });
  }

  // ─── v3 read API ─────────────────────────────────────────────────────

  /**
   * Extended stats with per-task-type resolved counts (v3 only).
   * Returns the same 5 fields as `getStats` plus `countByType[11]`.
   */
  async getStatsV3(token: Address): Promise<{
    volume: bigint;
    revenue: bigint;
    resolved: bigint;
    posters: bigint;
    workers: bigint;
    countByType: readonly bigint[];
  }> {
    const [volume, revenue, resolved, posters, workers, countByType] =
      (await this.publicClient.readContract({
        address: this.core,
        abi: CLAUDELANCE_CORE_V3_ABI,
        functionName: 'getStatsV3',
        args: [token],
      })) as readonly [bigint, bigint, bigint, bigint, bigint, readonly bigint[]];
    return { volume, revenue, resolved, posters, workers, countByType };
  }

  /** All workers who have claimed a slot on a bounty (v3). */
  async getClaimers(bountyId: bigint): Promise<Address[]> {
    return (await this.publicClient.readContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'getClaimers',
      args: [bountyId],
    })) as Address[];
  }

  /**
   * Workers with a submitted deliverable that is eligible for `pickWinner`
   * (submitted, and CI passed if `ciRequired`) (v3).
   */
  async getEligibleSubmissions(bountyId: bigint): Promise<Address[]> {
    return (await this.publicClient.readContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'getEligibleSubmissions',
      args: [bountyId],
    })) as Address[];
  }

  /** On-chain configuration for a task type (v3). */
  async getTaskTypeConfig(typeId: number): Promise<TypeConfig> {
    return (await this.publicClient.readContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'getTaskTypeConfig',
      args: [typeId],
    })) as TypeConfig;
  }

  /**
   * Register or update a task type configuration (v3, owner-only).
   * Types 0–10 are pre-configured at deploy; use this to enable custom types or
   * adjust `disclaimerRequired` / `ciSupported` flags.
   */
  async configureTaskType(typeId: number, config: TypeConfig): Promise<`0x${string}`> {
    const wallet = this.requireWalletClient();
    return wallet.writeContract({
      address: this.core,
      abi: CLAUDELANCE_CORE_V3_ABI,
      functionName: 'configureTaskType',
      args: [typeId, config],
      account: wallet.account,
      chain: wallet.chain,
    });
  }

  /**
   * Total bounty count (v3 proxy, binary-search approach).
   * v3 does not expose bountyCount as a public getter (EIP-7201 namespaced storage).
   * This scans geometrically then binary-searches for the highest valid ID.
   * Result is approximate if bounties are cancelled (IDs are never reused).
   */
  async getBountyCountV3(): Promise<bigint> {
    const isValid = async (id: bigint): Promise<boolean> => {
      const b = await this.getBounty(id);
      return (b as { poster: string }).poster !== ZERO_ADDRESS;
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

  // ─── Internal helpers ────────────────────────────────────────────────

  /**
   * Reads `allowance(owner, core)` for the given token and submits an
   * `approve(core, amount)` tx if the allowance is short. Awaits the
   * receipt so callers can safely chain a write.
   */
  protected async ensureAllowance(token: Address, owner: Address, needed: bigint): Promise<void> {
    const wallet = this.requireWalletClient();
    const allowance = (await this.publicClient.readContract({
      address: token,
      abi: CUSD_ABI,
      functionName: 'allowance',
      args: [owner, this.core],
    })) as bigint;
    if (allowance >= needed) return;
    // Approve 10× the immediate need so repeated bounty claims/posts don't each
    // require a separate approve transaction.
    const hash = await wallet.writeContract({
      address: token,
      abi: CUSD_ABI,
      functionName: 'approve',
      args: [this.core, needed * 10n],
      account: wallet.account,
      chain: wallet.chain,
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
  }

  /**
   * @internal Wait for a post tx and pull the new bounty id out of the
   * `BountyPosted` event — reliable regardless of read-replica lag.
   */
  protected async bountyIdFromReceipt(hash: `0x${string}`): Promise<bigint> {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    const events = parseEventLogs({
      abi: CLAUDELANCE_CORE_V3_ABI,
      eventName: 'BountyPosted',
      logs: receipt.logs,
    });
    const bountyId = (events[0] as { args?: { bountyId?: bigint } } | undefined)?.args?.bountyId;
    if (bountyId === undefined) {
      throw new Error('[ClaudelanceClient] no BountyPosted event in post receipt');
    }
    return bountyId;
  }

  /** @internal */
  protected requireAccount(): Address {
    const acct = this.walletClient?.account?.address;
    if (!acct) {
      throw new Error(
        '[ClaudelanceClient] No wallet client wired up — use fromPrivateKey() ' +
          'or pass a walletClient to the constructor.'
      );
    }
    return acct;
  }

  /** @internal */
  protected requireWalletClient(): WalletClient<Transport, Chain, Account> {
    if (!this.walletClient) {
      throw new Error(
        '[ClaudelanceClient] Write methods require a wallet client — use ' +
          'fromPrivateKey() or pass a walletClient to the constructor.'
      );
    }
    return this.walletClient;
  }
}

const ERC721_BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

const IDENTITY_REGISTRY_REGISTER_ABI = [
  {
    type: 'function',
    name: 'register',
    inputs: [],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

const IDENTITY_TRANSFER_EVENT = {
  type: 'event',
  name: 'Transfer',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ],
} as const;

const REPUTATION_ABI = [
  {
    type: 'function',
    name: 'giveFeedback',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getClients',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getSummary',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clients', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'score', type: 'int128' },
      { name: 'avg', type: 'uint8' },
    ],
  },
] as const;
