import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

const Layout = () => {
  // Wallet state lives in RainbowKit/wagmi (Header uses <ConnectButton />),
  // so Layout just composes the page shell.
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      {/* No background here — let the body's radial-gradient (kaly-vault) show through. */}
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
