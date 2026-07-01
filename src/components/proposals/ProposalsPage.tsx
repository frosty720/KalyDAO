import React from "react";
import ProposalsList from "./ProposalsList";

const ProposalsPage = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Governance Proposals
        </h1>
        <p className="text-muted-foreground mt-2">
          Browse, filter, and vote on governance proposals for the KalyChain
          DAO.
        </p>
      </div>
      <ProposalsList />
    </div>
  );
};

export default ProposalsPage;
