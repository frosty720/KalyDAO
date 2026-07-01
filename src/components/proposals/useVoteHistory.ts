import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import {
	getDaoSubgraphUrl,
	queryVoteHistory,
	type VoteHistoryEntry,
} from '@/lib/daoSubgraph';

// OZ Governor VoteCast event (voter indexed; proposalId/support/weight/reason in data).
const VOTE_CAST_EVENT = {
	type: 'event',
	name: 'VoteCast',
	inputs: [
		{ indexed: true, name: 'voter', type: 'address' },
		{ indexed: false, name: 'proposalId', type: 'uint256' },
		{ indexed: false, name: 'support', type: 'uint8' },
		{ indexed: false, name: 'weight', type: 'uint256' },
		{ indexed: false, name: 'reason', type: 'string' },
	],
} as const;

/**
 * Vote history sourced from on-chain `VoteCast` truth — subgraph on mainnet, direct
 * logs on networks without one (testnet). Never reads Supabase, so reverted/ghost
 * votes can never appear. `refreshKey` forces a re-read after a confirmed vote.
 */
export function useVoteHistory(
	proposalId: string | undefined,
	governorAddress: string,
	chainId: number,
	snapshotBlock: bigint | undefined,
	deadlineBlock: bigint | undefined,
	refreshKey: number,
): { votes: VoteHistoryEntry[]; isLoading: boolean } {
	const publicClient = usePublicClient({ chainId });
	const [votes, setVotes] = useState<VoteHistoryEntry[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	useEffect(() => {
		if (!proposalId) return;
		let cancelled = false;

		const load = async () => {
			setIsLoading(true);
			try {
				// Mainnet: one subgraph query.
				const subgraphUrl = getDaoSubgraphUrl(chainId);
				if (subgraphUrl) {
					const history = await queryVoteHistory(subgraphUrl, proposalId);
					if (!cancelled) setVotes(history);
					return;
				}

				// No subgraph (testnet): read VoteCast logs directly. Votes can only occur
				// between the snapshot (voteStart) and deadline (voteEnd), so we scan ONLY
				// that window — never the whole chain (a full-range getLogs times out) — and
				// CHUNK it so we never exceed the RPC's per-request block-range limit.
				if (!publicClient) {
					if (!cancelled) setVotes([]);
					return;
				}
				// Wait for the snapshot before scanning; without it we'd have to scan from
				// 'earliest', which is exactly what timed out.
				if (snapshotBlock == null) {
					if (!cancelled) {
						setVotes([]);
						setIsLoading(false);
					}
					return;
				}

				const latest = await publicClient.getBlockNumber();
				const toBlock = deadlineBlock != null && deadlineBlock < latest ? deadlineBlock : latest;
				const CHUNK = 45_000n; // safe per-request range for the KalyChain RPCs
				const ranges: Array<{ from: bigint; to: bigint }> = [];
				for (let start = snapshotBlock; start <= toBlock; start += CHUNK + 1n) {
					const end = start + CHUNK > toBlock ? toBlock : start + CHUNK;
					ranges.push({ from: start, to: end });
				}
				const chunkResults = await Promise.all(
					ranges.map((r) =>
						publicClient.getLogs({
							address: governorAddress as `0x${string}`,
							event: VOTE_CAST_EVENT,
							fromBlock: r.from,
							toBlock: r.to,
						}),
					),
				);
				if (cancelled) return;
				const logs = chunkResults.flat();
				const mine = logs.filter(
					(l) => l.args.proposalId?.toString() === proposalId,
				);

				// Resolve block timestamps (few votes; one getBlock per unique block).
				const uniqueBlocks = [...new Set(mine.map((l) => l.blockNumber))];
				const tsByBlock = new Map<bigint, number>();
				await Promise.all(
					uniqueBlocks.map(async (bn) => {
						if (bn == null) return;
						const block = await publicClient.getBlock({ blockNumber: bn });
						tsByBlock.set(bn, Number(block.timestamp) * 1000);
					}),
				);

				const mapped: VoteHistoryEntry[] = mine.map((l) => ({
					id: `${l.transactionHash}-${l.logIndex}`,
					voter_address: l.args.voter as string,
					support: Number(l.args.support ?? 0),
					voting_power: Number(l.args.weight ?? 0n) / 1e18,
					reason: (l.args.reason as string) || undefined,
					timestamp: (l.blockNumber != null && tsByBlock.get(l.blockNumber)) || Date.now(),
					transaction_hash: l.transactionHash as string,
				}));
				mapped.sort((a, b) => b.timestamp - a.timestamp);
				if (!cancelled) setVotes(mapped);
			} catch (err) {
				console.error('useVoteHistory: failed to load on-chain vote history', err);
				if (!cancelled) setVotes([]);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		load();
		return () => {
			cancelled = true;
		};
	}, [proposalId, governorAddress, chainId, snapshotBlock, deadlineBlock, refreshKey, publicClient]);

	return { votes, isLoading };
}
