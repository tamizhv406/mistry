import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkPasswordRecoveryUrl } from '../src/services/supabase';

describe('[Auth & Password Recovery] checkPasswordRecoveryUrl', () => {
  it('detects type=recovery in hash', () => {
    // Mock window
    const originalWindow = global.window;
    (global as any).window = {
      location: {
        hash: '#access_token=mocktoken123&refresh_token=mockref123&type=recovery',
        search: '',
        pathname: '/',
      },
    };

    assert.strictEqual(checkPasswordRecoveryUrl(), true, 'Should detect recovery hash');

    (global as any).window = {
      location: {
        hash: '#access_token=mocktoken123',
        search: '',
        pathname: '/',
      },
    };
    assert.strictEqual(checkPasswordRecoveryUrl(), false, 'Should be false when no type=recovery');

    (global as any).window = {
      location: {
        hash: '',
        search: '?type=recovery',
        pathname: '/',
      },
    };
    assert.strictEqual(checkPasswordRecoveryUrl(), true, 'Should detect recovery query param');

    (global as any).window = originalWindow;
    console.log('✓ Password recovery URL detection verified for hash and query parameters.');
  });
});
