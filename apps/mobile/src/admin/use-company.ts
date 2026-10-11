import { formatInTimeZone } from 'date-fns-tz';
import { useMe } from '../auth/use-me';

/** The company's timezone and its current calendar day (YYYY-MM-DD), so "Today" matches the dashboard. */
export function useCompanyDay() {
  const me = useMe();
  const tz = me.data?.company.timezone ?? 'Asia/Kolkata';
  return { tz, today: formatInTimeZone(new Date(), tz, 'yyyy-MM-dd'), companyName: me.data?.company.name ?? '' };
}
