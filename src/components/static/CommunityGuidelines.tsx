import React from "react";
import StaticPage from "./StaticPage";

const CommunityGuidelines = () => (
  <StaticPage
    title="Community Guidelines"
    subtitle="Last updated: June 2026"
  >
    <p>
      The KalyChain DAO is a community-governed project. These guidelines exist to keep our
      governance process constructive, transparent, and welcoming to everyone who participates.
    </p>

    <h2>Be respectful</h2>
    <ul>
      <li>Engage with ideas, not individuals. Critique proposals, not people.</li>
      <li>No harassment, hate speech, personal attacks, or discrimination of any kind.</li>
      <li>Assume good faith. Members come from many backgrounds and time zones.</li>
    </ul>

    <h2>Govern in good faith</h2>
    <ul>
      <li>Vote and propose with the long-term health of the ecosystem in mind.</li>
      <li>Disclose conflicts of interest that may affect a proposal you support or oppose.</li>
      <li>Do not attempt to manipulate votes through misinformation or vote-buying.</li>
    </ul>

    <h2>Keep it productive</h2>
    <ul>
      <li>Write clear, well-scoped proposals with a stated rationale and expected outcome.</li>
      <li>Use the official channels for discussion before, during, and after a vote.</li>
      <li>No spam, off-topic promotion, or scams. Never share private keys or seed phrases.</li>
    </ul>

    <h2>Security</h2>
    <ul>
      <li>Always verify you are on the official site and connected to the correct network.</li>
      <li>The DAO and its contributors will never DM you asking for funds or credentials.</li>
      <li>Report suspected vulnerabilities or abuse responsibly through community channels.</li>
    </ul>

    <p>
      Participation in DAO governance is a privilege that depends on a healthy community.
      Members who repeatedly violate these guidelines may be excluded from official community
      spaces.
    </p>
  </StaticPage>
);

export default CommunityGuidelines;
