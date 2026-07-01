import React from "react";
import { Link } from "react-router-dom";
import { Github, Twitter, MessageSquare } from "lucide-react";

// Real KalyChain destinations (sourced from the official kaly-docs / kaly-site).
const EXTERNAL = {
  discord: "https://discord.gg/tTe8BmcAks",
  docs: "https://docs.kalychain.io",
  github: "https://github.com/kalycoinproject",
  twitter: "https://x.com/KalyChainEVM",
  whitepaper: "https://kalychain.io/whitepaper-en.pdf",
};

const linkClass = "text-muted-foreground hover:text-foreground";

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
    {children}
  </a>
);

const Footer = () => {
  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="container max-w-screen-2xl py-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link to="/" className="flex items-center space-x-2">
              <img src="/kalychain.png" alt="KalyChain Logo" className="h-8 w-8" />
              <span className="font-bold text-xl">KalyChain DAO</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              A decentralized governance platform for the KalyChain ecosystem.
            </p>
            <div className="flex space-x-4">
              <Ext href={EXTERNAL.twitter}>
                <Twitter className="h-5 w-5" />
              </Ext>
              <Ext href={EXTERNAL.discord}>
                <MessageSquare className="h-5 w-5" />
              </Ext>
              <Ext href={EXTERNAL.github}>
                <Github className="h-5 w-5" />
              </Ext>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-4">Governance</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/proposals" className={linkClass}>All Proposals</Link></li>
              <li><Link to="/create-proposal" className={linkClass}>Create Proposal</Link></li>
              <li><Link to="/voting-guide" className={linkClass}>Voting Guide</Link></li>
              <li><Ext href={EXTERNAL.discord}>Governance Forum</Ext></li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li><Ext href={EXTERNAL.docs}>Documentation</Ext></li>
              <li><Ext href={EXTERNAL.whitepaper}>Whitepaper</Ext></li>
              <li><Ext href={EXTERNAL.discord}>Developer Portal</Ext></li>
              <li><Link to="/community-guidelines" className={linkClass}>Community Guidelines</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/terms" className={linkClass}>Terms of Service</Link></li>
              <li><Link to="/privacy" className={linkClass}>Privacy Policy</Link></li>
              <li><Link to="/cookies" className={linkClass}>Cookie Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/40 mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} KalyChain DAO. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
