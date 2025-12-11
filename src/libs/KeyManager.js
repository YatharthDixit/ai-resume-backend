const config = require('../config');

class KeyManager {
  constructor(keys) {
    if (!keys || keys.length === 0) {
      throw new Error('KeyManager initialized with no keys.');
    }
    this.keys = keys;
    this.currentIndex = 0;
  }

  /**
   * Returns the current key.
   */
  getCurrentKey() {
    return this.keys[this.currentIndex];
  }

  /**
   * Rotates to the next key and returns it.
   */
  rotate() {
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return this.keys[this.currentIndex];
  }
}

// Singleton instance initialized with keys from config
const keyManager = new KeyManager(config.llm.apiKeys);

module.exports = keyManager;
