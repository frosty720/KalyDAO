import { Suspense, type ReactNode } from "react";
import { useRoutes, Routes, Route } from "react-router-dom";
import Home from "./components/home";
import Layout from "./components/layout/Layout";
import ProposalsPage from "./components/proposals/ProposalsPage";
import ProposalDetail from "./components/proposals/ProposalDetail";
import CreateProposal from "./components/proposals/CreateProposal";
import WrapKLC from "./components/wrap/WrapKLC";
import ApiTest from "./components/test/ApiTest";
import NotFound from "./components/layout/NotFound";
import VotingGuide from "./components/static/VotingGuide";
import CommunityGuidelines from "./components/static/CommunityGuidelines";
import TermsOfService from "./components/static/TermsOfService";
import PrivacyPolicy from "./components/static/PrivacyPolicy";
import CookiePolicy from "./components/static/CookiePolicy";
import routes from "tempo-routes";
import { WagmiProvider } from 'wagmi';
import { ThirdwebProvider } from 'thirdweb/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './blockchain/config/wagmi';
import { useThirdwebWagmiBridge } from './blockchain/config/thirdwebBridge';
import BlockWatcher from './components/BlockWatcher';
import { DelegationManager } from '@/components/governance/DelegationManager';

// Create a client for TanStack Query
const queryClient = new QueryClient();

// Runs inside both providers; syncs the active thirdweb wallet into wagmi so every
// existing wagmi hook keeps working (see thirdwebBridge.ts).
function Bridge({ children }: { children: ReactNode }) {
  useThirdwebWagmiBridge();
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <ThirdwebProvider>
          <Bridge>
          <Suspense fallback={<p>Loading...</p>}>
            <>
              <BlockWatcher />
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/proposals" element={<ProposalsPage />} />
                  <Route path="/proposals/:id" element={<ProposalDetail />} />
                  <Route path="/create-proposal" element={<CreateProposal />} />
                  <Route path="/wrap-klc" element={<WrapKLC />} />
                  <Route path="/test/api" element={<ApiTest />} />
                  <Route path="/delegation" element={<DelegationManager />} />
                  <Route path="/voting-guide" element={<VotingGuide />} />
                  <Route path="/community-guidelines" element={<CommunityGuidelines />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/cookies" element={<CookiePolicy />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
              {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}
            </>
          </Suspense>
          </Bridge>
        </ThirdwebProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

export default App;
