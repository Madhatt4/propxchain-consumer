import { describe, it, expect } from 'vitest';
import { listingDescriptionText } from '../listingText';

describe('listingDescriptionText', () => {
  it('should return an empty string for null, undefined and empty input', () => {
    expect(listingDescriptionText(null)).toBe('');
    expect(listingDescriptionText(undefined)).toBe('');
    expect(listingDescriptionText('')).toBe('');
  });

  it('should leave plain text as it was', () => {
    expect(listingDescriptionText('  A three bedroom semi.  ')).toBe('A three bedroom semi.');
  });

  it('should drop paragraph tags and keep the paragraphs on their own lines', () => {
    const raw = '<p>A three bedroom semi.</p><p>Close to the station.</p>';
    expect(listingDescriptionText(raw)).toBe('A three bedroom semi.\nClose to the station.');
  });

  it('should turn <br> into a line break and decode entities', () => {
    expect(listingDescriptionText('Garden &amp; garage<br/>Freehold')).toBe('Garden & garage\nFreehold');
  });

  it('should turn non-breaking spaces into ordinary spaces', () => {
    expect(listingDescriptionText('<p>Two&nbsp;bedrooms</p>')).toBe('Two bedrooms');
  });

  it('should never keep script or style content, or any markup', () => {
    const raw = '<p onclick="x()">Hello</p><script>alert(1)</script><style>p{}</style><img src=x onerror=alert(1)>';
    const out = listingDescriptionText(raw);
    expect(out).toBe('Hello');
    expect(out).not.toMatch(/[<>]/);
  });
});
