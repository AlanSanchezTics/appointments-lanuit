// Huecos iniciales de un grid de calendario de lunes a domingo (0 = el día 1 cae en lunes).
// getUTCDay() devuelve domingo=0; (d + 6) % 7 lo pasa a lunes=0.
export function getLeadingBlanks(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const sundayFirstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  return (sundayFirstWeekday + 6) % 7;
}

export function getMonthDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDate = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: lastDate }, (_, index) => {
    const day = `${index + 1}`.padStart(2, "0");
    return `${month}-${day}`;
  });
}
