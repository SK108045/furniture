import test from 'node:test';
import assert from 'node:assert/strict';
import {safeDestination, clerkHost} from '../src/scripts/auth-config.mjs';
test('return destinations stay on approved store pages', () => {
  for (const path of ['/account','/checkout','/collection']) assert.equal(safeDestination(path),path);
  for (const path of [null,'https://evil.example','//evil.example','/%2f%2fevil.example','/checkout?redirect=evil','javascript:alert(1)']) assert.equal(safeDestination(path),'/account');
});
test('valid Clerk keys resolve their frontend domain', () => {
  assert.equal(clerkHost('pk_test_'+btoa('example.clerk.accounts.dev$')),'example.clerk.accounts.dev');
  assert.equal(clerkHost('pk_live_'+btoa('clerk.nicoo.example$')),'clerk.nicoo.example');
});
test('malformed keys and unsafe script hosts are rejected', () => {
  for (const key of ['', 'sk_test_secret','pk_test_bad', 'pk_test_'+btoa('example.com/path$'),'pk_test_'+btoa('user@example.com$'),'pk_test_'+btoa('example.com'),'pk_test_'+btoa('example.com:3000$')]) assert.equal(clerkHost(key),null);
});
