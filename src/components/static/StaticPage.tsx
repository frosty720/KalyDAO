import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface StaticPageProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** Shared layout for simple content pages (voting guide, legal, etc.). */
const StaticPage = ({ title, subtitle, children }: StaticPageProps) => (
  <div className="container max-w-3xl mx-auto py-10 px-4">
    <Link
      to="/"
      className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
    >
      <ArrowLeft className="h-4 w-4 mr-1" /> Back to Home
    </Link>
    <h1 className="text-3xl font-bold text-foreground mb-2">{title}</h1>
    {subtitle && <p className="text-muted-foreground mb-8">{subtitle}</p>}
    <div className="static-content">
      {children}
    </div>
  </div>
);

export default StaticPage;
