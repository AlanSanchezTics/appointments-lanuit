export interface WeeklyOccupancyDay {
  date: string;
  occupiedSlots: number;
  capacity: number;
  occupancyPercent: number;
}

export type TodayAgendaStatus = "READY" | "IN_PROGRESS" | "PENDING";

export interface TodayAgendaItem {
  appointmentId: number;
  timeSlot: string;
  name: string;
  phone: string;
  status: TodayAgendaStatus;
}

export interface DailyTip {
  title: string;
  content: string;
  index: number;
  total: number;
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
  todayAgendaTargetDate: string;
  todayAgenda: TodayAgendaItem[];
  dailyTip: DailyTip;
  currentWeekOccupancyPercent: number;
  previousWeekOccupancyPercent: number;
  deltaPercentPoints: number;
}
