-- =========================================================
-- Tabela de registro de estudos (por usuário)
-- =========================================================
create table if not exists estudo_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  assunto text,
  materia text,
  materia_emoji text,
  status text not null default 'Não iniciado',
  dificuldade text,
  tempo integer,
  data_revisao date,
  objetivo text,
  created_at timestamptz not null default now()
);

create index if not exists estudo_log_user_id_idx on estudo_log(user_id);

alter table estudo_log enable row level security;

-- Cada usuário só vê, cria, edita e apaga os PRÓPRIOS registros
drop policy if exists "Ver proprios registros" on estudo_log;
create policy "Ver proprios registros"
  on estudo_log for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Criar proprios registros" on estudo_log;
create policy "Criar proprios registros"
  on estudo_log for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Editar proprios registros" on estudo_log;
create policy "Editar proprios registros"
  on estudo_log for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Excluir proprios registros" on estudo_log;
create policy "Excluir proprios registros"
  on estudo_log for delete
  to authenticated
  using (user_id = auth.uid());
