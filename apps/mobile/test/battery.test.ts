jest.mock('expo-intent-launcher', () => ({ ActivityAction: {}, startActivityAsync: jest.fn() }));
jest.mock('../src/tracking/store', () => ({ getOutbox: jest.fn() }));
import { batteryStepsFor } from '../src/tracking/battery';

describe('batteryStepsFor', () => {
  it.each([
    ['samsung', 'Samsung'],
    ['Samsung', 'Samsung'],
    ['Xiaomi', 'Xiaomi / Redmi'],
    ['Redmi', 'Xiaomi / Redmi'],
    ['POCO', 'Xiaomi / Redmi'],
    ['realme', 'Oppo / Realme'],
    ['OPPO', 'Oppo / Realme'],
    ['OnePlus', 'Oppo / Realme'],
    ['vivo', 'Vivo'],
    ['iQOO', 'Vivo'],
  ])('matches %s', (maker, brand) => {
    expect(batteryStepsFor(maker)?.brand).toBe(brand);
    expect(batteryStepsFor(maker)?.steps.length).toBeGreaterThan(20);
  });

  it('returns nothing for other makers or an unknown one', () => {
    expect(batteryStepsFor('Motorola')).toBeNull();
    expect(batteryStepsFor(null)).toBeNull();
    expect(batteryStepsFor(undefined)).toBeNull();
  });
});
