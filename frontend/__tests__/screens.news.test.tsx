// Timișoara news (PLAN 26): time helpers, the Home strip, and the News screen with mock data.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Linking } from 'react-native';

import HomeScreen from '@/app/(tabs)/index';
import NewsScreen from '@/app/news/index';
import { newsAge, newsMeta } from '@/features/news/newsFormat';
import * as mocks from '@test/mocks';

import { mockRouter, renderScreen } from './testUtils';

const NOW = Date.parse('2026-11-14T18:00:00Z'); // 20:00 in Timișoara
const MIN = 60_000;

describe('news times', () => {
  it('says how old an article is', () => {
    expect(newsAge(new Date(NOW - 20_000).toISOString(), NOW)).toBe('Just now');
    expect(newsAge(new Date(NOW - 12 * MIN).toISOString(), NOW)).toBe('12 min ago');
    expect(newsAge(new Date(NOW - 3 * 60 * MIN).toISOString(), NOW)).toBe('3 h ago');
    expect(newsAge('2026-11-13T16:40:00Z', NOW)).toBe('Yesterday, 18:40');
    expect(newsAge('2026-11-10T09:00:00Z', NOW)).toMatch(/10 Nov/);
    expect(newsAge(null, NOW)).toBe('');
    expect(newsAge('nonsense', NOW)).toBe('');
  });

  it('joins the site and the age', () => {
    expect(newsMeta('TION', new Date(NOW - 5 * MIN).toISOString(), NOW)).toBe('TION · 5 min ago');
    expect(newsMeta('TION', null, NOW)).toBe('TION');
  });
});

describe('Home news strip', () => {
  it('shows the newest headlines and opens the News screen', async () => {
    renderScreen(<HomeScreen />);
    const strip = within(await screen.findByTestId('news-strip'));
    expect(strip.getByText('Timișoara news')).toBeTruthy();
    expect(await strip.findByText('Tramvaie noi pe linia 1 din Timișoara')).toBeTruthy();
    expect(strip.getByText('Concert gratuit în Piața Unirii')).toBeTruthy();
    fireEvent.press(strip.getByLabelText('See all news'));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/news'));
  });

  it('opens an article on the news site', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderScreen(<HomeScreen />);
    fireEvent.press(await screen.findByTestId('news-compact-n1'));
    expect(open).toHaveBeenCalledWith('https://www.tion.ro/exemplu-tramvaie/');
    open.mockRestore();
  });

  it('shows a quiet line when the news cannot be loaded, and Home still works', async () => {
    const real = mocks.mockRequest;
    const spy = jest.spyOn(mocks, 'mockRequest').mockImplementation((...args: Parameters<typeof real>) =>
      args[1].startsWith('/news') ? Promise.reject(new Error('down')) : real(...args),
    );
    renderScreen(<HomeScreen />);
    expect(await screen.findByTestId('news-strip-error')).toBeTruthy();
    expect(screen.getByText('Upcoming events')).toBeTruthy();
    spy.mockRestore();
  });
});

describe('NewsScreen', () => {
  it('lists every site newest first with summary, picture or placeholder, and age', async () => {
    renderScreen(<NewsScreen />);
    const first = within(await screen.findByTestId('news-card-n1'));
    expect(first.getByText('Tramvaie noi pe linia 1 din Timișoara')).toBeTruthy();
    expect(first.getByText('Primele tramvaie noi circulă de sâmbătă pe linia 1.')).toBeTruthy();
    expect(first.getByText(/^TION · \d+ min ago$/)).toBeTruthy();
    expect(first.getByTestId('news-image-n1')).toBeTruthy();
    expect(first.getByText('Read on TION')).toBeTruthy();
    expect(within(screen.getByTestId('news-card-n2')).getByTestId('news-image-n2-placeholder')).toBeTruthy();
    expect(within(screen.getByTestId('news-card-n5')).getByText('Opinia Timișoarei')).toBeTruthy();
  });

  it('filters by site and says which sites are down', async () => {
    renderScreen(<NewsScreen />);
    await screen.findByTestId('news-card-n1');
    expect(await screen.findByText('Not reachable right now: Timișoara Știri')).toBeTruthy();
    fireEvent.press(screen.getByTestId('news-source-banatulazi'));
    expect(await screen.findByTestId('news-card-n3')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('news-card-n1')).toBeNull());
    fireEvent.press(screen.getByTestId('news-source-all'));
    expect(await screen.findByTestId('news-card-n1')).toBeTruthy();
  });

  it('searches words in the headlines and summaries', async () => {
    renderScreen(<NewsScreen />);
    await screen.findByTestId('news-card-n1');
    fireEvent.changeText(screen.getByLabelText('Search news'), 'parcul');
    await waitFor(() => expect(screen.queryByTestId('news-card-n1')).toBeNull());
    expect(screen.getByTestId('news-card-n3')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Search news'), 'zzzzz');
    expect(await screen.findByText('No news found')).toBeTruthy();
  });

  it('opens the full story on the site', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderScreen(<NewsScreen />);
    fireEvent.press(await screen.findByTestId('news-card-n3'));
    expect(open).toHaveBeenCalledWith('https://www.banatulazi.ro/exemplu-parc/');
    open.mockRestore();
  });

  it('shows an error with retry when the news cannot be loaded', async () => {
    const spy = jest.spyOn(mocks, 'mockRequest').mockRejectedValue(new Error('boom'));
    renderScreen(<NewsScreen />);
    expect(await screen.findByText(/try again|retry/i)).toBeTruthy();
    spy.mockRestore();
  });
});
