// Ensures required env vars are present before any module under test calls getEnv().
// Tests that touch the database point at a dedicated `bizai_test` database so
// they never run against real dev/demo data.
process.env.MONGODB_URI ??= "mongodb://localhost:27017/bizai_test";
process.env.AUTH_SECRET ??= "test-secret-not-for-production-use-only";
// Keeps test document uploads out of the dev storage directory.
process.env.DOCUMENT_STORAGE_DIR ??= ".data/uploads-test";
// embedding-service's config module constructs a Google client at import
// time; tests that don't call the real embedding API (most of them) still
// need this to be a non-empty string for that construction to succeed.
process.env.GEMINI_API_KEY ??= "test-key-not-a-real-credential";
