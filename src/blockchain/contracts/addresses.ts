/**
 * KalyChain 3890 DAO contracts (deployed 2026-08-21, dao-contracts/deployments/kmt).
 * Mirrors kalychain-ops/files/kmt-3890/addresses.json `.dao` — addresses.test.ts asserts it.
 *
 * NOTE: there is NO TreasuryVault on 3890. TREASURY is the relaunch Treasury
 * (Treasury.sol: execute / sendNative / sendERC20 / transferERC721, onlyOwner). Its owner is
 * the deployer until the post-migration handoff to the Timelock — until then, proposals that
 * target it pass the vote but revert at execute().
 */
export const CONTRACT_ADDRESSES = {
  GOVERNANCE_TOKEN: '0xf05c285340FC6DE9fC1a8F225b553DF21f47aFA8', // gKMT
  GOVERNOR_CONTRACT: '0xf889D405710b7746A48f177506d621ed37f65F65',
  TIMELOCK: '0xBD2d65Bfddbd220572121F9D2042006e21181dA5',
  TREASURY: '0xDF8CFefEa7DaA5E5B23c262A461aCcA6356BCA90',
  DAO_SETTINGS: '0x07272a62e1C80dB9b74f551693e23749DB2EDaD1',
} as const;

/** Deploy block of the Governor (dao-contracts/deployments/kmt/GovernorContract.json). */
export const GOVERNOR_DEPLOY_BLOCK = 7276n;
