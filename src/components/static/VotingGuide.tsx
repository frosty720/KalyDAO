import React from "react";
import { Link } from "react-router-dom";
import { Camera } from "lucide-react";
import StaticPage from "./StaticPage";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/** Visual timeline of a proposal's life, centered on the snapshot moment.
 *  Widths reflect mainnet's current parameters: ~7 day voting delay (get-ready
 *  window) followed by ~14 days of voting — a 1:2 ratio. */
const SnapshotTimeline = () => (
  <div className="rounded-lg border border-border bg-secondary p-5 my-6">
    <div className="flex items-center gap-2 mb-5 text-sm font-semibold text-foreground">
      <Camera className="h-4 w-4 text-amber-400" />
      Proposal timeline — when your voting power is locked in
    </div>

    {/* The bar: get-ready window (1/3) then voting window (2/3) */}
    <div className="relative">
      <div className="flex h-2.5 rounded-full overflow-hidden">
        <div className="w-1/3 bg-emerald-500/70" />
        <div className="w-2/3 bg-amber-400/80" />
      </div>
      {/* Markers: submitted / snapshot / end */}
      <div className="absolute -top-1 left-0 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-background bg-emerald-500" />
      <div className="absolute -top-1 left-1/3 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-background bg-amber-400" />
      <div className="absolute -top-1 right-0 h-4 w-4 translate-x-1/2 rounded-full border-2 border-background bg-muted-foreground" />
    </div>

    {/* Labels under the markers */}
    <div className="flex text-xs mt-3">
      <div className="w-1/3 pr-2">
        <div className="font-semibold text-emerald-400">Proposal submitted</div>
        <div className="text-muted-foreground mt-1">
          Get-ready window (~7 days on mainnet): wrap KLC and delegate{" "}
          <strong className="text-foreground">now</strong> if you haven't — there is still
          time for this proposal.
        </div>
      </div>
      <div className="w-1/3 px-2">
        <div className="font-semibold text-amber-400 flex items-center gap-1">
          <Camera className="h-3.5 w-3.5" /> Snapshot — voting starts
        </div>
        <div className="text-muted-foreground mt-1">
          Everyone's delegated gKLC is recorded at this block. Power gained after this
          moment counts <strong className="text-foreground">0</strong> for this proposal.
        </div>
      </div>
      <div className="w-1/3 pl-2 text-right">
        <div className="font-semibold text-foreground">Voting ends</div>
        <div className="text-muted-foreground mt-1">
          ~14 days of voting on mainnet. Result is final at the last block.
        </div>
      </div>
    </div>
  </div>
);

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
      <strong>delegated</strong>. The simplest option is to delegate to yourself. You only do
      this once: delegation stays active for every future proposal automatically.
    </p>
    <ul>
      <li>Open the <Link to="/delegation">Delegation</Link> page.</li>
      <li>Delegate your voting power to your own address (or to a delegate you trust).</li>
    </ul>

    <h2>3. Understand the snapshot — when your power is counted</h2>
    <p>
      Every proposal takes a <strong>snapshot</strong> of everyone's delegated gKLC at the
      block where voting starts. Your vote is weighed with your power{" "}
      <em>at that exact moment</em> — not when you cast the vote. This is a core security
      feature of the governance contract (the same rule used by Uniswap, ENS, and Compound):
      it makes it impossible to buy tokens mid-vote to swing a decision.
    </p>

    <SnapshotTimeline />

    <p>
      The golden rule: <strong>wrap and delegate the day you join the DAO, not the day you
      want to vote.</strong> If you are already delegated, every proposal snapshots your
      power automatically and you never think about this again.
    </p>

    <h2>4. Find an active proposal</h2>
    <ul>
      <li>Browse <Link to="/proposals">All Proposals</Link>.</li>
      <li>Open a proposal with an <strong>Active</strong> status — only active proposals accept votes.</li>
      <li>Read the summary, full description, and the on-chain actions it would execute.</li>
    </ul>

    <h2>5. Cast your vote</h2>
    <ul>
      <li>Choose <strong>For</strong>, <strong>Against</strong>, or <strong>Abstain</strong>.</li>
      <li>Optionally add a short reason — it is recorded on-chain with your vote.</li>
      <li>Confirm the transaction in your wallet. Each address can vote once per proposal.</li>
    </ul>
    <p>
      The proposal page shows <strong>your voting power for this proposal</strong> — the
      snapshot amount the contract will actually count. Make sure your wallet is connected to
      the same network the proposal lives on (KalyChain Mainnet for live governance); the
      page will tell you if you need to switch.
    </p>

    <h2>6. What happens after voting</h2>
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

    <h2>Frequently asked questions</h2>
    <Accordion type="single" collapsible className="w-full mb-4">
      <AccordionItem value="power-zero">
        <AccordionTrigger className="text-left">
          I hold gKLC — why does a proposal say my voting power is 0?
        </AccordionTrigger>
        <AccordionContent>
          Your gKLC was wrapped or delegated <strong>after</strong> that proposal's snapshot,
          so it cannot count there. It is not lost: your power automatically counts on every
          proposal created from now on. If you have never delegated at all, do that first on
          the <Link to="/delegation">Delegation</Link> page — undelegated gKLC always has 0
          voting power, on every proposal.
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="wrap-after-submit">
        <AccordionTrigger className="text-left">
          A proposal was just submitted. Is it too late for me to get voting power for it?
        </AccordionTrigger>
        <AccordionContent>
          Not yet. There is a <strong>get-ready window</strong> between submission and the
          start of voting (currently about 7 days on mainnet). If you wrap and delegate before
          voting starts, your power counts for that proposal. Once the proposal shows{" "}
          <strong>Active</strong>, the snapshot has been taken and it is too late for that one
          — but you are ready for every proposal after it.
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="redelegate">
        <AccordionTrigger className="text-left">
          Do I need to delegate again for every proposal?
        </AccordionTrigger>
        <AccordionContent>
          No. Delegation is one-time and stays active until you change it. Topping up your
          gKLC later also just works — new tokens are added to your delegated power the moment
          you receive them, and count on every proposal created after that.
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="unwrapped">
        <AccordionTrigger className="text-left">
          I unwrapped my gKLC after a proposal's snapshot. Can I still vote on it?
        </AccordionTrigger>
        <AccordionContent>
          Yes. Your power at the snapshot is what counts, even if you have since moved or
          unwrapped the tokens. The proposal page will show your snapshot power and let you
          vote with it.
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="more-power-mid-vote">
        <AccordionTrigger className="text-left">
          If I wrap more gKLC while voting is open, does my vote get bigger?
        </AccordionTrigger>
        <AccordionContent>
          No — for the current proposal your weight is fixed at the snapshot amount. The extra
          tokens count on all future proposals. This is deliberate: it prevents anyone from
          buying a large position mid-vote to flip the outcome.
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="quorum">
        <AccordionTrigger className="text-left">
          What counts toward quorum?
        </AccordionTrigger>
        <AccordionContent>
          <strong>For</strong> and <strong>Abstain</strong> votes count toward quorum;{" "}
          <strong>Against</strong> votes do not. Quorum is a percentage of the total gKLC
          supply measured at the proposal's snapshot, so abstaining is still a meaningful way
          to help a proposal reach a valid result without supporting it.
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <h2>Tips</h2>
    <ul>
      <li>Want to create your own proposal? See <Link to="/create-proposal">Create Proposal</Link>.</li>
      <li>Voting windows are set by governance and can change — the proposal page always shows the live block countdowns.</li>
    </ul>
  </StaticPage>
);

export default VotingGuide;
