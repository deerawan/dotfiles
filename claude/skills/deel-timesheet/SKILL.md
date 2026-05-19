---
name: deel-timesheet
description: Use when user wants to submit working hours to Deel.com, log time tracking, fill timesheet, or record work hours for a pay cycle. Triggers on "submit hours", "log time", "deel timesheet", "working hours".
---

# Deel Timesheet Submission

Submit working hours to Deel.com via API using Chrome MCP for authentication.

## Prerequisites

- User must be logged into Deel in Chrome (navigate to `https://app.deel.com` and verify login)
- Chrome MCP must be available

## Constants

- **Contract ID:** `387py5k`
- **Base URL:** `https://app.deel.com/deelapi`
- **Default work hours:** 07:00 AM - 04:00 PM (9 hours total)
- **Default break:** 01:00 PM - 02:00 PM (1 hour)
- **Default worked hours:** 8 hours

## Workflow

### Step 1: Ensure Deel Page is Active

Navigate to Deel time tracking page to ensure cookies are available for API calls:

```
navigate_page → https://app.deel.com/time-attendance/387py5k
```

Wait for page to load by checking for "Time tracking" text.

### Step 2: Determine Target Dates

- **Default:** today only
- User may specify: a single date, multiple dates, a date range, or "current month"
- For "current month": use 1st through last day of the current month

### Step 3: Fetch Calendar & Existing Timesheets

Use `evaluate_script` to call both APIs. **Auth token is in `localStorage.getItem('token')`** and must be passed as `x-auth-token` header.

```javascript
async () => {
  const token = localStorage.getItem('token');
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'x-auth-token': token,
    'x-api-version': '2',
    'x-platform': 'web',
    'x-owner': 'time-tracking',
    'x-app-host': 'app.deel.com',
    'x-locale': 'en'
  };
  const startDate = '2026-04-01T00:00:00.000Z'; // adjust dynamically
  const endDate = '2026-04-30T23:59:59.000Z';
  const [calResp, tsResp] = await Promise.all([
    fetch('/deelapi/time_tracking/contracts/387py5k/calendar?startDate=' + startDate + '&endDate=' + endDate, { headers }),
    fetch('/deelapi/time_tracking/time_sheets/387py5k?startDate=' + startDate + '&endDate=' + endDate, { headers })
  ]);
  const cal = await calResp.json();
  const ts = await tsResp.json();
  return cal.contract.calendar.map(c => {
    const dateStr = c.day.split('T')[0];
    const tsEntry = ts.timeSheets.find(t => t.day.split('T')[0] === dateStr);
    const d = new Date(c.day);
    const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];
    return {
      date: dateStr, day: dayName, status: c.status,
      holiday: tsEntry?.holiday?.description || null,
      hasSubmittedShift: !!(tsEntry?.shift && tsEntry.shift.shiftCategory !== 'FORECASTED_SHIFT'),
      dayTypes: tsEntry?.dayTypes || []
    };
  });
}
```

**Calendar status values:**
- `AVAILABLE` - normal working day
- `PUBLIC_HOLIDAY` - holiday (has `holiday.description`)
- `NON_WORKING_DAY` - weekend/rest day
- `HAS_SUBMITTED_SHIFTS` - already submitted

**Timesheet dayTypes:**
- `NO_WORKED_HOURS` - no submission yet
- `HOLIDAY` - public holiday
- `REST_DAY` - weekend

A day should be submitted if:
- Status is `AVAILABLE` and no shifts submitted yet
- User explicitly requested it (even holidays/weekends)

A day should be skipped if:
- Already has submitted (non-forecasted) shifts
- Is a holiday or weekend (unless user explicitly includes it)

### Step 4: Build and Display Summary Table

**MUST show this table and wait for user confirmation before submitting.**

```
| #  | Date       | Day | Type            | Start    | End      | Break    | Hours | Action  |
|----|------------|-----|-----------------|----------|----------|----------|-------|---------|
| 1  | 2026-04-01 | Wed | Working day     | 07:00 AM | 04:00 PM | 1-2 PM   | 8h    | Submit  |
| 2  | 2026-04-02 | Thu | Working day     | 07:00 AM | 04:00 PM | 1-2 PM   | 8h    | Submit  |
| 3  | 2026-04-03 | Fri | Good Friday     | -        | -        | -        | -     | Skip    |
| 4  | 2026-04-04 | Sat | Easter Saturday | -        | -        | -        | -     | Skip    |
```

Rules:
- Working days (AVAILABLE, no existing shift) → default hours, Action: Submit
- Holidays → Skip (show holiday name)
- Weekends/Rest days → Skip
- Already submitted → Skip (note "Already submitted")
- User-overridden dates → show custom times

### Step 5: Submit Hours

For each day marked "Submit", use `evaluate_script` to validate then submit:

```javascript
async () => {
  const token = localStorage.getItem('token');
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'x-auth-token': token,
    'x-api-version': '2',
    'x-platform': 'web',
    'x-owner': 'time-tracking',
    'x-app-host': 'app.deel.com',
    'x-locale': 'en'
  };

  // dateStr: 'YYYY-MM-DD', startH/endH/breakStartH/breakEndH: '07','16','13','14'
  const dateStr = '2026-04-02';
  const startH = '07', endH = '16', breakStartH = '13', breakEndH = '14';

  // Validate
  const vResp = await fetch('/deelapi/time_tracking/time_sheets/shifts/validate', {
    method: 'POST', headers,
    body: JSON.stringify({
      contractOid: '387py5k', submitType: 'REGULAR',
      start: dateStr + 'T' + startH + ':00:00.000Z',
      end: dateStr + 'T' + endH + ':00:00.000Z',
      shiftType: 'UNSPECIFIED',
      breaks: [{ start: dateStr + 'T' + breakStartH + ':00:00.000Z', end: dateStr + 'T' + breakEndH + ':00:00.000Z', type: 'BREAK' }],
      mealBreakWaived: false
    })
  });
  const validation = await vResp.json();
  if (validation.inconsistencies && validation.inconsistencies.length > 0) {
    return { date: dateStr, status: 'VALIDATION_ERROR', detail: validation.inconsistencies };
  }

  // Submit
  const sResp = await fetch('/deelapi/time_tracking/time_sheets/shifts', {
    method: 'POST', headers,
    body: JSON.stringify({
      contractOid: '387py5k',
      start: dateStr + 'T' + startH + ':00:00.000Z',
      end: dateStr + 'T' + endH + ':00:00.000Z',
      description: '',
      breaks: [{ start: dateStr + 'T' + breakStartH + ':00:00.000Z', end: dateStr + 'T' + breakEndH + ':00:00.000Z', type: 'BREAK' }],
      calledOuts: [], shiftType: 'UNSPECIFIED',
      hourlyReportPresetId: null, workAssignmentId: null,
      isAutoApproved: false, mealBreakWaived: false,
      origin: 'PLATFORM', workLocation: null,
      workLocationEntityAddressId: null, isForecastEdit: false
    })
  });
  const result = await sResp.json();
  return { date: dateStr, status: result.shift ? result.shift.status : 'ERROR', hours: result.shift?.totalWorkedHours };
}
```

Submit days one at a time to handle errors gracefully. Report each result.

### Step 6: Report Results

Show final summary table:

```
| Date       | Status             | Hours |
|------------|--------------------|-------|
| 2026-04-01 | Pending Approval   | 8h    |
| 2026-04-02 | Pending Approval   | 8h    |
| 2026-04-03 | Skipped (Holiday)  | -     |
```

## Custom Hours

User can override times for specific dates:

> "Submit hours for April, but on Apr 10 I worked 10am-6pm with break 1-2pm"

Map custom times to 24h format for the payload:
- 10:00 AM → `10`, 6:00 PM → `18`, 1:00 PM → `13`, 2:00 PM → `14`

## API Time Format

Times use ISO 8601 with `Z` suffix but represent **local times** (not actual UTC):
- 7:00 AM → `T07:00:00.000Z`
- 4:00 PM → `T16:00:00.000Z`
- 1:00 PM → `T13:00:00.000Z`

## Error Handling

- Validation inconsistencies → report and skip that day
- Non-200 response → report error, continue with remaining days
- 401 Unauthorized → ask user to refresh Deel page (re-login), then retry
