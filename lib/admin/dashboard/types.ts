export interface WeeklyOccupancyDay {
  date: string;
  occupiedSlots: number;
  capacity: number;
  occupancyPercent: number;
}

export interface WeeklyOccupancySummary {
  days: WeeklyOccupancyDay[];
  busiestDay: WeeklyOccupancyDay;
  currentWeekOccupancyPercent: number;
  previousWeekOccupancyPercent: number;
  deltaPercentPoints: number;
}
