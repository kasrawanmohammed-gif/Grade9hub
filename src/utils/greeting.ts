import { useEffect, useState } from 'react';
import { formatMsg, Translations } from '../i18n/translations';

export type TimeOfDayPeriod = 'morning' | 'afternoon' | 'evening';

export function getTimeOfDayPeriod(date: Date = new Date()): TimeOfDayPeriod {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function getStudentTimeGreeting(
  t: Translations,
  date: Date = new Date()
): string {
  const period = getTimeOfDayPeriod(date);
  const timeGreeting =
    period === 'morning'
      ? t.brand.greetingMorning
      : period === 'afternoon'
      ? t.brand.greetingAfternoon
      : t.brand.greetingEvening;
  return formatMsg(t.brand.studentGreetingTemplate, { timeGreeting });
}

export function useStudentGreeting(t: Translations): string {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return getStudentTimeGreeting(t, now);
}
