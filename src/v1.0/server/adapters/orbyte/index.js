import { MockOrbyteAdapter } from './mockOrbyteAdapter.js';

export function createOrbyteAdapter(repositories) {
  return new MockOrbyteAdapter(repositories);
}

export { MockOrbyteAdapter };
