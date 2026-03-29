export interface WeeklyOccupancyDay {
  date: string;
  occupiedSlots: number;
  capacity: number;
  occupancyPercent: number;
}

export interface WeeklyOccupancySummary {
  days: WeeklyOccupancyDay[];
  busiestDay: WeeklyOccupancyDay;
  dailyOccupancy: {
    date: string;
    occupiedAppointments: number;
    capacity: number;
    occupancyPercent: number;
  };
  currentWeekOccupancyPercent: number;
  previousWeekOccupancyPercent: number;
  deltaPercentPoints: number;
}
