import React from "react";
import StaticPage from "./StaticPage";

const TermsOfService = () => (
  <StaticPage title="Terms of Service" subtitle="Last updated: June 2026">
    <p>
      These Terms of Service (&quot;Terms&quot;) govern your access to and use of the KalyChain
      DAO governance interface (the &quot;Interface&quot;). By accessing or using the Interface,
      you agree to these Terms. If you do not agree, do not use the Interface.
    </p>

    <h2>1. The Interface is non-custodial</h2>
    <p>
      The Interface is a front-end that lets you interact with public smart contracts on
      KalyChain. We never take custody of your tokens, your private keys, or your funds. All
      transactions are initiated by you and signed in your own wallet.
    </p>

    <h2>2. No financial advice</h2>
    <p>
      Nothing on the Interface constitutes financial, investment, legal, or tax advice.
      Governance tokens and on-chain voting carry risk. You are solely responsible for your
      decisions and for understanding the proposals you vote on or create.
    </p>

    <h2>3. On-chain actions are final</h2>
    <p>
      Blockchain transactions are irreversible. Once submitted and confirmed, votes, proposals,
      delegations, and token operations cannot be undone by us. Verify all details before
      signing.
    </p>

    <h2>4. Decentralized governance</h2>
    <p>
      Proposals that reach quorum and pass are executed by autonomous smart contracts (subject
      to a timelock). We do not control the outcome of governance and are not responsible for
      decisions made by the DAO.
    </p>

    <h2>5. No warranty</h2>
    <p>
      The Interface is provided &quot;as is&quot; and &quot;as available&quot;, without
      warranties of any kind. We do not guarantee that the Interface will be uninterrupted,
      error-free, or secure, or that on-chain data displayed is complete or accurate.
    </p>

    <h2>6. Limitation of liability</h2>
    <p>
      To the maximum extent permitted by law, the contributors to the Interface shall not be
      liable for any indirect, incidental, or consequential damages, or for any loss of tokens,
      funds, or data arising from your use of the Interface or the underlying smart contracts.
    </p>

    <h2>7. Eligibility &amp; compliance</h2>
    <p>
      You are responsible for ensuring that your use of the Interface complies with the laws and
      regulations applicable to you. Do not use the Interface where doing so would be unlawful.
    </p>

    <h2>8. Changes</h2>
    <p>
      We may update these Terms from time to time. Continued use of the Interface after changes
      take effect constitutes acceptance of the updated Terms.
    </p>
  </StaticPage>
);

export default TermsOfService;
