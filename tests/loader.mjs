import { pathToFileURL } from 'node:url';

const MOCKS = new Set([
  '@react-native-async-storage/async-storage',
  '@react-native-community/netinfo',
  'firebase/firestore',
  'firebase/auth',
  'firebase/app',
  'firebase/analytics',
]);

export async function resolve(specifier, context, nextResolve) {
  if (MOCKS.has(specifier)) {
    return { shortCircuit: true, url: `file:///kosh-mock/${specifier}` };
  }
  if (specifier.endsWith('config/firebase') || specifier.endsWith('config/firebase.js')) {
    return { shortCircuit: true, url: 'file:///kosh-mock/config-firebase' };
  }
  if (specifier.endsWith('activityLogService') || specifier.endsWith('activityLogService.js')) {
    return { shortCircuit: true, url: 'file:///kosh-mock/activity-log' };
  }
  // Resolve extensionless relative JS imports from src/
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !specifier.endsWith('.js') &&
    !specifier.endsWith('.mjs') &&
    !specifier.endsWith('.json')
  ) {
    try {
      return await nextResolve(`${specifier}.js`, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}

const mockEnvUrl = pathToFileURL(
  `${process.cwd()}/tests/mockEnv.mjs`
).href;

export async function load(url, context, nextLoad) {
  if (url === 'file:///kosh-mock/@react-native-async-storage/async-storage') {
    return {
      shortCircuit: true,
      format: 'module',
      source: `import { mockAsyncStorage } from ${JSON.stringify(mockEnvUrl)}; export default mockAsyncStorage;`,
    };
  }
  if (url === 'file:///kosh-mock/@react-native-community/netinfo') {
    return {
      shortCircuit: true,
      format: 'module',
      source: `export default { fetch: async () => ({ isConnected: false, isInternetReachable: false }) };`,
    };
  }
  if (url === 'file:///kosh-mock/config-firebase') {
    return {
      shortCircuit: true,
      format: 'module',
      source: `import { mockAuth } from ${JSON.stringify(mockEnvUrl)}; export const auth = mockAuth; export const db = {}; export const Analytics = { screenView: () => {} };`,
    };
  }
  if (url === 'file:///kosh-mock/activity-log') {
    return {
      shortCircuit: true,
      format: 'module',
      source: `export const logUserAction = async () => {};`,
    };
  }
  if (url === 'file:///kosh-mock/firebase/firestore') {
    return {
      shortCircuit: true,
      format: 'module',
      source: `
        export class Timestamp {
          constructor(d) { this._d = d; }
          toDate() { return this._d; }
          static fromDate(d) { return new Timestamp(d); }
        }
        export const serverTimestamp = () => new Date().toISOString();
        export const increment = (n) => n;
        export const collection = () => ({});
        export const doc = () => ({ id: 'fs_mock_id' });
        export const query = () => ({});
        export const where = () => ({});
        export const orderBy = () => ({});
        export const getDocs = async () => ({ docs: [] });
        export const getDoc = async () => ({ exists: () => false });
        export const addDoc = async () => ({ id: 'fs_mock_id' });
        export const setDoc = async () => {};
        export const updateDoc = async () => {};
        export const deleteDoc = async () => {};
        export const writeBatch = () => ({
          set: () => {},
          update: () => {},
          delete: () => {},
          commit: async () => {},
        });
      `,
    };
  }
  return nextLoad(url, context);
}
