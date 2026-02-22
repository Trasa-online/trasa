import { ReactNode } from "react";
import TopBar from "./TopBar";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-lg mx-auto">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
