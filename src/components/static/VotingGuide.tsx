import React from "react";
import { Link } from "react-router-dom";
import StaticPage from "./StaticPage";

/** Step-by-step guide to voting in the KalyChain DAO. Reflects the real flow:
 *  wrap KLC -> gKLC, delegate to activate voting power, then vote on a proposal. */
const VotingGuide = () => (
  <StaticPage
    title="Voting Guide"
    subtitle="How to participate in KalyChain DAO governance — from getting voting power to casting your vote."
  >
    <h2>1. Get governance tokens (gKLC)</h2>
    <p>
      Voting power in the DAO comes from <strong>gKLC</strong> (Governance KLC). You get gKLC
      by wrapping your native KLC at a 1:1 ratio — and you can unwrap back to KLC at any time.
    </p>
    <ul>
      <li>Open the <Link to="/wrap-klc">Wrap KLC</Link> page.</li>
      <li>Enter the amount of KLC to wrap and confirm the transaction in your wallet.</li>
      <li>You now hold gKLC equal to the KLC you wrapped.</li>
    </ul>

    <h2>2. Activate your voting power (delegate)</h2>
    <p>
      Holding gKLC is not enough on its own — voting power only counts once it is{" "}
      <strong>delegated</strong>. The simplest option is to delegate to yourself.
    </p>
    <ul>
      <li>Open the <Link to="/delegation">Delegation</Link> page.</li>
      <li>Delegate your voting power to your own address (or to a delegate you trust).</li>
      <li>
        Important: your voting power is measured by a <em>snapshot</em> taken when a proposal
        is created. Delegate <strong>before</strong> a proposal goes live so your power counts
        for it.
      </li>
    </ul>

    <h2>3. Find an active proposal</h2>
    <ul>
      <li>Browse <Link to="/proposals">All Proposals</Link>.</li>
      <li>Open a proposal with an <strong>Active</strong> status — only active proposals accept votes.</li>
      <li>Read the summary, full description, and the on-chain actions it would execute.</li>
    </ul>

    <h2>4. Cast your vote</h2>
    <ul>
      <li>Choose <strong>For</strong>, <strong>Against</strong>, or <strong>Abstain</strong>.</li>
      <li>Optionally add a short reason — it is recorded on-chain with your vote.</li>
      <li>Confirm the transaction in your wallet. Each address can vote once per proposal.</li>
    </ul>
    <p>
      Make sure your wallet is connected to the same network the proposal lives on (KalyChain
      Mainnet for live governance). The proposal page will tell you if you need to switch.
    </p>

    <h2>5. What happens after voting</h2>
    <p>For a proposal to pass, it must:</p>
    <ul>
      <li>Reach <strong>quorum</strong> — a minimum share of total voting power must participate (For + Abstain count toward quorum).</li>
      <li>Have more <strong>For</strong> than <strong>Against</strong> votes when voting ends.</li>
    </ul>
    <p>
      A passed proposal is then <strong>queued</strong> in the timelock and, after the timelock
      delay, <strong>executed</strong> on-chain. Anyone can trigger the queue and execute steps
      once they are available.
    </p>

    <h2>Tips</h2>
    <ul>
      <li>No voting power? You either haven't wrapped KLC into gKLC, or you haven't delegated yet.</li>
      <li>Power shows 0 on a proposal? You likely delegated after that proposal's snapshot block.</li>
      <li>Want to create your own proposal? See <Link to="/create-proposal">Create Proposal</Link>.</li>
    </ul>
  </StaticPage>
);

export default VotingGuide;
