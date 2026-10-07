import { appendDictated, countLabel } from '../src/updates/update-logic';

describe('update logic', () => {
  it('appends spoken words with a single space and a capital after a full stop', () => {
    expect(appendDictated('Reached site.', 'checked the panel')).toEqual({ text: 'Reached site. Checked the panel', truncated: false });
    expect(appendDictated('', 'reached site')).toEqual({ text: 'Reached site', truncated: false });
    expect(appendDictated('Reached site ', 'and checked')).toEqual({ text: 'Reached site and checked', truncated: false });
  });

  it('never goes past 2,000 characters and says when words were dropped', () => {
    const r = appendDictated('x'.repeat(1995), 'hello there friend');
    expect(r.text.length).toBe(2000);
    expect(r.truncated).toBe(true);
  });

  it('counts characters after trimming', () => {
    expect(countLabel('  abc  ')).toBe('3 / 2000');
  });
});
