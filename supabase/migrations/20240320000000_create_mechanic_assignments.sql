-- Create table for mechanic assignments
create table zadelenie_mechanikov (
    id uuid default gen_random_uuid() primary key,
    mechanik_id uuid references zamestnanci(id) on delete cascade,
    tyzden integer not null,
    rok integer not null,
    zmena text not null check (zmena in ('Ranná', 'Poobedná', 'Hotovosť')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(mechanik_id, tyzden, rok)
);

-- Create index for faster lookups
create index idx_zadelenie_mechanikov_lookup 
on zadelenie_mechanikov(tyzden, rok);

-- Enable RLS
alter table zadelenie_mechanikov enable row level security;

-- Create policy to allow authenticated users to read/write
create policy "Allow authenticated users to manage mechanic assignments"
on zadelenie_mechanikov for all
to authenticated
using (true)
with check (true);

-- Create function to update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
create trigger update_zadelenie_mechanikov_updated_at
    before update on zadelenie_mechanikov
    for each row
    execute function update_updated_at_column(); 