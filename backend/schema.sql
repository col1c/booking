-- PostgreSQL schema for Belved Hair Booking
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$ begin
  create type booking_status as enum ('pending','confirmed','cancelled','priority_request');
exception when duplicate_object then null; end $$;

create table if not exists barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  whatsapp_e164 text,
  sms_e164 text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_min int not null check (duration_min = 30),
  price_cents int not null default 0,
  is_active boolean not null default true
);

create table if not exists barber_services (
  barber_id uuid references barbers(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  primary key (barber_id, service_id)
);

create table if not exists working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references barbers(id) on delete cascade,
  weekday int not null check (weekday between 1 and 7), -- 1=Mon ... 7=Sun
  start_time time not null,
  end_time   time not null,
  unique (barber_id, weekday, start_time, end_time),
  check (end_time > start_time)
);

create table if not exists time_off (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references barbers(id) on delete cascade,
  start_ts timestamptz not null,
  end_ts   timestamptz not null,
  reason text,
  check (end_ts > start_ts)
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references barbers(id) on delete cascade,
  service_id uuid not null references services(id),
  customer_name text not null,
  phone_e164 text not null,
  email text,
  start_ts timestamptz not null,
  end_ts   timestamptz not null,
  status booking_status not null default 'confirmed',
  source text default 'web',
  created_at timestamptz not null default now(),
  reminder_sent boolean not null default false,
  during tstzrange generated always as (tstzrange(start_ts, end_ts, '[)')) stored
);

create index if not exists bookings_during_gist on bookings using gist (barber_id, during);
alter table bookings drop constraint if exists no_overlap;
alter table bookings add constraint no_overlap
  exclude using gist (barber_id with =, during with &&)
  where (status in ('pending','confirmed'));

-- Priority requests (does not block slot)
create table if not exists priority_requests (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references barbers(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  customer_name text not null,
  phone_e164 text not null,
  email text,
  desired_ts timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_bookings_barber_start on bookings (barber_id, start_ts);
create index if not exists idx_timeoff_barber_start on time_off (barber_id, start_ts);
create index if not exists idx_working_hours_barber_weekday on working_hours (barber_id, weekday);

-- Seed data
insert into barbers (name, photo_url, whatsapp_e164, sms_e164) values
('Adnan','https://placehold.co/128x128?text=Adnan',null,null),
('Astrit','https://placehold.co/128x128?text=Astrit',null,null)
on conflict do nothing;

insert into services (name, duration_min, price_cents, is_active)
values ('Haarschnitt', 30, 2000, true)
on conflict do nothing;

insert into barber_services
select b.id, s.id from barbers b cross join (select id from services where name='Haarschnitt' limit 1) s
on conflict do nothing;

-- Working hours Mon-Sat 10:00-20:00 for all barbers
do $$
declare d int;
begin
  for d in 1..6 loop
    insert into working_hours (barber_id, weekday, start_time, end_time)
    select id, d, time '10:00', time '20:00' from barbers
    on conflict do nothing;
  end loop;
end $$;
