-- ============================================================
-- LUMOS Tables (prefix: lumos_)
-- ⚠️ 기존 테이블 절대 건드리지 않음:
--   daily_usage, digests, entity_aliases, entity_clusters,
--   group_links, group_settings, interest_categories, landing_carousel,
--   link_entities, link_tags, links, payment_logs, subscriptions,
--   summaries, telegram_link_codes, user_interests, user_preferences
-- ============================================================

-- Members
CREATE TABLE IF NOT EXISTS lumos_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar TEXT,
  role_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cases
CREATE TABLE IF NOT EXISTS lumos_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  description TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS lumos_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES lumos_cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  label TEXT NOT NULL DEFAULT '분석',
  assignee_id UUID REFERENCES lumos_members(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Artifacts
CREATE TABLE IF NOT EXISTS lumos_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES lumos_cases(id) ON DELETE CASCADE,
  task_id UUID REFERENCES lumos_tasks(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'link',
  url TEXT DEFAULT '',
  content TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Discussions
CREATE TABLE IF NOT EXISTS lumos_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES lumos_cases(id) ON DELETE CASCADE,
  task_id UUID REFERENCES lumos_tasks(id) ON DELETE SET NULL,
  author_id UUID REFERENCES lumos_members(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Weeklies
CREATE TABLE IF NOT EXISTS lumos_weeklies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_label TEXT NOT NULL,
  week_start DATE NOT NULL,
  goals TEXT[] DEFAULT '{}',
  active_case_ids UUID[] DEFAULT '{}',
  mentoring_agenda TEXT DEFAULT '',
  mentoring_feedback TEXT DEFAULT '',
  mentoring_action_items TEXT[] DEFAULT '{}',
  carry_over TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notes
CREATE TABLE IF NOT EXISTS lumos_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  author_id UUID REFERENCES lumos_members(id) ON DELETE SET NULL,
  linked_case_id UUID REFERENCES lumos_cases(id) ON DELETE SET NULL,
  linked_weekly_id UUID REFERENCES lumos_weeklies(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Auto-update timestamp trigger
-- ============================================================
CREATE OR REPLACE FUNCTION lumos_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'lumos_members', 'lumos_cases', 'lumos_tasks',
    'lumos_artifacts', 'lumos_discussions', 'lumos_weeklies', 'lumos_notes'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || tbl || '_updated', tbl);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION lumos_update_timestamp()',
      'trg_' || tbl || '_updated', tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- RLS: upsidelumos@gmail.com 만 lumos_ 테이블 접근 가능
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'lumos_members', 'lumos_cases', 'lumos_tasks',
    'lumos_artifacts', 'lumos_discussions', 'lumos_weeklies', 'lumos_notes'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS lumos_email_access ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY lumos_email_access ON %I FOR ALL TO authenticated USING (auth.jwt() ->> ''email'' = ''upsidelumos@gmail.com'') WITH CHECK (auth.jwt() ->> ''email'' = ''upsidelumos@gmail.com'')',
      tbl
    );
  END LOOP;
END $$;
