import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Home, FileText, PenSquare, Menu, X, Vote, Wallet } from "lucide-react";
import { WalletButton } from '@/components/WalletButton';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const navItems = [
    { name: "Home", path: "/", icon: <Home className="h-4 w-4 mr-2" /> },
    {
      name: "Proposals",
      path: "/proposals",
      icon: <FileText className="h-4 w-4 mr-2" />,
    },
    {
      name: "Create Proposal",
      path: "/create-proposal",
      icon: <PenSquare className="h-4 w-4 mr-2" />,
    },
    {
      name: "Delegation",
      path: "/delegation",
      icon: <Vote className="h-4 w-4 mr-2" />,
    },
    {
      name: "Wrap KLC",
      path: "/wrap-klc",
      icon: <Wallet className="h-4 w-4 mr-2" />,
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-20 max-w-screen-2xl items-center">
        {/* Logo */}
        <Link to="/" className="mr-6 flex items-center space-x-2">
          <img 
            src="/kalychain.png" 
            alt="KalyChain Logo" 
            className="h-8 w-8"
          />
          <span className="font-bold text-xl hidden sm:inline-block">
            KalyChain DAO
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-4 lg:space-x-6 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className="flex items-center text-sm font-medium transition-colors hover:text-primary"
            >
              {item.icon}
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMobileMenu}
          className="md:hidden ml-auto mr-4"
          aria-label="Toggle Menu"
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>

        {/* RainbowKit Connect Button */}
        <div className="ml-auto">
          <WalletButton compact />
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background">
          <div className="container py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className="flex items-center py-2 text-sm font-medium transition-colors hover:text-primary"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.icon}
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
