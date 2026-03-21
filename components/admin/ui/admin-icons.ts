import {
  faCalendarDay,
  faListCheck,
  faLock,
  faRotateRight,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { faCalendarDays, faClock, faUser } from "@fortawesome/free-regular-svg-icons";

export const adminIcons = {
  username: faUser,
  password: faLock,
  appointmentsToday: faCalendarDay,
  pending: faClock,
  syncFailed: faTriangleExclamation,
  monthsManagement: faCalendarDays,
  dailyAppointments: faListCheck,
  syncRetries: faRotateRight,
} as const;
