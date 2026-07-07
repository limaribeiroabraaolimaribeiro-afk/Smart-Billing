-- ============================================================
-- Smart Billing - Agendamento da cobranca automatica (Supabase Cron)
-- ============================================================
-- Substitui o antigo node-cron (que exigia um servidor Node ligado 24h).
-- Aqui usamos pg_cron (agenda a tarefa dentro do proprio Postgres do
-- Supabase) + pg_net (permite o Postgres fazer uma chamada HTTP) para
-- chamar a Edge Function "whatsapp-cron" uma vez por dia.
--
-- Como usar:
-- 1. No dashboard do Supabase, va em Database > Extensions e habilite
--    "pg_cron" e "pg_net" (ou rode os comandos abaixo no SQL Editor).
-- 2. Substitua:
--      <PROJECT_REF>   pelo ID do seu projeto Supabase (ex: abcdefghij)
--      <CRON_SECRET>   pelo mesmo valor configurado no secret CRON_SECRET
--                      da function whatsapp-cron
-- 3. Cole e execute este script no SQL Editor do Supabase.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove um agendamento anterior com o mesmo nome, se existir
-- (permite rodar este script novamente para atualizar o horario).
select cron.unschedule('smart-billing-whatsapp-cron')
where exists (
  select 1 from cron.job where jobname = 'smart-billing-whatsapp-cron'
);

-- Agenda a execucao diaria as 09:00 (horario UTC do servidor do Postgres).
-- Ajuste "0 9 * * *" conforme o fuso horario desejado.
select cron.schedule(
  'smart-billing-whatsapp-cron',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := jsonb_build_object('triggered_at', now())
  ) as request_id;
  $$
);

-- Para conferir os agendamentos ativos:
-- select * from cron.job;

-- Para conferir o historico de execucoes (sucesso/erro de cada chamada):
-- select * from cron.job_run_details order by start_time desc limit 20;
