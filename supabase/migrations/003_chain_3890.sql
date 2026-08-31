-- KalyChain relaunch: the DAO now lives on chain id 3890 (KMT). The 3888/3889 fleets are gone.
-- votes_history / delegation_history hard-coded the old chain ids in CHECK constraints, so any
-- 3890 write fails until this runs. proposals.chain_id has no constraint (new rows use 3890;
-- old 3888 rows simply stop matching the lists).
--
-- The live constraints are named *_network_check (002_create_votes_history_table.sql:17 and the
-- hand-applied db_scripts/setup_delegation_history_table.sql:16) — NOT *_network_id_check. An
-- earlier version of this file dropped the wrong name, so its DROP matched nothing and the old
-- CHECK (network_id IN (3889, 3888)) survived; Postgres ANDs every CHECK, so 3890 writes still
-- failed. Drop BOTH names (the _id_ variant may exist if the old version of this file was run),
-- then recreate one correctly-named constraint that allows 3890.
ALTER TABLE public.votes_history DROP CONSTRAINT IF EXISTS votes_history_network_id_check;
ALTER TABLE public.votes_history DROP CONSTRAINT IF EXISTS votes_history_network_check;
ALTER TABLE public.votes_history ADD CONSTRAINT votes_history_network_check CHECK (network_id IN (3890, 3888, 3889));

ALTER TABLE public.delegation_history DROP CONSTRAINT IF EXISTS delegation_history_network_id_check;
ALTER TABLE public.delegation_history DROP CONSTRAINT IF EXISTS delegation_history_network_check;
ALTER TABLE public.delegation_history ADD CONSTRAINT delegation_history_network_check CHECK (network_id IN (3890, 3888, 3889));
