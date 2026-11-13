// Per-area mock switch (EXPO_PUBLIC_USE_MOCKS).
import { areaOf, isMockedPath, parseMockAreas } from '@/lib/mockAreas';

describe('parseMockAreas', () => {
  it('treats true / all as everything and false / empty as nothing', () => {
    expect(parseMockAreas('true')).toBe('all');
    expect(parseMockAreas(' ALL ')).toBe('all');
    expect(parseMockAreas('false')).toEqual([]);
    expect(parseMockAreas('')).toEqual([]);
    expect(parseMockAreas(undefined)).toEqual([]);
  });

  it('reads a comma-separated list of areas', () => {
    expect(parseMockAreas('ai, Events ,,places')).toEqual(['ai', 'events', 'places']);
  });
});

describe('isMockedPath', () => {
  it('finds the area from the first path segment', () => {
    expect(areaOf('/events/123/join')).toBe('events');
    expect(areaOf('/transit/stops?bbox=1')).toBe('transit');
    expect(areaOf('places')).toBe('places');
  });

  it('mocks everything for "all", only listed areas otherwise', () => {
    expect(isMockedPath('all', '/anything')).toBe(true);
    expect(isMockedPath([], '/events')).toBe(false);
    expect(isMockedPath(['ai', 'events'], '/events/1')).toBe(true);
    expect(isMockedPath(['ai', 'events'], '/ai/chat')).toBe(true);
    expect(isMockedPath(['ai', 'events'], '/places')).toBe(false);
  });
});
