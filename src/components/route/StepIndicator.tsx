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
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                    isCompleted && "bg-muted-foreground/30 text-foreground",
                    isCurrent && "bg-foreground text-background ring-1 ring-foreground/20 ring-offset-1 ring-offset-background",
                    isFuture && "bg-muted border border-border text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    stepNumber
                  )}
                </div>
                {/* Label - visible on all screens */}
                <span
                  className={cn(
                    "text-[10px] mt-1 font-medium text-center",
                    isCompleted && "text-muted-foreground",
                    isCurrent && "text-foreground",
                    isFuture && "text-muted-foreground/70"
                  )}
                >
                  {step.shortLabel || step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 sm:mx-3 transition-colors",
                    stepNumber < currentStep ? "bg-primary/70" : "bg-border"
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
