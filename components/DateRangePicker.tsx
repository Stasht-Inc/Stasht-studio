import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { format, parse } from "date-fns";
import { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  className = ""
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "range">("range");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [isOngoing, setIsOngoing] = useState(false);

  // Parse the initial value
  useEffect(() => {
    console.log(`🔄 useEffect triggered - value changed to: "${value}"`);

    if (!value) {
      // Reset states when value is empty
      console.log('🔄 Resetting all states (empty value)');
      setSelectedDate(undefined);
      setSelectedDates([]);
      setIsOngoing(false);
      return;
    }

    console.log(`📅 Parsing date value: "${value}"`);

    // Check if it's ongoing
    const isOngoingValue = value.toLowerCase().includes("present") || value.toLowerCase().includes("ongoing");
    setIsOngoing(isOngoingValue);

    // Try to parse the date range
    // Examples: "Feb 12, 2001 - Oct 31, 2025", "01 oct - 23 oct", "Feb 12- Feb 28/25", "Oct 2025"
    const rangeMatch = value.match(/(.+?)\s*-\s*(.+)/);

    if (rangeMatch) {
      setMode("range");
      const startStr = rangeMatch[1].trim();
      const endStr = rangeMatch[2].trim();

      console.log(`📅 Detected range: start="${startStr}", end="${endStr}"`);

      try {
        // Handle "Present" end date
        if (endStr.toLowerCase().includes("present") || endStr.toLowerCase().includes("ongoing")) {
          const startDate = parseFlexibleDate(startStr);
          console.log(`📅 Range with Present: from=${startDate}`);
          if (startDate && !isNaN(startDate.getTime())) {
            setSelectedDates([startDate]);
            console.log(`✅ Set range with Present: from=${startDate.toDateString()}`);
          } else {
            console.error(`❌ Could not parse start date: "${startStr}"`);
            setSelectedDates([]);
          }
        } else {
          const startDate = parseFlexibleDate(startStr);
          const endDate = parseFlexibleDate(endStr);

          console.log(`📅 Parsing range results: from=${startDate}, to=${endDate}`);

          if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            // Sort dates chronologically before storing
            const sortedDates = [startDate, endDate].sort((a, b) => a.getTime() - b.getTime());

            // Store only start and end dates, not the range between them
            const dates = sortedDates[0].getTime() === sortedDates[1].getTime()
              ? [sortedDates[0]]  // Same date, store only once
              : sortedDates;  // Different dates, store both (already sorted)

            setSelectedDates(dates);
            console.log(`✅ Set date selections (sorted): ${dates.map(d => d.toDateString()).join(', ')}`);
          } else {
            console.error(`❌ Could not parse date range: start="${startStr}" (${startDate}), end="${endStr}" (${endDate})`);
            setSelectedDates([]);
          }
        }
      } catch (error) {
        console.error("Error parsing date range:", error);
        setSelectedDates([]);
      }
    } else {
      // Single date
      setMode("single");
      console.log(`📅 Detected single date: "${value}"`);
      try {
        const date = parseFlexibleDate(value);
        console.log(`📅 Single date parsed: ${date}`);
        if (date) {
          setSelectedDate(date);
        } else {
          console.error(`❌ Could not parse single date: "${value}"`);
          setSelectedDate(undefined);
        }
      } catch (error) {
        console.error("Error parsing single date:", error);
        setSelectedDate(undefined);
      }
    }
  }, [value]);

  // Helper function to normalize month names to proper case (e.g., "sep" -> "Sep")
  const normalizeMonthCase = (dateStr: string): string => {
    const monthNames = [
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];

    let normalized = dateStr;
    for (const month of monthNames) {
      // Match the month name case-insensitively and replace with proper case
      const regex = new RegExp(`\\b${month}\\b`, 'gi');
      const properCase = month.charAt(0).toUpperCase() + month.slice(1);
      normalized = normalized.replace(regex, properCase);
    }
    return normalized;
  };

  // Helper function to parse various date formats (iOS-compatible)
  const parseFlexibleDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    // Normalize: trim whitespace and fix month case for iOS compatibility
    const cleaned = normalizeMonthCase(dateStr.trim());
    console.log(`🔍 Attempting to parse: "${dateStr}" -> normalized: "${cleaned}"`);

    // Try common formats with different separators and formats
    const formats = [
      "MMM dd, yyyy",     // Feb 12, 2001 or Oct 01, 2025
      "MMM d, yyyy",      // Feb 1, 2001 or Oct 1, 2025
      "dd MMM, yyyy",     // 12 Feb, 2001 or 01 Oct, 2025
      "d MMM, yyyy",      // 1 Feb, 2001 or 1 Oct, 2025
      "MMM dd yyyy",      // Feb 12 2001 or Oct 01 2025
      "MMM d yyyy",       // Feb 1 2001 or Oct 1 2025
      "dd MMM yyyy",      // 12 Feb 2001 or 01 Oct 2025
      "d MMM yyyy",       // 1 Feb 2001 or 1 Oct 2025
      "MMM dd/yy",        // Feb 12/25 or Oct 23/25
      "MMM d/yy",         // Feb 1/25 or Oct 1/25
      "dd MMM/yy",        // 12 Feb/25 or 23 Oct/25
      "d MMM/yy",         // 1 Feb/25 or 1 Oct/25
      "MMM dd",           // Oct 01 or Feb 12 (assumes current year)
      "MMM d",            // Oct 1 or Feb 1 (assumes current year)
      "dd MMM",           // 01 Oct or 12 Feb (assumes current year)
      "d MMM",            // 1 Oct or 1 Feb (assumes current year)
      "MMM yyyy",         // Feb 2001 or Oct 2025
      "MMM yy",           // Feb 01 or Oct 25
      "yyyy-MM-dd",       // 2001-02-12 or 2025-10-01
      "MMMM dd, yyyy",    // February 12, 2001 (full month name)
      "MMMM d, yyyy",     // February 1, 2001 (full month name)
      "dd MMMM yyyy",     // 12 February 2001 (full month name)
      "d MMMM yyyy",      // 1 February 2001 (full month name)
    ];

    // Get current year as reference for dates without year
    const currentYear = new Date().getFullYear();
    const referenceDate = new Date(currentYear, 0, 1); // Jan 1 of current year

    for (const fmt of formats) {
      try {
        const parsed = parse(cleaned, fmt, referenceDate);
        if (!isNaN(parsed.getTime())) {
          // Normalize to start of day (midnight) for proper comparison
          const normalized = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
          console.log(`✅ Parsed "${cleaned}" with format "${fmt}":`, normalized.toDateString());
          return normalized;
        }
      } catch (error) {
        // Continue to next format
      }
    }

    // iOS-safe fallback: only use native Date for ISO format
    // Native Date parsing is unreliable on iOS for non-ISO formats
    if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
      try {
        const date = new Date(cleaned);
        if (!isNaN(date.getTime())) {
          const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          console.log(`✅ Parsed "${cleaned}" with native Date (ISO):`, normalized.toDateString());
          return normalized;
        }
      } catch {
        // ignore
      }
    }

    console.warn(`❌ Could not parse date: "${cleaned}"`);
    return null;
  };

  // Format date for display (backend expects: M d, Y format like "Oct 1, 2025")
  const formatDisplayDate = (date: Date | undefined): string => {
    if (!date) return "";
    return format(date, "MMM d, yyyy");  // No leading zero for day
  };

  // Handle apply changes
  const handleApply = () => {
    console.log('🔘 Apply clicked - mode:', mode, 'selectedDates:', selectedDates);

    if (mode === "single" && selectedDate) {
      const formattedValue = formatDisplayDate(selectedDate);
      console.log('✅ Applying single date:', formattedValue);
      onChange(formattedValue);
    } else if (mode === "range" && selectedDates.length > 0) {
      // Sort dates to ensure start is before end
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];

      console.log('📊 Sorted dates:', sortedDates.map(d => d.toDateString()));

      let formattedValue = '';
      if (isOngoing) {
        formattedValue = `${formatDisplayDate(startDate)} - Present`;
      } else if (sortedDates.length > 1) {
        formattedValue = `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
      } else {
        // Only one date selected
        formattedValue = formatDisplayDate(startDate);
      }

      console.log('✅ Applying range:', formattedValue);
      onChange(formattedValue);
    } else {
      console.warn('⚠️ No dates selected to apply');
    }
    setIsOpen(false);
  };

  // Get display value - shows live preview with dates automatically sorted
  const getDisplayValue = (): string => {
    // Single mode - show selected date
    if (mode === "single" && selectedDate) {
      return formatDisplayDate(selectedDate);
    }

    // Range mode - always format from sorted selectedDates
    if (mode === "range" && selectedDates.length > 0) {
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());

      // If ongoing checkbox is checked, show sorted start date with "Present"
      if (isOngoing) {
        return `${formatDisplayDate(sortedDates[0])} - Present`;
      }

      // If 2 dates selected, show sorted range
      if (sortedDates.length === 2) {
        return `${formatDisplayDate(sortedDates[0])} - ${formatDisplayDate(sortedDates[1])}`;
      }

      // If only 1 date selected, show that date
      return formatDisplayDate(sortedDates[0]);
    }

    // Fallback to value prop only if no dates are selected
    if (value) return value;
    return placeholder;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal ${!value ? "text-gray-400" : ""} ${className} bg-white border border-gray-200 hover:border-[#6C60FF] focus:border-[#6C60FF] focus:ring-0 transition-all duration-200`}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {getDisplayValue()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-0 shadow-lg max-h-[60vh] overflow-y-auto" align="start" sideOffset={-5}>
        <div className="bg-white rounded-lg shadow-lg">
          {/* Header */}
          {/* <div className="px-3 py-1.5 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-700">Date</div>
            {(value || (mode === "range" && isOngoing && selectedDates.length > 0)) && (
              <div className="text-xs text-gray-500 mt-0.5">{getDisplayValue()}</div>
            )}
          </div> */}  

          {/* Mode Toggle */}
          <div className="px-3 py-1.5 border-b border-gray-100">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMode("single");
                  setSelectedDates([]);
                  setIsOngoing(false);
                }}
                className={`px-4 py-1 rounded text-sm font-medium transition-colors ${
                  mode === "single"
                    ? "bg-[#7B68EE]/10 text-[#7B68EE]"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Single
              </button>
              <button
                onClick={() => {
                  setMode("range");
                  setSelectedDate(undefined);
                }}
                className={`px-4 py-1 rounded text-sm font-medium transition-colors ${
                  mode === "range"
                    ? "bg-[#7B68EE]/10 text-[#7B68EE]"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Range
              </button>
            </div>
          </div>

          {/* Calendar */}
          <div className="p-2">
            {mode === "single" ? (
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
            ) : (
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => {
                  if (dates) {
                    // Normalize all selected dates to start of day
                    const normalizedDates = dates.map(d =>
                      new Date(d.getFullYear(), d.getMonth(), d.getDate())
                    );

                    console.log('📅 Calendar dates changed:', normalizedDates.map(d => d.toDateString()));

                    // If we have more than 2 dates, keep only the last 2 clicked
                    if (normalizedDates.length > 2) {
                      const lastTwo = normalizedDates.slice(-2);
                      setSelectedDates(lastTwo);
                      console.log('📅 Keeping last 2 dates:', lastTwo.map(d => d.toDateString()));
                      // Clear ongoing when user selects 2 regular dates
                      setIsOngoing(false);
                    } else {
                      setSelectedDates(normalizedDates);
                      console.log('📅 Updated selected dates:', normalizedDates.map(d => d.toDateString()));
                      // Clear ongoing when user selects 2 regular dates
                      if (normalizedDates.length === 2) {
                        setIsOngoing(false);
                      }
                    }
                  } else {
                    setSelectedDates([]);
                    console.log('📅 Cleared all dates');
                  }
                }}
                initialFocus
              />
            )}
          </div>

          {/* Ongoing Checkbox */}
          {mode === "range" && (
            <div className="px-3 pb-1.5">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOngoing}
                  onChange={(e) => setIsOngoing(e.target.checked)}
                  className="rounded border-gray-300 text-[#7B68EE] focus:ring-[#7B68EE]"
                />
                <span>Ongoing - ends with "Present"</span>
              </label>
            </div>
          )}

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-gray-100 flex justify-end">
            <Button
              onClick={handleApply}
              className="bg-[#7B68EE] hover:bg-[#6B5DD3] text-white"
              size="sm"
            >
              Change
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
