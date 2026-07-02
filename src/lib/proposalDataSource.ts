// Decides where a proposal's live data (votes, quorum, state, blocks, eta) is read
// from: the DAO subgraph (mainnet, fast, one query) or direct on-chain reads.
//
// The bug this fixes (audit H1): mainnet gated EVERY on-chain read on
// `enabled: !hasDaoSubgraph`, so when the subgraph was unreachable the proposal page
// had no fallback — an Active proposal rendered "ended", 0/0/0 votes, and no
// vote/queue/execute controls, with no error. This helper detects that the subgraph
// responded with no usable data and flips the page onto on-chain reads instead.
//
// Pure and synchronous so it can be unit-tested without wagmi/react-query.

export interface ProposalDataSourceInputs {
	/** A subgraph URL is configured for this chain (true on mainnet, false on testnet). */
	hasDaoSubgraph: boolean;
	/** The subgraph query has settled at least once (react-query data !== undefined). */
	subgraphResponded: boolean;
	/** That response contained a usable proposal detail (sgData.detail was non-null). */
	hasSubgraphDetail: boolean;
}

export interface ProposalDataSource {
	/** Read votes/quorum/state/blocks/eta from on-chain contract reads. */
	useOnChainReads: boolean;
	/** Subgraph is configured but returned no usable data — we are in fallback mode. */
	subgraphUnavailable: boolean;
}

/**
 * - No subgraph configured (testnet): always on-chain.
 * - Subgraph configured but hasn't responded yet: wait (neither, page shows loading)
 *   so we don't hammer the RPC on every first paint.
 * - Subgraph responded with no detail (down / GraphQL error / not indexed): fall back
 *   to on-chain and flag it so the UI can warn.
 * - Subgraph responded with detail: use it (the fast path).
 */
export function resolveProposalDataSource(
	inputs: ProposalDataSourceInputs,
): ProposalDataSource {
	if (!inputs.hasDaoSubgraph) {
		return { useOnChainReads: true, subgraphUnavailable: false };
	}
	if (!inputs.subgraphResponded) {
		return { useOnChainReads: false, subgraphUnavailable: false };
	}
	if (!inputs.hasSubgraphDetail) {
		return { useOnChainReads: true, subgraphUnavailable: true };
	}
	return { useOnChainReads: false, subgraphUnavailable: false };
}
