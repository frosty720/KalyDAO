import { useCallback, useMemo } from 'react';
import { useChainId, useAccount } from 'wagmi';
import GovernanceTokenABI from '../abis/GovernanceToken.json';
import GovernorContractABI from '../abis/GovernorContract.json';
import TimeLockABI from '../abis/TimeLock.json';
import TreasuryVaultABI from '../abis/TreasuryVault.json';
import { CONTRACT_ADDRESSES_BY_NETWORK } from '../contracts/addresses';
import { getTransactionGasConfig } from '../config/transaction';

export function useDao() {
  const chainId = useChainId();
  const { address } = useAccount();
  
  const contracts = useMemo(() => {
    // Get the appropriate network addresses based on chainId
    const addresses = chainId === 3889 
      ? CONTRACT_ADDRESSES_BY_NETWORK.testnet
      : CONTRACT_ADDRESSES_BY_NETWORK.mainnet;
    
    return {
      governanceToken: {
        address: addresses.GOVERNANCE_TOKEN,
        abi: GovernanceTokenABI.abi || GovernanceTokenABI
      },
      governor: {
        address: addresses.GOVERNOR_CONTRACT,
        abi: GovernorContractABI.abi || GovernorContractABI
      },
      timelock: {
        address: addresses.TIMELOCK,
        abi: TimeLockABI.abi || TimeLockABI
      },
      treasury: {
        address: addresses.TREASURY_VAULT,
        abi: TreasuryVaultABI.abi || TreasuryVaultABI
      }
    };
  }, [chainId]);

  const vote = useCallback(async (
    proposalId: bigint,
    support: number, // 0 = Against, 1 = For, 2 = Abstain
    reason: string,
    writeContractFn: any
  ) => {
    if (!writeContractFn || !address) throw new Error('Write function or address not available');
    console.log('[useDao] Inside vote function. Preparing to call writeContractFn...');
    
    const gasConfig = getTransactionGasConfig();
    
    const config = {
      address: contracts.governor.address as `0x${string}`,
      abi: contracts.governor.abi,
      functionName: 'castVoteWithReason',
      args: [proposalId, support, reason],
      ...gasConfig
    };

    console.log('[useDao] Config for writeContractFn:', config);

    return writeContractFn({
      ...config
    });
  }, [contracts.governor, address]);

  const delegate = useCallback(async (
    delegatee: `0x${string}`,
    writeContractFn: any
  ) => {
    if (!writeContractFn || !address) throw new Error('Write function or address not available');
    
    const gasConfig = getTransactionGasConfig();
    
    return writeContractFn({
      address: contracts.governanceToken.address as `0x${string}`,
      abi: contracts.governanceToken.abi,
      functionName: 'delegate',
      args: [delegatee],
      ...gasConfig
    });
  }, [contracts.governanceToken, address]);

  return {
    contracts,
    vote,
    delegate
  };
}