import { fireEvent, render, screen } from '@testing-library/react-native';
import { presetRange } from '@worktrail/types';
import { PeriodChips } from '../../src/components/admin/PeriodChips';

describe('PeriodChips', () => {
  it('offers the five presets and marks the selected one', () => {
    render(<PeriodChips value="this-week" onChange={jest.fn()} />);
    for (const l of ['Today', 'Yesterday', 'This week', 'Last week', 'This month']) {
      expect(screen.getByRole('button', { name: l })).toBeOnTheScreen();
    }
    expect(screen.queryByText('Custom')).toBeNull();
    expect(screen.getByRole('button', { name: 'This week' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('button', { name: 'Today' }).props.accessibilityState).toEqual({ selected: false });
  });

  it('reports the chosen preset', () => {
    const onChange = jest.fn();
    render(<PeriodChips value="today" onChange={onChange} />);
    fireEvent.press(screen.getByRole('button', { name: 'Yesterday' }));
    expect(onChange).toHaveBeenCalledWith('yesterday');
  });

  it('turns presets into Monday-based company-day ranges (2026-10-07 is a Wednesday)', () => {
    expect(presetRange('this-week', '2026-10-07')).toEqual({ from: '2026-10-05', to: '2026-10-07' });
    expect(presetRange('last-week', '2026-10-07')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(presetRange('yesterday', '2026-10-07')).toEqual({ from: '2026-10-06', to: '2026-10-06' });
  });
});
