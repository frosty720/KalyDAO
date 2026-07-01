import React from "react";
import StaticPage from "./StaticPage";

const PrivacyPolicy = () => (
  <StaticPage title="Privacy Policy" subtitle="Last updated: June 2026">
    <p>
      This Privacy Policy explains how the KalyChain DAO governance interface (the
      &quot;Interface&quot;) handles information. The Interface is designed to be
      privacy-preserving and non-custodial.
    </p>

    <h2>Information we do not collect</h2>
    <ul>
      <li>We do not require accounts, names, emails, or passwords to use the Interface.</li>
      <li>We never have access to your private keys, seed phrase, or funds.</li>
      <li>We do not sell personal data.</li>
    </ul>

    <h2>Information involved in using the Interface</h2>
    <ul>
      <li>
        <strong>Public blockchain data.</strong> Your wallet address, votes, proposals, and
        delegations are recorded on the public KalyChain blockchain. This data is inherently
        public and is not controlled by us.
      </li>
      <li>
        <strong>Wallet connection.</strong> When you connect a wallet, the Interface reads your
        public address and on-chain balances to display relevant information.
      </li>
      <li>
        <strong>Proposal metadata.</strong> Titles, descriptions, and discussion content you
        submit are stored to display proposals. Treat anything you publish as public.
      </li>
      <li>
        <strong>Basic technical data.</strong> Like most web apps, infrastructure providers may
        process technical information (such as IP address and request logs) to serve the site.
      </li>
    </ul>

    <h2>Third-party services</h2>
    <p>
      The Interface relies on third parties such as RPC/blockchain nodes, indexing services, and
      wallet providers. Their handling of data is governed by their own privacy policies.
    </p>

    <h2>Your control</h2>
    <p>
      You can stop using the Interface and disconnect your wallet at any time. Note that data
      already written to the blockchain is permanent and cannot be deleted by us or anyone else.
    </p>

    <h2>Changes</h2>
    <p>We may update this Privacy Policy from time to time; the &quot;last updated&quot; date reflects the latest revision.</p>
  </StaticPage>
);

export default PrivacyPolicy;
