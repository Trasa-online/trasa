import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  label: string;
  shortLabel?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

const StepIndicator = ({ steps, currentStep, className }: StepIndicatorProps) => {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isFuture = stepNumber > currentStep;

          return (
            <div key={index} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium transition-all",
                    isCompleted && "bg-foreground/10 text-foreground",
                    isCurrent && "bg-foreground text-background",
                    isFuture && "bg-muted text-muted-foreground/50"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    stepNumber
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] mt-1 font-medium text-center tracking-wide",
                    isCompleted && "text-muted-foreground",
                    isCurrent && "text-foreground",
                    isFuture && "text-muted-foreground/50"
                  )}
                >
                  {step.shortLabel || step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px mx-3 transition-colors",
                    stepNumber < currentStep ? "bg-foreground/20" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
