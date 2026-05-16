import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { BusiestDayCard } from "@/components/admin/ui/BusiestDayCard";
import { ContentWrapper } from "@/components/admin/layout/ContentWrapper";
import { DailyOccupancyCard } from "@/components/admin/ui/DailyOccupancyCard";
import { DailyTipCard } from "@/components/admin/ui/DailyTipCard";
import { DashboardGreetingCard } from "@/components/admin/ui/DashboardGreetingCard";
import { PendingAppointmentsCard } from "@/components/admin/ui/PendingAppointmentsCard";
import { ReminderAppointmentsCard } from "@/components/admin/ui/ReminderAppointmentsCard";
import { RetouchReminderCard } from "@/components/admin/ui/RetouchReminderCard";
import { TodayAgendaTimelineCard } from "@/components/admin/ui/TodayAgendaTimelineCard";
import { WeeklyOccupancyCard } from "@/components/admin/ui/WeeklyOccupancyCard";
import { getAdminDashboardWeeklyOccupancy } from "@/lib/admin/dashboard/service";
import { getCurrentMonthKey } from "@/lib/datetime/mexico-city";
import { resolveServerLanguage } from "@/lib/i18n/language";
import { getServerT } from "@/lib/i18n/server";

export default async function AdminDashboardPage() {
  const session = await auth();
  const language = resolveServerLanguage((await cookies()).toString());
  const t = await getServerT(language);

  if (!session) {
    redirect("/admin/login");
  }

  const firstName =
    session.user?.name?.trim().split(/\s+/)[0] ??
    t("dashboard.hero.fallbackName", { ns: "admin" });
  const weeklyOccupancy = await getAdminDashboardWeeklyOccupancy(language);
  const currentMonth = getCurrentMonthKey();
  const hasWeeklyAppointments = weeklyOccupancy.days.some(
    (day) => day.occupiedSlots > 0,
  );
  const agendaTitleKey =
    weeklyOccupancy.todayAgendaTargetDate ===
    weeklyOccupancy.dailyOccupancy.date
      ? "dashboard.todayAgenda.title"
      : "dashboard.todayAgenda.titleForMonday";
  const dailyOccupancyTitleKey =
    weeklyOccupancy.todayAgendaTargetDate ===
    weeklyOccupancy.dailyOccupancy.date
      ? "dashboard.dailyOccupancy.title"
      : "dashboard.dailyOccupancy.titleForMonday";

  return (
    <AdminLayout>
      <ContentWrapper>
        <DashboardGreetingCard
          language={language}
          dateTemplate={t("dashboard.hero.dateLabel", { ns: "admin" })}
          greeting={t("dashboard.hero.greeting", {
            ns: "admin",
            name: firstName,
          })}
        />

        <DailyOccupancyCard
          data={weeklyOccupancy.dailyOccupancy}
          title={t(dailyOccupancyTitleKey, { ns: "admin" })}
          scheduledTodayLabel={t("dashboard.dailyOccupancy.scheduledToday", {
            ns: "admin",
            count: weeklyOccupancy.dailyOccupancy.occupiedAppointments,
          })}
        />

        <TodayAgendaTimelineCard
          language={language}
          title={t(agendaTitleKey, { ns: "admin" })}
          emptyLabel={t("dashboard.todayAgenda.empty", { ns: "admin" })}
          readyLabel={t("dashboard.todayAgenda.status.ready", { ns: "admin" })}
          inProgressLabel={t("dashboard.todayAgenda.status.inProgress", {
            ns: "admin",
          })}
          pendingLabel={t("dashboard.todayAgenda.status.pending", {
            ns: "admin",
          })}
          items={weeklyOccupancy.todayAgenda}
          monthHref={`/admin/months/${currentMonth}`}
          monthLinkAriaLabel={t("dashboard.todayAgenda.monthLinkAriaLabel", {
            ns: "admin",
          })}
        />

        {(weeklyOccupancy.reminders.nextDay.length > 0 ||
          weeklyOccupancy.reminders.nextWeek.length > 0) && (
          <ReminderAppointmentsCard
            language={language}
            nextDayItems={weeklyOccupancy.reminders.nextDay}
            nextWeekItems={weeklyOccupancy.reminders.nextWeek}
          />
        )}
        {weeklyOccupancy.retouchReminders.length > 0 && (
          <RetouchReminderCard items={weeklyOccupancy.retouchReminders} />
        )}

        {weeklyOccupancy.pendingAppointments.length > 0 && (
          <PendingAppointmentsCard
            language={language}
            items={weeklyOccupancy.pendingAppointments}
          />
        )}

        <WeeklyOccupancyCard
          language={language}
          data={weeklyOccupancy}
          title={t("dashboard.weeklyOccupancy.title", { ns: "admin" })}
          versusLabel={t("dashboard.weeklyOccupancy.versusPreviousWeek", {
            ns: "admin",
          })}
          dayAppointmentsTooltip={t(
            "dashboard.weeklyOccupancy.dayAppointmentsTooltip",
            {
              ns: "admin",
            },
          )}
        />

        {hasWeeklyAppointments ? (
          <BusiestDayCard
            language={language}
            day={weeklyOccupancy.busiestDay}
            title={t("dashboard.busiestDay.title", { ns: "admin" })}
            subtitle={t("dashboard.busiestDay.subtitle", { ns: "admin" })}
          />
        ) : null}

        <DailyTipCard
          title={t("dashboard.dailyTip.title", { ns: "admin" })}
          tip={weeklyOccupancy.dailyTip}
        />
      </ContentWrapper>
    </AdminLayout>
  );
}
