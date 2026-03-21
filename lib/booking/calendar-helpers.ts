export function getLeadingBlanks(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
}

export function getMonthDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDate = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: lastDate }, (_, index) => {
    const day = `${index + 1}`.padStart(2, "0");
    return `${month}-${day}`;
  });
}
