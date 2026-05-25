create table employees (
  id uuid default gen_random_uuid() primary key,
  first_name text not null,
  last_name text not null,
  email text,
  access_code text not null,
  is_active boolean default true,
  is_admin boolean default false,
  created_at timestamptz default now()
);

alter table employees enable row level security;

create policy "allow all" on employees
  for all using (true) with check (true);
