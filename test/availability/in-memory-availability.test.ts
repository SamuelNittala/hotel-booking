import { describe, it } from 'vitest';

describe('InMemoryAvailability', () => {
  it.todo('back-to-back stays on the same room both succeed');
  it.todo('an overlapping reservation is rejected with RoomUnavailableError');
  it.todo('releasing a booking frees only that booking\'s nights');
  it.todo('releasing the same booking twice behaves as decided');
  it.todo('two simultaneous reserves for the last room: exactly one succeeds');
});
