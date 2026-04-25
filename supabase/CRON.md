# Reminder cron schedule

After you've deployed `daily-nudges` and set the channel secrets
(`TELEGRAM_BOT_TOKEN` etc.), paste this in the Supabase SQL editor.

## 1. Enable extensions (one-time)

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

## 2. Store your service-role key once so the cron jobs can call the function

```sql
-- Replace with your project's service_role key from Settings → API.
-- This goes into a Vault secret so it isn't in plaintext in the cron rows.
select vault.create_secret(
  '<paste service_role key here>',
  'gym_service_role_key',
  'Used by reminder cron jobs to call edge functions.'
);
```

## 3. Helper: schedule a nudge type at a UTC time

```sql
-- IST is UTC+5:30. Adjust if your users are elsewhere.
-- 10:00 IST = 04:30 UTC ; 14:00 IST = 08:30 UTC ; 16:00 IST = 10:30 UTC
-- 20:00 IST = 14:30 UTC ; 09:00 IST = 03:30 UTC

create or replace function public.fire_nudge(p_type text)
returns void language plpgsql security definer as $$
declare
  service_key text;
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'gym_service_role_key';

  perform net.http_post(
    url := 'https://pmcksqfbdbhurtbrverc.functions.supabase.co/daily-nudges?type=' || p_type,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
end;
$$;
```

## 4. Schedule each nudge

```sql
-- Breakfast at 10:00 IST (04:30 UTC)
select cron.schedule('nudge-breakfast',  '30 4 * * *', $$select public.fire_nudge('breakfast')$$);

-- Lunch at 14:00 IST (08:30 UTC)
select cron.schedule('nudge-lunch',      '30 8 * * *', $$select public.fire_nudge('lunch')$$);

-- Water at 16:00 IST (10:30 UTC)
select cron.schedule('nudge-water',      '30 10 * * *', $$select public.fire_nudge('water')$$);

-- Dinner at 20:00 IST (14:30 UTC)
select cron.schedule('nudge-dinner',     '30 14 * * *', $$select public.fire_nudge('dinner')$$);

-- Workout at 20:00 IST (14:30 UTC) — sent right after dinner reminder
select cron.schedule('nudge-workout',    '30 14 * * *', $$select public.fire_nudge('workout')$$);

-- Goal digest Sundays at 09:00 IST (03:30 UTC)
select cron.schedule('nudge-goals-weekly', '30 3 * * 0', $$select public.fire_nudge('goals')$$);
```

## 5. Verify

```sql
-- See all scheduled jobs
select jobid, schedule, jobname, command from cron.job order by jobname;

-- Last 10 runs of any nudge cron with status
select jobname, status, return_message, start_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname like 'nudge-%'
order by start_time desc
limit 10;
```

## 6. Disable / change a job

```sql
-- Pause a single nudge
update cron.job set active = false where jobname = 'nudge-water';

-- Or fully remove
select cron.unschedule('nudge-water');
```

---

## Manual test (skip waiting for cron)

```bash
curl -X POST 'https://pmcksqfbdbhurtbrverc.functions.supabase.co/daily-nudges?type=breakfast' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

Returns a JSON summary like:
```json
{ "type": "breakfast", "sent": 3, "skipped": 0, "failed": 1, "results": [...] }
```

If `failed > 0`, look at `results[].detail` for the per-user reason
(`telegram_not_configured`, `no_chat_id`, etc).
