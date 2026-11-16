import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(tz);

const BUSINESS_TZ = 'America/Los_Angeles';

export class InvoiceAgingService {
  bucketFor(invoice: { dueDate: string }): string {
    const today = dayjs().tz(BUSINESS_TZ).startOf('day');
    const due = dayjs.tz(invoice.dueDate, BUSINESS_TZ).startOf('day');
    const daysLate = today.diff(due, 'day');
    if (daysLate <= 0) return 'current';
    if (daysLate <= 30) return '1-30';
    if (daysLate <= 60) return '31-60';
    return '60+';
  }
}
