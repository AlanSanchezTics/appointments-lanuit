import { Button } from "@/components/ui/public/button";
import type { DayAvailability } from "@/lib/availability/service";

type DaySelectorProps = {
  days: DayAvailability[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
};

export function DaySelector({
  days,
  selectedDate,
  onSelect,
}: DaySelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {days.map((day) => (
        <Button
          key={day.date}
          variant={selectedDate === day.date ? "primary" : "secondary"}
          className="w-full"
          onClick={() => onSelect(day.date)}
        >
          {day.date.slice(-2)}
        </Button>
      ))}
    </div>
  );
}
