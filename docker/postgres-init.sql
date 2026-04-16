-- =============================================================================
-- MaintainPro — PostgreSQL initialisation script
-- Runs once on first DB creation (docker-entrypoint-initdb.d).
-- =============================================================================

-- Full-text / trigram search used by machine and part name lookups
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- UUID generation used as default PK values (uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set the database timezone to Istanbul (UTC+3, covers DST correctly)
ALTER DATABASE maintainpro SET timezone TO 'Europe/Istanbul';
