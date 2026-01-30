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
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    isCompleted && "bg-primary/70 text-primary-foreground",
                    isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background",
                    isFuture && "bg-muted border-2 border-border text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    stepNumber
                  )}
                </div>
                {/* Label - hidden on mobile, visible on larger screens */}
                <span
                  className={cn(
                    "hidden sm:block text-xs mt-1.5 font-medium text-center",
                    isCompleted && "text-muted-foreground",
                    isCurrent && "text-foreground",
                    isFuture && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                {/* Short label on mobile */}
                <span
                  className={cn(
                    "sm:hidden text-[10px] mt-1 font-medium text-center max-w-[60px]",
                    isCompleted && "text-muted-foreground",
                    isCurrent && "text-foreground",
                    isFuture && "text-muted-foreground"
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
