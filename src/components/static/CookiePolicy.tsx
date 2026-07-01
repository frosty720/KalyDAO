import React from "react";
import StaticPage from "./StaticPage";

const CookiePolicy = () => (
  <StaticPage title="Cookie Policy" subtitle="Last updated: June 2026">
    <p>
      This Cookie Policy explains how the KalyChain DAO governance interface (the
      &quot;Interface&quot;) uses cookies and similar local-storage technologies.
    </p>

    <h2>What we use</h2>
    <ul>
      <li>
        <strong>Strictly necessary storage.</strong> The Interface uses browser local storage to
        remember basic preferences and your wallet connection state so the app works correctly.
      </li>
      <li>
        <strong>Wallet &amp; library storage.</strong> Wallet connectors and web3 libraries may
        store connection data locally so you don&apos;t have to reconnect on every visit.
      </li>
    </ul>

    <h2>What we avoid</h2>
    <ul>
      <li>We do not use advertising cookies.</li>
      <li>We do not use cross-site tracking cookies to profile you.</li>
    </ul>

    <h2>Managing storage</h2>
    <p>
      You can clear cookies and local storage at any time through your browser settings. Doing so
      may sign out your wallet connection and reset local preferences, but it will not affect any
      data already recorded on the blockchain.
    </p>

    <h2>Third parties</h2>
    <p>
      Some third-party services used by the Interface (such as wallet providers and
      infrastructure) may set their own storage governed by their respective policies.
    </p>
  </StaticPage>
);

export default CookiePolicy;
