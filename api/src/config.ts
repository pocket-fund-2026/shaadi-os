export function readRuntimeConfig(env: Record<string, string | undefined> = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new Error('Production startup is disabled: authentication uses a fixed demo OTP and payments are simulated. Implement and test real authentication, and disable or replace simulated payments before enabling production.');
  }
  if (env.SEED_DEMO_DATA !== undefined && !['true', 'false'].includes(env.SEED_DEMO_DATA)) {
    throw new Error('SEED_DEMO_DATA must be true or false.');
  }
  return { seedDemoData: env.SEED_DEMO_DATA !== 'false' };
}
