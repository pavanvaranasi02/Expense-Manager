// Controllable in-memory AsyncStorage + Firebase/NetInfo mocks for Node test runner.
// Allows simulating app restarts (preserving persisted storage while resetting store/locks)
// and simulating persistence failures.

const storageMap = new Map();
let failNextSetItem = false;

export const mockControl = {
  setFailNextWrite(val) {
    failNextSetItem = Boolean(val);
  },
  resetAll() {
    storageMap.clear();
    failNextSetItem = false;
  },
  getStorageSnapshot() {
    return Object.fromEntries(storageMap.entries());
  },
};

export const mockAsyncStorage = {
  async getItem(key) {
    return storageMap.has(key) ? storageMap.get(key) : null;
  },
  async setItem(key, value) {
    if (failNextSetItem) {
      failNextSetItem = false;
      throw new Error('Simulated AsyncStorage write failure');
    }
    storageMap.set(key, String(value));
  },
  async removeItem(key) {
    storageMap.delete(key);
  },
  async getAllKeys() {
    return Array.from(storageMap.keys());
  },
  async multiRemove(keys) {
    for (const k of keys) storageMap.delete(k);
  },
};

export const mockAuth = {
  currentUser: { uid: 'test-user-1' },
};

