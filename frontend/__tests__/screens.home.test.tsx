// Home tab and the All events screen.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/index';
import AllEventsScreen from '@/app/events/index';

import { IDS, mockRouter, renderScreen, setParams } from './testUtils';

describe('HomeScreen', () => {
  it('shows the city info strip and the upcoming events', async () => {
    renderScreen(<HomeScreen />);
    expect(await screen.findByText(/Last tram 2 from/)).toBeTruthy();
    expect(await screen.findByText('Board games night')).toBeTruthy();
    expect(screen.getByText('Upcoming events')).toBeTruthy();
    expect(screen.getByText('LIVE')).toBeTruthy();
  });

  it('shows date, place and free spots on a card', async () => {
    renderScreen(<HomeScreen />);
    const card = within(await screen.findByTestId(`event-card-${IDS.boardGames}`));
    expect(card.getByText('Board games night')).toBeTruthy();
    expect(card.getByText(/· 19:00$/)).toBeTruthy();
    expect(card.getByText('Scârț Loc Lejer')).toBeTruthy();
    expect(card.getByText('4 spots left')).toBeTruthy();
  });

  it('expands the transit alerts', async () => {
    renderScreen(<HomeScreen />);
    fireEvent.press(await screen.findByRole('button', { name: '1 transit alerts' }));
    expect(await screen.findByText('Tram traffic diverted in Piața Traian')).toBeTruthy();
  });

  it('filters the events row by category', async () => {
    renderScreen(<HomeScreen />);
    await screen.findByText('Board games night');
    fireEvent.press(screen.getByRole('button', { name: 'Sport' }));
    await waitFor(() => expect(screen.queryByText('Board games night')).toBeNull());
    expect(await screen.findByText('Sunset run by the Bega')).toBeTruthy();
  });

  it('opens an event, the search screen, the create form and the people search', async () => {
    renderScreen(<HomeScreen />);
    fireEvent.press(await screen.findByTestId(`event-card-${IDS.boardGames}`));
    expect(mockRouter.push).toHaveBeenCalledWith(`/events/${IDS.boardGames}`);

    fireEvent.press(screen.getByRole('search'));
    expect(mockRouter.push).toHaveBeenCalledWith('/events?focus=1');

    fireEvent.press(screen.getByRole('button', { name: 'Create an event' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/events/new');

    fireEvent.press(screen.getByRole('button', { name: 'Find people' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/users/search');

    fireEvent.press(screen.getByRole('link', { name: 'See all events' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/events');
  });

  it('shows an empty state when nothing matches', async () => {
    renderScreen(<HomeScreen />);
    await screen.findByText('Board games night');
    // The seed has no event in the "Other" category.
    fireEvent.press(screen.getByRole('button', { name: 'Other' }));
    expect(await screen.findByText('No upcoming events')).toBeTruthy();
  });
});

describe('AllEventsScreen', () => {
  it('lists upcoming events', async () => {
    renderScreen(<AllEventsScreen />);
    expect(await screen.findByText('Art walk through the old town')).toBeTruthy();
    expect(screen.getByText('All events')).toBeTruthy();
  });

  it('searches by title after a short pause', async () => {
    renderScreen(<AllEventsScreen />);
    await screen.findByText('Art walk through the old town');
    fireEvent.changeText(screen.getByLabelText('Search events'), 'pub quiz');
    expect(await screen.findByText('Pub quiz: general knowledge', {})).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Art walk through the old town')).toBeNull());
  });

  it('filters by category and by date', async () => {
    renderScreen(<AllEventsScreen />);
    await screen.findByText('Art walk through the old town');
    fireEvent.press(screen.getByRole('button', { name: 'Concert' }));
    await waitFor(() => expect(screen.queryByText('Art walk through the old town')).toBeNull());
    expect(screen.getByText('Indie rock night')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Concert' })); // deselect
    fireEvent.press(screen.getByRole('button', { name: 'Tomorrow' }));
    expect(await screen.findByText('Board games night')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Sunset run by the Bega')).toBeNull());
  });

  it('starts with the category passed in the route', async () => {
    setParams({ category: 'FOOD' });
    renderScreen(<AllEventsScreen />);
    expect(await screen.findByText('Street food weekend')).toBeTruthy();
    expect(screen.queryByText('Board games night')).toBeNull();
    expect(screen.getByRole('button', { name: 'Food', selected: true })).toBeTruthy();
  });

  it('loads the next page when scrolled to the end', async () => {
    const { client } = renderScreen(<AllEventsScreen />);
    const list = await screen.findByTestId('events-list');
    const pages = () => (client.getQueriesData({ queryKey: ['events', 'infinite'] })[0]?.[1] as { pages: unknown[] } | undefined)?.pages.length;
    expect(pages()).toBe(1);
    fireEvent(list, 'endReached');
    await waitFor(() => expect(pages()).toBe(2));
  });

  it('shows an empty state when nothing matches', async () => {
    renderScreen(<AllEventsScreen />);
    await screen.findByText('Art walk through the old town');
    fireEvent.changeText(screen.getByLabelText('Search events'), 'zzzz');
    expect(await screen.findByText('No events found', {})).toBeTruthy();
  });

  it('opens an event when tapped', async () => {
    renderScreen(<AllEventsScreen />);
    fireEvent.press(await screen.findByTestId(`event-row-${IDS.boardGames}`));
    expect(mockRouter.push).toHaveBeenCalledWith(`/events/${IDS.boardGames}`);
  });
});
