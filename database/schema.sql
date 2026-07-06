-- ============================================================
-- Smart Billing - Schema do banco de dados (Supabase / PostgreSQL)
-- ============================================================
-- Como usar:
-- 1. Acesse o painel do Supabase do seu projeto
-- 2. Va em "SQL Editor" -> "New query"
-- 3. Cole todo o conteudo deste arquivo e execute (RUN)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabela: clients
-- ------------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela: charges (cobrancas)
-- status: pendente | pago | cancelado
-- (vence_hoje / atrasado sao calculados dinamicamente a partir de due_date
--  quando status = 'pendente', tanto no backend quanto nos filtros da listagem)
-- ------------------------------------------------------------
create table if not exists charges (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_name text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  payment_link text,
  mercado_pago_preference_id text,
  mercado_pago_payment_id text,
  payment_method text,
  paid_at timestamptz,
  receipt_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_charges_client_id on charges(client_id);
create index if not exists idx_charges_status on charges(status);
create index if not exists idx_charges_due_date on charges(due_date);

-- ------------------------------------------------------------
-- Tabela: payment_logs (historico de retornos do Mercado Pago)
-- ------------------------------------------------------------
create table if not exists payment_logs (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid references charges(id) on delete cascade,
  mercado_pago_payment_id text,
  status text,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_logs_charge_id on payment_logs(charge_id);

-- ------------------------------------------------------------
-- Tabela: receipt_logs (historico de recibos gerados)
-- ------------------------------------------------------------
create table if not exists receipt_logs (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid references charges(id) on delete cascade,
  receipt_number text not null,
  generated_at timestamptz not null default now()
);

create index if not exists idx_receipt_logs_charge_id on receipt_logs(charge_id);

-- ------------------------------------------------------------
-- Tabela: whatsapp_messages (mensagens de cobranca manuais e automaticas)
-- message_type: manual | before_due | due_today | overdue
-- status: pending | sent | failed
-- ------------------------------------------------------------
create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid references charges(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  message_type text not null check (message_type in ('manual', 'before_due', 'due_today', 'overdue')),
  message_text text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_messages_charge_id on whatsapp_messages(charge_id);

-- ------------------------------------------------------------
-- Tabela: settings (configuracoes gerais do sistema)
-- ------------------------------------------------------------
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text,
  updated_at timestamptz not null default now()
);

-- Configuracoes padrao
insert into settings (key, value)
values
  ('company_name', 'Smart Billing'),
  ('currency', 'BRL')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- Trigger generico para manter updated_at atualizado
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();

drop trigger if exists trg_charges_updated_at on charges;
create trigger trg_charges_updated_at
  before update on charges
  for each row execute function set_updated_at();

-- ============================================================
-- Observacao sobre RLS (Row Level Security):
-- Este backend acessa o Supabase usando a SERVICE ROLE KEY,
-- exclusivamente pelo servidor Node/Express (nunca pelo navegador).
-- Por isso as tabelas acima nao precisam de policies de RLS para o
-- funcionamento do sistema. Caso deseje habilitar RLS por seguranca
-- extra, mantenha todo o acesso exclusivamente via service role.
-- ============================================================
