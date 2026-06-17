/**
 * Pending admin rotation (treasury or CI relayer).
 *
 * Returned by `pendingTreasury()` and `pendingCIRelayer()`. After the
 * 2-day `ADMIN_TIMELOCK` elapses, anyone may call `applyTreasury()` /
 * `applyCIRelayer()` to finalize - provided the 14-day
 * `PROPOSAL_VALIDITY_WINDOW` has not expired.
 *
 * When no proposal is pending, `proposed == zeroAddress` and
 * `effectiveAt == 0n`.
 */
export type PendingAddress = {
  proposed: `0x${string}`;
  effectiveAt: bigint;
};
