BEGIN;

ALTER TABLE attendance_config
    ADD COLUMN IF NOT EXISTS effective_from DATE NOT NULL DEFAULT DATE '2000-01-01',
    ADD COLUMN IF NOT EXISTS min_rest_normal_minutes INTEGER NOT NULL DEFAULT 480;

ALTER TABLE attendance_config
    ALTER COLUMN effective_from SET DEFAULT DATE '2000-01-01',
    ALTER COLUMN min_rest_normal_minutes SET DEFAULT 480;

UPDATE attendance_config
   SET effective_from = DATE '2000-01-01'
 WHERE effective_from IS NULL;

ALTER TABLE attendance_config
    ALTER COLUMN effective_from SET NOT NULL;

ALTER TABLE attendance_config
    DROP CONSTRAINT IF EXISTS ck_attendance_config_singleton;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_attendance_config_normal_rest'
    ) THEN
        ALTER TABLE attendance_config
            ADD CONSTRAINT ck_attendance_config_normal_rest
            CHECK (min_rest_normal_minutes >= 0);
    END IF;
END
$$;

DO $$
DECLARE
    id_is_identity TEXT;
BEGIN
    SELECT is_identity INTO id_is_identity
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'attendance_config'
       AND column_name = 'id';

    IF id_is_identity = 'NO' THEN
        CREATE SEQUENCE IF NOT EXISTS attendance_config_id_seq;
        ALTER SEQUENCE attendance_config_id_seq OWNED BY attendance_config.id;
        ALTER TABLE attendance_config ALTER COLUMN id DROP DEFAULT;
        ALTER TABLE attendance_config
            ALTER COLUMN id SET DEFAULT nextval('attendance_config_id_seq');
    END IF;
END
$$;

INSERT INTO attendance_config (effective_from)
SELECT DATE '2000-01-01'
 WHERE NOT EXISTS (SELECT 1 FROM attendance_config);

DO $$
DECLARE
    id_is_identity TEXT;
BEGIN
    SELECT is_identity INTO id_is_identity
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'attendance_config'
       AND column_name = 'id';

    IF id_is_identity = 'NO' THEN
        PERFORM setval(
            'attendance_config_id_seq',
            GREATEST((SELECT COALESCE(MAX(id), 0) FROM attendance_config), 1),
            TRUE
        );
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_config_effective_from
    ON attendance_config (effective_from);

COMMIT;
