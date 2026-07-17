const ADMIN_DATE_TIME_ZONE = process.env.NEXT_PUBLIC_ADMIN_DATE_TIME_ZONE || 'America/New_York';

const adminDateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    timeZone: ADMIN_DATE_TIME_ZONE,
});

const adminDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ADMIN_DATE_TIME_ZONE,
    timeZoneName: 'short',
});

export function formatAdminDate(value: string | number | Date | null | undefined) {
    if (!value) return '-';

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return '-';

    return adminDateFormatter.format(date);
}

export function formatAdminDateTime(value: string | number | Date | null | undefined) {
    if (!value) return '-';

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return '-';

    return adminDateTimeFormatter.format(date);
}
