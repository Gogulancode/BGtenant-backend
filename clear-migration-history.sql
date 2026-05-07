-- Clear migration history for the failed migration
DELETE FROM "_prisma_migrations" WHERE migration_name = '20251114062121_add_multi_tenant_support';
