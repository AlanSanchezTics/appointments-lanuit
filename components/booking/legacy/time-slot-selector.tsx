import { Button } from "@/components/ui/public/button";

type TimeSlotSelectorProps = {
  slots: string[];
  selectedSlot: string | null;
  onSelect: (slot: string) => void;
};

export function TimeSlotSelector({
  slots,
  selectedSlot,
  onSelect,
}: TimeSlotSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {slots.map((slot) => (
        <Button
          key={slot}
          variant={selectedSlot === slot ? "primary" : "secondary"}
          className="w-full"
          onClick={() => onSelect(slot)}
        >
          {slot}
        </Button>
      ))}
    </div>
  );
}
