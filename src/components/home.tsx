import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import DaoOverview from "./home/DaoOverview";
import TokenInfo from "./home/TokenInfo";
import ActiveProposalsList from "./proposals/ActiveProposalsList";
import { WalletButton } from '@/components/WalletButton';

const Home = () => {
  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <section className="text-center py-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-amber-300 via-amber-500 to-amber-600 bg-clip-text text-transparent">
              KalyChain DAO
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            A decentralized governance platform for the KalyChain ecosystem.
            Connect your wallet to participate in proposals and shape the future
            of KalyChain.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <WalletButton />
            <Link to="/proposals">
              <Button variant="default" size="lg" className="h-11">
                View Proposals
              </Button>
            </Link>
          </div>
        </section>

        {/* How to participate */}
        <section className="py-6">
          <h2 className="text-2xl font-bold text-foreground text-center mb-6">
            How to participate
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: 1,
                title: "Wrap KLC → gKLC",
                description:
                  "Deposit native KLC to receive gKLC, the governance token, at a 1:1 ratio.",
                to: "/wrap-klc",
                cta: "Wrap KLC",
              },
              {
                step: 2,
                title: "Delegate voting power",
                description:
                  "gKLC gives you 0 voting power until you delegate — delegate to yourself to activate it.",
                to: "/delegation",
                cta: "Delegate",
              },
              {
                step: 3,
                title: "Vote or propose",
                description:
                  "Vote on active proposals or create your own to shape KalyChain.",
                to: "/proposals",
                cta: "View proposals",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-card rounded-xl border border-border p-6 flex flex-col"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="text-muted-foreground text-sm mt-2 flex-1">{item.description}</p>
                <Link to={item.to} className="mt-4">
                  <Button variant="default" size="sm" className="w-full">
                    {item.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* DAO Overview Section */}
        <section className="py-6">
          <DaoOverview />
        </section>

        {/* Token Information Section */}
        <section className="py-6">
          <TokenInfo />
        </section>

        {/* Active Proposals Section */}
        <section className="py-6">
          <ActiveProposalsList title="Active Proposals" showFilters={false} limit={3} />
        </section>

        {/* Call to Action */}
        <section className="bg-primary/5 rounded-xl p-8 text-center my-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Ready to participate in governance?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Connect your wallet to start voting on proposals or create your own.
            Your KLC tokens represent your voting power in the DAO.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <WalletButton />
            <Link to="/create-proposal">
              <Button variant="default" size="lg" className="h-11">
                Create Proposal
              </Button>
            </Link>
          </div>
        </section>
      </main>
      {/* Footer is provided by the shared Layout (Footer.tsx) — the page-local
          footer was removed to avoid two stacked footers. */}
    </div>
  );
};

export default Home;
