-- Ensure deleting an organization row CASCADE-removes all dependent rows.
-- New org-scoped tables should FK to organizations(id) ON DELETE CASCADE from the start;
-- this migration upgrades existing constraints discovered in pg_catalog.

-- ---------------------------------------------------------------------------
-- 1) Every public FK whose referenced table is public.organizations
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  d text;
BEGIN
  FOR r IN
    SELECT
      c.conname,
      n.nspname AS sch,
      cl.relname AS tbl,
      pg_get_constraintdef(c.oid, true) AS def
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_class pf ON pf.oid = c.confrelid
    JOIN pg_namespace nf ON nf.oid = pf.relnamespace
    WHERE c.contype = 'f'
      AND nf.nspname = 'public'
      AND pf.relname = 'organizations'
      AND n.nspname = 'public'
      AND array_length(c.conkey, 1) = 1
  LOOP
    CONTINUE WHEN r.def ~* 'on delete cascade';
    d := regexp_replace(r.def, '\s+on delete\s+\w+(?:\s+\w+)?', '', 'gi');
    d := regexp_replace(d, '\s+on update\s+\w+(?:\s+\w+)?', '', 'gi');
    d := trim(d) || ' ON DELETE CASCADE';
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.sch, r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s', r.sch, r.tbl, r.conname, d);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) player_game_stats.game_id -> games(id)  (column exists without FK today)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.player_game_stats') IS NULL OR to_regclass('public.games') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    WHERE cl.relname = 'player_game_stats'
      AND c.conname = 'player_game_stats_game_id_fkey'
  ) THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'player_game_stats'
      AND column_name = 'game_id'
  ) THEN
    ALTER TABLE public.player_game_stats
      ADD CONSTRAINT player_game_stats_game_id_fkey
      FOREIGN KEY (game_id) REFERENCES public.games (id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'player_game_stats_game_id_fkey not applied (validate data): %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- 3) FKs referencing public.games(id) — ensure ON DELETE CASCADE from games
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  d text;
BEGIN
  FOR r IN
    SELECT
      c.conname,
      n.nspname AS sch,
      cl.relname AS tbl,
      pg_get_constraintdef(c.oid, true) AS def
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_class pf ON pf.oid = c.confrelid
    JOIN pg_namespace nf ON nf.oid = pf.relnamespace
    WHERE c.contype = 'f'
      AND nf.nspname = 'public'
      AND pf.relname = 'games'
      AND n.nspname = 'public'
      AND array_length(c.conkey, 1) = 1
  LOOP
    CONTINUE WHEN r.def ~* 'on delete cascade';
    d := regexp_replace(r.def, '\s+on delete\s+\w+(?:\s+\w+)?', '', 'gi');
    d := regexp_replace(d, '\s+on update\s+\w+(?:\s+\w+)?', '', 'gi');
    d := trim(d) || ' ON DELETE CASCADE';
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.sch, r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s', r.sch, r.tbl, r.conname, d);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4) FKs referencing public.dropin_sessions(id)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  d text;
BEGIN
  FOR r IN
    SELECT
      c.conname,
      n.nspname AS sch,
      cl.relname AS tbl,
      pg_get_constraintdef(c.oid, true) AS def
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_class pf ON pf.oid = c.confrelid
    JOIN pg_namespace nf ON nf.oid = pf.relnamespace
    WHERE c.contype = 'f'
      AND nf.nspname = 'public'
      AND pf.relname = 'dropin_sessions'
      AND n.nspname = 'public'
      AND array_length(c.conkey, 1) = 1
  LOOP
    CONTINUE WHEN r.def ~* 'on delete cascade';
    d := regexp_replace(r.def, '\s+on delete\s+\w+(?:\s+\w+)?', '', 'gi');
    d := regexp_replace(d, '\s+on update\s+\w+(?:\s+\w+)?', '', 'gi');
    d := trim(d) || ' ON DELETE CASCADE';
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.sch, r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s', r.sch, r.tbl, r.conname, d);
  END LOOP;
END $$;