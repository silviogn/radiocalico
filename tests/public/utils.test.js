import { describe, it, expect, beforeEach } from 'vitest';
import { makeSongId, esc, applyRating } from '../../public/js/utils.js';

describe('makeSongId', () => {
  it('lowercases and trims both parts', () => {
    expect(makeSongId('  The Beatles ', ' Hey Jude ')).toBe('the beatles::hey jude');
  });

  it('handles empty strings', () => {
    expect(makeSongId('', '')).toBe('::');
  });

  it('handles null/undefined', () => {
    expect(makeSongId(null, undefined)).toBe('::');
  });
});

describe('esc', () => {
  it('escapes ampersands', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;');
  });

  it('handles null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('leaves plain text unchanged', () => {
    expect(esc('hello world')).toBe('hello world');
  });
});

describe('applyRating', () => {
  let elements;

  beforeEach(() => {
    elements = {
      btnUp:    { classList: { toggle: vi.fn() }, disabled: true },
      btnDown:  { classList: { toggle: vi.fn() }, disabled: true },
      countUp:  { textContent: '' },
      countDown: { textContent: '' },
    };
  });

  it('sets vote counts', () => {
    applyRating({ thumbsUp: 5, thumbsDown: 2, myVote: null }, elements);
    expect(elements.countUp.textContent).toBe(5);
    expect(elements.countDown.textContent).toBe(2);
  });

  it('enables buttons', () => {
    applyRating({ thumbsUp: 0, thumbsDown: 0, myVote: null }, elements);
    expect(elements.btnUp.disabled).toBe(false);
    expect(elements.btnDown.disabled).toBe(false);
  });

  it('toggles voted-up class when myVote is up', () => {
    applyRating({ thumbsUp: 1, thumbsDown: 0, myVote: 'up' }, elements);
    expect(elements.btnUp.classList.toggle).toHaveBeenCalledWith('voted-up', true);
    expect(elements.btnDown.classList.toggle).toHaveBeenCalledWith('voted-down', false);
  });

  it('toggles voted-down class when myVote is down', () => {
    applyRating({ thumbsUp: 0, thumbsDown: 1, myVote: 'down' }, elements);
    expect(elements.btnUp.classList.toggle).toHaveBeenCalledWith('voted-up', false);
    expect(elements.btnDown.classList.toggle).toHaveBeenCalledWith('voted-down', true);
  });

  it('clears both vote classes when myVote is null', () => {
    applyRating({ thumbsUp: 0, thumbsDown: 0, myVote: null }, elements);
    expect(elements.btnUp.classList.toggle).toHaveBeenCalledWith('voted-up', false);
    expect(elements.btnDown.classList.toggle).toHaveBeenCalledWith('voted-down', false);
  });
});
