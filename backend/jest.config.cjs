module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.js'],
  transform: {},
  setupFiles: ['<rootDir>/test-env.cjs'],
  testTimeout: 30000,
}
