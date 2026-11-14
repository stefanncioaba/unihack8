// AI cost box: the average total (one plan) or average per option (alternatives) under an answer, from the
// backend's `cost` field (docs/API.md -> AI assistant).
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { ChatCost } from '@/api/types.ai';
import AiScreen from '@/app/(tabs)/ai';
import { CostCard, costAccessibilityLabel, costLabel, formatLei, formatRange } from '@/features/ai/CostCard';
import { mockCost } from '@test/mocks/routes/ai';

import { renderScreen } from './testUtils';

/** Types a message and presses send. */
function say(text: string) {
  fireEvent.changeText(screen.getByLabelText('Message'), text);
  fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
}

const PLAN: ChatCost = {
  currency: 'RON',
  basis: 'TOTAL',
  items: [
    { label: '5 to go', detail: 'Espresso', kind: 'MENU', minLei: 5, maxLei: 5, averageLei: 5 },
    { label: 'Jazz Night', detail: 'Ticket', kind: 'EVENT', minLei: 40, maxLei: 60, averageLei: 50 },
  ],
  averageTotalLei: 55,
  minTotalLei: 45,
  maxTotalLei: 65,
  note: 'Saved menu prices; they may have changed.',
};

describe('cost formatting', () => {
  it('shows whole lei from 10 up and one decimal below', () => {
    expect(formatLei(37.2)).toBe('37');
    expect(formatLei(7.5)).toBe('7.5');
    expect(formatLei(5)).toBe('5');
  });

  it('collapses an equal range to one price', () => {
    expect(formatRange(5, 5)).toBe('5 lei');
    expect(formatRange(30, 45)).toBe('30–45 lei');
  });

  it('labels a plan as a total and alternatives as a per-option average', () => {
    expect(costLabel(PLAN)).toBe('Average total');
    expect(costLabel({ ...PLAN, basis: 'OPTIONS', items: [PLAN.items[0], { ...PLAN.items[0], label: 'Cafea' }] })).toBe('Average per option');
  });

  it('labels alternatives that come with something else (a place and an event) as a per-plan average', () => {
    expect(costLabel({ ...PLAN, basis: 'OPTIONS' })).toBe('Average per plan');
  });
});

describe('mockCost (same rule as the backend)', () => {
  const items = [
    { label: 'A', detail: 'x', kind: 'MENU' as const, minLei: 5, maxLei: 5, averageLei: 5 },
    { label: 'B', detail: 'x', kind: 'MENU' as const, minLei: 9, maxLei: 9, averageLei: 9 },
  ];

  it('sums one plan and averages alternatives', () => {
    expect(mockCost(PLAN.items, false)).toMatchObject({ basis: 'TOTAL', averageTotalLei: 55, minTotalLei: 45, maxTotalLei: 65 });
    expect(mockCost(items, true)).toMatchObject({ basis: 'OPTIONS', averageTotalLei: 7, minTotalLei: 5, maxTotalLei: 9 });
    expect(mockCost([], true)).toBeNull();
  });

  it('averages within a kind and adds the kinds up (two places to pick from, then a concert)', () => {
    const concert = { label: 'Rock', detail: 'Ticket', kind: 'EVENT' as const, minLei: 100, maxLei: 100, averageLei: 100 };
    expect(mockCost([...items, concert], true)).toMatchObject({ basis: 'OPTIONS', averageTotalLei: 107, minTotalLei: 105, maxTotalLei: 109 });
  });
});

describe('CostCard', () => {
  it('shows the big average, the label, the range and every line', () => {
    render(<CostCard cost={PLAN} />);
    expect(screen.getByTestId('chat-cost-total')).toHaveTextContent('≈ 55 lei');
    expect(screen.getByText('AVERAGE TOTAL')).toBeTruthy();
    expect(screen.getByTestId('chat-cost-range')).toHaveTextContent('45–65 lei');
    expect(within(screen.getByTestId('chat-cost-item-0')).getByText('5 lei')).toBeTruthy();
    expect(within(screen.getByTestId('chat-cost-item-1')).getByText('40–60 lei')).toBeTruthy();
    expect(screen.getByText('Saved menu prices; they may have changed.')).toBeTruthy();
  });

  it('has one accessible label with the whole cost', () => {
    render(<CostCard cost={PLAN} />);
    const label = costAccessibilityLabel(PLAN);
    expect(label).toBe('Average total: about 55 lei, range 45–65 lei. 5 to go, Espresso, 5 lei; Jazz Night, Ticket, 40–60 lei.');
    expect(screen.getByLabelText(label)).toBeTruthy();
  });

  it('renders nothing without a cost or without lines', () => {
    const { toJSON, rerender } = render(<CostCard cost={null} />);
    expect(toJSON()).toBeNull();
    rerender(<CostCard cost={{ ...PLAN, items: [] }} />);
    expect(toJSON()).toBeNull();
  });
});

describe('AiScreen cost box', () => {
  it('shows the average per option under an answer with alternatives', async () => {
    renderScreen(<AiScreen />);
    say('Where can I eat a cheap pizza?');
    const box = await screen.findByTestId('chat-cost');
    expect(within(box).getByText('AVERAGE PER OPTION')).toBeTruthy();
    // (37.5 + 34 + 40) / 3 = 37.2 -> "37"; cheapest 28, dearest 48.
    expect(within(box).getByTestId('chat-cost-total')).toHaveTextContent('≈ 37 lei');
    expect(within(box).getByTestId('chat-cost-range')).toHaveTextContent('28–48 lei');
    expect(within(box).getAllByTestId(/chat-cost-item-/)).toHaveLength(3);
  });

  it('shows the average total for a single plan', async () => {
    renderScreen(<AiScreen />);
    say('How do I get to a cafe?');
    const box = await screen.findByTestId('chat-cost');
    expect(within(box).getByText('AVERAGE TOTAL')).toBeTruthy();
    expect(within(box).getByTestId('chat-cost-total')).toHaveTextContent('≈ 7 lei');
  });

  it('shows no cost box when the answer has no stored price', async () => {
    renderScreen(<AiScreen />);
    say('coffee nearby?');
    expect(await screen.findByText(/cafés closest to you/)).toBeTruthy();
    expect(screen.queryByTestId('chat-cost')).toBeNull();
  });
});
