import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CityPicker from "@/components/plan-wizard/CityPicker";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";

type Step = 1 | 2 | 3;

const stepTitles: Record<Step, string> = {
  1: "trasa",
  2: "trasa",
  3: "trasa",
};

const PlanWizard = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [city, setCity] = useState("");
  const [date, setDate] = useState<Date | null>(null);

  const handleBack = () => {
    if (step === 1) navigate("/");
    else setStep((s) => (s - 1) as Step);
  };

  return (
    <div className="flex flex-col h-screen bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center px-4 pt-safe-4 pt-4 pb-3 border-b border-border/20 shrink-0">
        <button
          onClick={handleBack}
          className="h-9 w-9 flex items-center justify-center -ml-1 text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-xl font-black tracking-tight">
          {stepTitles[step]}
        </h1>
        <div className="w-9" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {step === 1 && (
          <CityPicker
            onConfirm={(selectedCity) => {
              setCity(selectedCity);
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <FullCalendarPicker
            onConfirm={(selectedDate) => {
              setDate(selectedDate);
              setStep(3);
            }}
          />
        )}

        {step === 3 && date && (
          <PlaceSwiper city={city} date={date} />
        )}
      </div>
    </div>
  );
};

export default PlanWizard;
