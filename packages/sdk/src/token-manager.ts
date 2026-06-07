import {
  type Address,
  type PublicClient,
} from 'viem';
import type { TokenSet } from '@yeheskieltame/claudelance-types';
import { CUSD_ABI } from './cusd-abi.js';

const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export type TokenKey = 'cUSD' | 'CELO' | 'USDC';

export type TokenAmounts = Record<TokenKey, bigint>;

export type TokenState = {
  /** ERC20 wallet balance for each whitelisted token. */
  balances: TokenAmounts;
  /** ERC20 allowance granted to the core contract for each token. */
  allowances: TokenAmounts;
  /** Per-token minimum bounty amounts (from on-chain minBounty mapping). */
  minBounties: TokenAmounts;
  /** Timestamp (ms) when this snapshot was taken. */
  fetchedAt: number;
};

export type TokenManagerOptions = {
  publicClient: PublicClient;
  core: Address;
  tokens: TokenSet;
  /**
   * Starting block for `TokenAllowed`/`MinBountyUpdated` event scans.
   * Defaults to 68_143_824 (Celo mainnet Claudelance v2 deploy block).
   * Set to 0n for Sepolia or custom deployments.
   */
  deployBlock?: bigint;
};

// v3 mainnet proxy deployed at block 68,536,240 (2026-06-04).
// v2 mainnet deployed at block 68,143,824 (2026-05-14).
// Use v2 deploy block as the safe lower bound: no allowToken events exist before it.
const CLAUDELANCE_MAINNET_DEPLOY_BLOCK = 68_143_824n;
const CLAUDELANCE_SEPOLIA_DEPLOY_BLOCK = 0n; // Sepolia block numbers differ; scan all.

const TOKEN_ALLOWED_ABI = [
  {
    type: 'event',
    name: 'TokenAllowed',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'minBounty', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MinBountyUpdated',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'minBounty', type: 'uint256', indexed: false },
    ],
  },
] as const;

/**
 * Batches all token reads into the fewest multicall round-trips.
 *
 * Without it: 9 RPC calls for 3 tokens (balance, allowance, minBounty each).
 * With it: 1 multicall for balances + allowances (6 calls); minBounties come
 * from a cached event-log scan, since they only change on admin action.
 *
 * Usage:
 *   const tm = new TokenManager({ publicClient, core, tokens })
 *   const state = await tm.getTokenState(walletAddress)
 */
export class TokenManager {
  readonly publicClient: PublicClient;
  readonly core: Address;
  readonly tokens: TokenSet;
  readonly deployBlock: bigint;

  // minBounties are admin-set and rarely change; cache with 10-min TTL.
  private _minBountyCache: { amounts: TokenAmounts; fetchedAt: number } | null = null;
  private readonly MIN_BOUNTY_TTL_MS = 10 * 60 * 1000;

  constructor(opts: TokenManagerOptions) {
    this.publicClient = opts.publicClient;
    this.core = opts.core;
    this.tokens = opts.tokens;
    this.deployBlock = opts.deployBlock ?? CLAUDELANCE_MAINNET_DEPLOY_BLOCK;
  }

  private get tokenEntries(): Array<[TokenKey, Address]> {
    return [
      ['cUSD', this.tokens.cUSD],
      ['CELO', this.tokens.CELO],
      ['USDC', this.tokens.USDC],
    ];
  }

  /**
   * Batch-read balances for all three whitelisted tokens in one multicall.
   */
  async getBalances(account: Address): Promise<TokenAmounts> {
    const entries = this.tokenEntries;
    const results = await this.publicClient.multicall({
      contracts: entries.map(([, addr]) => ({
        address: addr,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf' as const,
        args: [account] as const,
      })),
      allowFailure: false,
    });
    return Object.fromEntries(
      entries.map(([key], i) => [key, results[i] as bigint]),
    ) as TokenAmounts;
  }

  /**
   * Batch-read allowances granted to `spender` (typically the core contract) in one multicall.
   */
  async getAllowances(owner: Address, spender: Address = this.core): Promise<TokenAmounts> {
    const entries = this.tokenEntries;
    const results = await this.publicClient.multicall({
      contracts: entries.map(([, addr]) => ({
        address: addr,
        abi: ERC20_BALANCE_ABI,
        functionName: 'allowance' as const,
        args: [owner, spender] as const,
      })),
      allowFailure: false,
    });
    return Object.fromEntries(
      entries.map(([key], i) => [key, results[i] as bigint]),
    ) as TokenAmounts;
  }

  /**
   * Returns per-token minBounty amounts. Results are cached for 10 minutes
   * since these values only change via admin `allowToken`/`setMinBounty` calls.
   *
   * Reads from the most-recent TokenAllowed or MinBountyUpdated event per token.
   * Falls back to 0n for any token not yet seen in the event log.
   */
  async getMinBounties(opts?: { bypassCache?: boolean }): Promise<TokenAmounts> {
    const now = Date.now();
    if (
      !opts?.bypassCache &&
      this._minBountyCache &&
      now - this._minBountyCache.fetchedAt < this.MIN_BOUNTY_TTL_MS
    ) {
      return this._minBountyCache.amounts;
    }

    const amounts: TokenAmounts = { cUSD: 0n, CELO: 0n, USDC: 0n };

    for (const [key, tokenAddr] of this.tokenEntries) {
      // Fetch TokenAllowed and MinBountyUpdated in parallel for this token.
      const [allowedLogs, updatedLogs] = await Promise.all([
        this.publicClient.getLogs({
          address: this.core,
          event: TOKEN_ALLOWED_ABI[0],
          args: { token: tokenAddr },
          fromBlock: this.deployBlock,
        }).catch(() => []),
        this.publicClient.getLogs({
          address: this.core,
          event: TOKEN_ALLOWED_ABI[1],
          args: { token: tokenAddr },
          fromBlock: this.deployBlock,
        }).catch(() => []),
      ]);

      const allLogs = [...allowedLogs, ...updatedLogs].sort((a, b) => {
        const bn = (a.blockNumber ?? 0n) - (b.blockNumber ?? 0n);
        if (bn !== 0n) return bn > 0n ? 1 : -1;
        return (Number(a.logIndex ?? 0)) - (Number(b.logIndex ?? 0));
      });

      const last = allLogs[allLogs.length - 1];
      if (last) {
        amounts[key] = (last.args as { minBounty?: bigint }).minBounty ?? 0n;
      }
    }

    this._minBountyCache = { amounts, fetchedAt: now };
    return amounts;
  }

  /**
   * Full token state snapshot in two multicall round-trips:
   *   1. balances + allowances (1 multicall, 6 calls)
   *   2. minBounties (from cached event log scan, rarely needs a fresh fetch)
   *
   * Replaces 9+ individual RPC calls with 1 to 2 batched calls.
   */
  async getTokenState(account: Address): Promise<TokenState> {
    const [balances, allowances, minBounties] = await Promise.all([
      this.getBalances(account),
      this.getAllowances(account),
      this.getMinBounties(),
    ]);
    return { balances, allowances, minBounties, fetchedAt: Date.now() };
  }

  /**
   * Check whether `account` has sufficient balance AND allowance to claim
   * a bounty that requires `amount` + `stake` of `token`.
   */
  checkSufficientFunds(
    state: TokenState,
    tokenKey: TokenKey,
    amount: bigint,
    stake: bigint,
  ): { hasBalance: boolean; hasAllowance: boolean; shortfall: bigint } {
    const needed = amount + stake;
    const balance = state.balances[tokenKey];
    const allowance = state.allowances[tokenKey];
    return {
      hasBalance: balance >= needed,
      hasAllowance: allowance >= stake,
      shortfall: balance < needed ? needed - balance : 0n,
    };
  }

  /** Invalidate the minBounty cache (call after an admin setMinBounty tx is mined). */
  invalidateMinBountyCache(): void {
    this._minBountyCache = null;
  }

  /** Convenience: look up the token key for a given token address. */
  tokenKeyOf(address: Address): TokenKey | undefined {
    const lower = address.toLowerCase();
    for (const [key, addr] of this.tokenEntries) {
      if (addr.toLowerCase() === lower) return key;
    }
    return undefined;
  }
}

