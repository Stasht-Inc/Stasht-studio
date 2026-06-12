"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface TimePeriodSelectorProps {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

const timePeriods = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "annually", label: "Annually" }
];

export default function TimePeriodSelector({ 
  defaultValue = "weekly", 
  onValueChange 
}: TimePeriodSelectorProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(defaultValue);

  const handleValueChange = (value: string) => {
    setSelectedPeriod(value);
    if (onValueChange) {
      onValueChange(value);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-500 whitespace-nowrap text-base">Time period:</span>
      <Select value={selectedPeriod} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[110px] sm:w-[140px] h-10 bg-white border border-gray-200 hover:border-[#6C60FF] focus:border-[#6C60FF] focus:ring-1 focus:ring-[#6C60FF] transition-all duration-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-[140px] bg-white border border-gray-200 shadow-lg rounded-lg">
          {timePeriods.map((period) => (
            <SelectItem 
              key={period.value} 
              value={period.value}
              className="cursor-pointer hover:bg-[#6C60FF]/10 focus:bg-[#6C60FF]/10 focus:text-[#6C60FF] transition-all duration-200 rounded-md mx-1 my-0.5 px-3 py-2"
            >
              {period.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}