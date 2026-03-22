import {
  faCalendarDay,
  faEye,
  faEyeSlash,
  faListCheck,
  faLock,
  faRotateRight,
  faTriangleExclamation,
  faUser
} from "@fortawesome/free-solid-svg-icons";
import { faCalendarDays, faClock } from "@fortawesome/free-regular-svg-icons";

export const adminIcons = {
  username: faUser,
  password: faLock,
  passwordShow: faEye,
  passwordHide: faEyeSlash,
  appointmentsToday: faCalendarDay,
  pending: faClock,
  syncFailed: faTriangleExclamation,
  monthsManagement: faCalendarDays,
  dailyAppointments: faListCheck,
  syncRetries: faRotateRight,
} as const;
