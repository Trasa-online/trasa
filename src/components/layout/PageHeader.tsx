import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  showBell?: boolean;
  showSearch?: boolean;
  unreadCount?: number;
  rightAction?: ReactNode;
  onBackClick?: () => void;
}

export const PageHeader = ({
  title,
  showBack = false,
  showBell = false,
  showSearch = false,
  unreadCount = 0,
  rightAction,
  onBackClick,
}: PageHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border">
      <div className="flex items-center justify-between p-4">
        {/* Left side */}
        <div className="flex items-center gap-3">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-xl font-bold">{title}</h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {rightAction}
          {showBell && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/notifications")}
              className="h-9 w-9 relative"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          )}
          {showSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/search")}
              className="h-9 w-9"
            >
              <Search className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
