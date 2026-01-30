import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  className?: string;
  children?: ReactNode;
}

const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  className,
  children,
}: EmptyStateProps) => {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-12 w-12 text-muted-foreground/50" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>
          {ActionIcon && <ActionIcon className="h-4 w-4 mr-2" />}
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
};

export default EmptyState;
