import { ReactNode, useState } from "react";
import TopBar from "./TopBar";
import OrbOverlay from "./OrbOverlay";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const [showOrbOverlay, setShowOrbOverlay] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <TopBar onOrbClick={() => setShowOrbOverlay(true)} />
      <main className="max-w-lg mx-auto">
        {children}
      </main>
      {showOrbOverlay && <OrbOverlay onClose={() => setShowOrbOverlay(false)} />}
    </div>
  );
};

export default AppLayout;
