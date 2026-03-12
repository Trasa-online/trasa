import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: ReactNode;
  onBackClick?: () => void;
}

export const PageHeader = ({
  title,
  showBack = false,
  rightAction,
  onBackClick,
}: PageHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      const historyIdx = window.history.state?.idx;
      if (typeof historyIdx === "number" && historyIdx > 0) {
        navigate(-1);
      } else {
        navigate("/", { replace: true });
      }
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border safe-top">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-9 w-9"
              aria-label="Wróć"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1
            className={`text-xl font-bold ${title === "TRASA" ? "cursor-pointer" : ""}`}
            onClick={title === "TRASA" ? () => navigate("/") : undefined}
          >
            {title}
          </h1>
        </div>
        {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
      </div>
    </div>
  );
};
