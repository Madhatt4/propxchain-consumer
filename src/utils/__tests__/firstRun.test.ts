import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  hasSeenWelcomeCards,
  markWelcomeCardsSeen,
  resetWelcomeCards,
  hasDismissedDemoProperty,
  dismissDemoProperty,
} from '../firstRun';

const PRINCIPAL_A = 'aaaaa-bbbbb-ccccc';
const PRINCIPAL_B = 'ddddd-eeeee-fffff';

describe('firstRun', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('welcome cards', () => {
    it('should report not seen for a brand new user', () => {
      expect(hasSeenWelcomeCards(PRINCIPAL_A)).toBe(false);
    });

    it('should report seen once marked', () => {
      markWelcomeCardsSeen(PRINCIPAL_A);
      expect(hasSeenWelcomeCards(PRINCIPAL_A)).toBe(true);
    });

    it('should keep state separate per principal on a shared device', () => {
      markWelcomeCardsSeen(PRINCIPAL_A);
      expect(hasSeenWelcomeCards(PRINCIPAL_B)).toBe(false);
    });

    it('should show the cards again after a reset', () => {
      markWelcomeCardsSeen(PRINCIPAL_A);
      resetWelcomeCards(PRINCIPAL_A);
      expect(hasSeenWelcomeCards(PRINCIPAL_A)).toBe(false);
    });

    it('should not collide with the existing onboardingComplete flag', () => {
      window.localStorage.setItem('onboardingComplete', 'true');
      expect(hasSeenWelcomeCards(PRINCIPAL_A)).toBe(false);
    });

    it('should fall back to an unscoped key when there is no principal', () => {
      markWelcomeCardsSeen(null);
      expect(hasSeenWelcomeCards(null)).toBe(true);
      expect(hasSeenWelcomeCards(PRINCIPAL_A)).toBe(false);
    });
  });

  describe('demo property', () => {
    it('should not be dismissed for a new user', () => {
      expect(hasDismissedDemoProperty(PRINCIPAL_A)).toBe(false);
    });

    it('should stay dismissed once removed', () => {
      dismissDemoProperty(PRINCIPAL_A);
      expect(hasDismissedDemoProperty(PRINCIPAL_A)).toBe(true);
    });
  });

  describe('when localStorage is unavailable', () => {
    it('should report not seen rather than throwing when reading fails', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied');
      });
      expect(() => hasSeenWelcomeCards(PRINCIPAL_A)).not.toThrow();
      expect(hasSeenWelcomeCards(PRINCIPAL_A)).toBe(false);
    });

    it('should swallow write failures so the dashboard still renders', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded');
      });
      expect(() => markWelcomeCardsSeen(PRINCIPAL_A)).not.toThrow();
    });
  });
});
