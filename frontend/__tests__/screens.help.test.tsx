// Neighbour Help Board (PLAN 25): text helpers, board, ask-for-help form, request page, helper code, scanner,
// the Home entry point and the HELPED reliability label.
import { act, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { ApiError } from '@/api/errors';
import HomeScreen from '@/app/(tabs)/index';
import HelpBoardScreen from '@/app/help/index';
import HelpRequestScreen from '@/app/help/[id]/index';
import HelpScanScreen from '@/app/help/[id]/scan';
import HelpTicketScreen from '@/app/help/[id]/ticket';
import NewHelpRequestScreen from '@/app/help/new';
import { helpOutcomeFromError, helpOutcomeFromSuccess } from '@/features/help/checkInResult';
import { expiresIn, filterByCategory, myOfferLabel, offersLabel, statusLine, ticketState, timeAgo } from '@/features/help/format';
import { emptyHelpForm, validateHelpForm } from '@/features/help/newHelpForm';
import { LocationProvider } from '@/features/location/LocationProvider';
import { ReliabilityLog } from '@/features/users/ReliabilityLog';
import { entrySubject, reasonLabel } from '@/features/users/reliability';
import { useHelpBoard } from '@/hooks/useHelp';
import { createQueryClient } from '@/lib/queryClient';
import * as mocks from '@test/mocks';

import { HELP, IDS, mockRouter, renderScreen, setParams } from './testUtils';

const NOW = Date.parse('2026-11-14T17:00:00Z');
const minutes = (m: number) => new Date(NOW - m * 60_000).toISOString();

/** Presses a button of the last Alert.alert call. */
function confirmAlert(spy: jest.SpyInstance, label: string) {
  const buttons = spy.mock.calls[spy.mock.calls.length - 1][2] as { text: string; onPress?: () => void }[];
  act(() => buttons.find((b) => b.text === label)!.onPress?.());
}

describe('help text helpers', () => {
  it('says how long ago a request was posted and when it expires', () => {
    expect(timeAgo(minutes(0.5), NOW)).toBe('Just now');
    expect(timeAgo(minutes(12), NOW)).toBe('12 min ago');
    expect(timeAgo(minutes(180), NOW)).toBe('3 h ago');
    expect(timeAgo(minutes(3000), NOW)).toBe('2 d ago');
    expect(expiresIn(minutes(-23 * 60 - 30), NOW)).toBe('Expires in 23 h');
    expect(expiresIn(minutes(-40), NOW)).toBe('Expires in 40 min');
    expect(expiresIn(minutes(1), NOW)).toBe('Expired');
  });

  it('counts offers and names statuses', () => {
    expect(offersLabel(0)).toBe('No offers yet');
    expect(offersLabel(1)).toBe('1 offer');
    expect(offersLabel(3)).toBe('3 offers');
    const user = { id: 'u', username: 'stella_99', reliabilityScore: 95 };
    expect(statusLine({ status: 'HELPED', helper: user, expiresAt: minutes(-60) }, NOW)).toBe('Helped by stella_99');
    expect(statusLine({ status: 'OPEN', helper: null, expiresAt: minutes(-120) }, NOW)).toBe('Open · expires in 2 h');
    expect(statusLine({ status: 'OPEN', helper: null, expiresAt: minutes(5) }, NOW)).toBe('Expired');
    expect(statusLine({ status: 'CANCELLED', helper: null, expiresAt: minutes(-60) }, NOW)).toBe('Cancelled');
    expect(myOfferLabel('OFFERED')).toBe('You offered');
    expect(myOfferLabel('HELPED')).toBe('You helped · +5');
    expect(myOfferLabel('NOT_NEEDED')).toBe('Not needed');
    expect(myOfferLabel('WITHDRAWN')).toBeNull();
    expect(myOfferLabel(null)).toBeNull();
  });

  it('filters by category and describes ticket states', () => {
    const list = [{ category: 'PETS' as const }, { category: 'CARRY' as const }];
    expect(filterByCategory(list, [])).toHaveLength(2);
    expect(filterByCategory(list, ['PETS'])).toEqual([{ category: 'PETS' }]);
    expect(ticketState('OFFERED', 'andrei_tm', false)).toMatchObject({ chip: 'Offered', text: expect.stringContaining('andrei_tm') });
    expect(ticketState('OFFERED', 'andrei_tm', true).chip).toBe('Closed');
    expect(ticketState('HELPED', 'andrei_tm', true).chip).toBe('You helped · +5');
    expect(ticketState('NOT_NEEDED', 'andrei_tm', true).chip).toBe('Not needed');
  });

  it('turns scan answers and errors into result cards', () => {
    expect(helpOutcomeFromSuccess({ user: { id: 'u', username: 'stella_99', reliabilityScore: 95 }, status: 'HELPED', pointsChange: 5 })).toEqual({
      kind: 'success',
      title: 'stella_99 helped you',
      message: '+5 civic trust for stella_99 · score is now 95',
    });
    expect(helpOutcomeFromError(new ApiError(409, 'HELP_CLOSED', 'x')).title).toBe('Request already closed');
    expect(helpOutcomeFromError(new ApiError(409, 'WRONG_REQUEST', 'x')).title).toBe('Wrong request');
    expect(helpOutcomeFromError(new ApiError(409, 'NOT_OFFERED', 'x')).title).toBe('Offer withdrawn');
    expect(helpOutcomeFromError(new ApiError(404, 'TICKET_NOT_FOUND', 'x')).kind).toBe('error');
    expect(helpOutcomeFromError(new ApiError(403, 'NOT_REQUESTER', 'x'))).toEqual({
      kind: 'error',
      title: 'Scan failed',
      message: 'Only the person who asked for help can do this.',
    });
  });
});

describe('validateHelpForm', () => {
  it('mirrors the API rules', () => {
    const base = { ...emptyHelpForm(), title: 'Borrow a drill', category: 'BORROW' as const, point: { lat: 45.75, lon: 21.22 } };
    expect(validateHelpForm(emptyHelpForm()).errors).toEqual({
      title: 'Say what you need help with.',
      category: 'Pick a category.',
      point: 'Pin where you need help.',
    });
    expect(validateHelpForm(base).payload).not.toBeNull();
    expect(validateHelpForm({ ...base, title: ' ab ' }).errors.title).toBe('Use at least 3 characters.');
    expect(validateHelpForm({ ...base, title: 'x'.repeat(81) }).errors.title).toBe('Keep the title under 80 characters.');
    expect(validateHelpForm({ ...base, description: 'x'.repeat(501) }).errors.description).toBe('Keep the description under 500 characters.');
    expect(validateHelpForm({ ...base, address: 'x'.repeat(121) }).errors.address).toBe('Keep the address under 120 characters.');
    expect(validateHelpForm({ ...base, point: { lat: 200, lon: 0 } }).errors.point).toBeTruthy();
  });

  it('builds a trimmed body with the pin and only the filled optional fields', () => {
    expect(
      validateHelpForm({ ...emptyHelpForm(), title: ' Borrow a drill ', category: 'BORROW', description: '  ', point: { lat: 45.75, lon: 21.22 } }).payload,
    ).toEqual({ title: 'Borrow a drill', category: 'BORROW', lat: 45.75, lon: 21.22 });
    expect(
      validateHelpForm({ title: 'Borrow a drill', category: 'BORROW', description: ' Ten minutes ', address: ' Strada Paris 1 ', point: { lat: 45.75, lon: 21.22 } }).payload,
    ).toEqual({ title: 'Borrow a drill', category: 'BORROW', description: 'Ten minutes', address: 'Strada Paris 1', lat: 45.75, lon: 21.22 });
  });
});

describe('HelpBoardScreen', () => {
  it('lists open requests with requester, civic trust, offers and timing', async () => {
    renderScreen(<HelpBoardScreen />);
    const card = within(await screen.findByTestId(`help-card-${HELP.ladder}`));
    expect(card.getByText('Borrow a ladder for 30 minutes')).toBeTruthy();
    expect(card.getByText('stefan')).toBeTruthy();
    expect(card.getByLabelText('Civic trust 115')).toBeTruthy();
    expect(card.getByText(/^1 offer · 1 h ago · Expires in 2[23] h$/)).toBeTruthy();
    expect(card.getByText('Strada Paris 12')).toBeTruthy();
    expect(within(screen.getByTestId(`help-card-${HELP.dogWalk}`)).getByText('You offered')).toBeTruthy();
    // Expired and closed requests are not on the board.
    expect(screen.queryByText('Water my plants while I am away')).toBeNull();
    expect(screen.queryByText('Carry groceries from the market')).toBeNull();
  });

  it('filters by category and shows an empty state', async () => {
    renderScreen(<HelpBoardScreen />);
    await screen.findByTestId(`help-card-${HELP.ladder}`);
    fireEvent.press(screen.getByRole('button', { name: 'Pets' }));
    expect(screen.getByText('Walk my dog this evening')).toBeTruthy();
    expect(screen.queryByText('Borrow a ladder for 30 minutes')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Pets' }));
    fireEvent.press(screen.getByRole('button', { name: 'Other' }));
    expect(screen.getByText('Nothing in these categories')).toBeTruthy();
  });

  it('opens a request and the form', async () => {
    renderScreen(<HelpBoardScreen />);
    fireEvent.press(await screen.findByTestId(`help-card-${HELP.ladder}`));
    expect(mockRouter.push).toHaveBeenCalledWith(`/help/${HELP.ladder}`);
    fireEvent.press(screen.getByRole('button', { name: 'Ask for help' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/help/new');
  });

  it('shows my requests and offers, in every status, under "Mine"', async () => {
    renderScreen(<HelpBoardScreen />);
    await screen.findByTestId(`help-card-${HELP.ladder}`);
    fireEvent.press(screen.getByRole('button', { name: 'Mine' }));
    expect(await screen.findByText('You asked (1)')).toBeTruthy();
    expect(screen.getByText('You offered (2)')).toBeTruthy();
    expect(screen.getByText('Help carrying a sofa to the 3rd floor')).toBeTruthy();
    expect(within(screen.getByTestId(`help-card-${HELP.groceries}`)).getByText('Helped')).toBeTruthy();
  });

  it('groups nearby requests by neighbourhood, mine first and the ones outside last', async () => {
    renderScreen(
      <LocationProvider>
        <HelpBoardScreen />
      </LocationProvider>,
    );
    const here = await screen.findByTestId('help-area-cetate');
    expect(within(here).getByText("YOU'RE HERE")).toBeTruthy();
    const outside = screen.getByTestId('help-area-outside');
    expect(within(outside).getByText(/^Outside the neighbourhoods \(\d+\)$/)).toBeTruthy();
    // Areas with no open requests get no section.
    expect(screen.queryByTestId('help-area-somewhere-new')).toBeNull();
    // Cetate's header comes before its requests, and those come before the outside section.
    const order = screen.root
      .findAll((n: { props: { testID?: unknown } }) => typeof n.props.testID === 'string' && /^help-(area|card)-/.test(n.props.testID))
      .map((n: { props: { testID?: unknown } }) => n.props.testID as string)
      .filter((id: string, i: number, all: string[]) => all.indexOf(id) === i);
    expect(order.indexOf('help-area-cetate')).toBeLessThan(order.indexOf(`help-card-${HELP.dogWalk}`));
    expect(order.indexOf(`help-card-${HELP.dogWalk}`)).toBeLessThan(order.indexOf('help-area-outside'));
    expect(order.indexOf('help-area-outside')).toBeLessThan(order.indexOf(`help-card-${HELP.ladder}`));
  });

  it('says when nobody needs help, and shows errors with retry', async () => {
    const spy = jest.spyOn(mocks, 'mockRequest').mockResolvedValue([]);
    renderScreen(<HelpBoardScreen />);
    expect(await screen.findByText('Nobody needs help right now')).toBeTruthy();
    spy.mockRejectedValue(new Error('boom'));
    fireEvent.press(screen.getByRole('button', { name: 'Mine' }));
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    spy.mockRestore();
  });
});

describe('NewHelpRequestScreen', () => {
  it('shows what is missing when submitted empty', () => {
    renderScreen(<NewHelpRequestScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Post request' }));
    expect(screen.getByText('Say what you need help with.')).toBeTruthy();
    expect(screen.getByText('Pick a category.')).toBeTruthy();
    // Without a known position nothing is pinned, so the pin is asked for too.
    expect(screen.getByText('Pin where you need help.')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('counts description characters and refuses a too short title', () => {
    renderScreen(<NewHelpRequestScreen />);
    fireEvent.changeText(screen.getByLabelText('Details (optional)'), 'Hello');
    expect(screen.getByTestId('description-counter').props.children.join('')).toBe('5/500');
    fireEvent.changeText(screen.getByLabelText('What do you need?'), 'ab');
    fireEvent.press(screen.getByRole('button', { name: 'Pets' }));
    expect(screen.getByText('Walk or feed a pet')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Post request' }));
    expect(screen.getByText('Use at least 3 characters.')).toBeTruthy();
  });

  it('posts a request with an address and a pin, then opens it', async () => {
    renderScreen(<NewHelpRequestScreen />);
    fireEvent.changeText(screen.getByLabelText('What do you need?'), 'Borrow a drill');
    fireEvent.press(screen.getByRole('button', { name: 'Borrow' }));
    fireEvent.changeText(screen.getByLabelText('Address (optional)'), 'Strada Paris 1');
    fireEvent.press(screen.getByRole('button', { name: 'Choose on map' }));
    fireEvent(await screen.findByTestId('picker-map'), 'press', { nativeEvent: { coordinate: { latitude: 45.75, longitude: 21.22 } } });
    fireEvent.press(screen.getByRole('button', { name: 'Use this location' }));
    expect(screen.getByRole('button', { name: 'Pinned at 45.7500, 21.2200' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Post request' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/help\/d0000000/)));
    const created = mocks.getMockState().helpRequests.find((r) => r.title === 'Borrow a drill')!;
    expect(created).toMatchObject({ category: 'BORROW', address: 'Strada Paris 1', lat: 45.75, lon: 21.22 });
  });

  it('pins the request where I am, and a spot I choose replaces it', async () => {
    renderScreen(
      <LocationProvider>
        <NewHelpRequestScreen />
      </LocationProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Pinned at 45.7600, 21.2300' })).toBeTruthy();
    expect(screen.getByText('Set to where you are now. Tap to move it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove pin' })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Pinned at 45.7600, 21.2300' }));
    fireEvent(await screen.findByTestId('picker-map'), 'press', { nativeEvent: { coordinate: { latitude: 45.75, longitude: 21.22 } } });
    fireEvent.press(screen.getByRole('button', { name: 'Use this location' }));
    expect(screen.getByRole('button', { name: 'Pinned at 45.7500, 21.2200' })).toBeTruthy();
    expect(screen.getByText('Your request shows up in the neighbourhood of this pin.')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('What do you need?'), 'Borrow a hammer');
    fireEvent.press(screen.getByRole('button', { name: 'Borrow' }));
    fireEvent.press(screen.getByRole('button', { name: 'Post request' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(mocks.getMockState().helpRequests.find((r) => r.title === 'Borrow a hammer')).toMatchObject({ lat: 45.75, lon: 21.22 });
  });
});

describe('HelpRequestScreen as a neighbour', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the request, the requester with civic trust and the offers', async () => {
    setParams({ id: HELP.ladder });
    renderScreen(<HelpRequestScreen />);
    expect(await screen.findByText('Borrow a ladder for 30 minutes')).toBeTruthy();
    expect(screen.getByText('Changing a bulb in the hallway.')).toBeTruthy();
    expect(screen.getByText(/^Open · expires in 2[23] h$/)).toBeTruthy();
    expect(screen.getByText('Strada Paris 12')).toBeTruthy();
    expect(screen.getByText('Offers (1)')).toBeTruthy();
    expect(within(screen.getByTestId('offer-stella_99')).getByLabelText('Civic trust 90')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Requester stefan' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/users/22222222-2222-4222-8222-222222222222');
    fireEvent.press(screen.getByRole('button', { name: 'Open profile of stella_99' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/users/${IDS.stella}`);
  });

  it('offers to help, opens the QR code, withdraws and can offer again', async () => {
    setParams({ id: HELP.ladder });
    renderScreen(<HelpRequestScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Offer to help' }));
    fireEvent.press(await screen.findByRole('button', { name: 'My QR code' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/help/${HELP.ladder}/ticket`);
    expect(screen.getByText('Offers (2)')).toBeTruthy();
    expect(screen.getByText('demo_user')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Withdraw offer' }));
    expect(await screen.findByRole('button', { name: 'Offer to help' })).toBeTruthy();
    expect(screen.getByText('Offers (1)')).toBeTruthy();
  });

  it('shows the map button and an error from a refused offer', async () => {
    setParams({ id: HELP.ladder });
    const real = mocks.mockRequest;
    jest.spyOn(mocks, 'mockRequest').mockImplementation(async (method, path, query, body) => {
      if (method === 'POST' && path.endsWith('/offers')) throw new ApiError(409, 'HELP_CLOSED', 'closed');
      return real(method, path, query, body);
    });
    renderScreen(<HelpRequestScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Show on map' }));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/map', params: expect.objectContaining({ lat: '45.7489', lon: '21.2318' }) }));
    fireEvent.press(screen.getByRole('button', { name: 'Offer to help' }));
    expect(await screen.findByText(/This help request is closed/)).toBeTruthy();
  });

  it('shows who helped and that my offer was not needed', async () => {
    setParams({ id: HELP.groceries });
    renderScreen(<HelpRequestScreen />);
    expect(await screen.findByText('Helped by andrei_tm')).toBeTruthy();
    expect(screen.getByText(/Not needed: someone else helped first/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Offer to help' })).toBeNull();
    expect(within(screen.getByTestId('offer-andrei_tm')).getByText('Helped')).toBeTruthy();
  });

  it('shows an expired request without actions', async () => {
    setParams({ id: HELP.plants });
    renderScreen(<HelpRequestScreen />);
    expect(await screen.findByTestId('help-status')).toBeTruthy();
    expect(within(screen.getByTestId('help-status')).getByText('Expired')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Offer to help' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show on map' })).toBeTruthy();
  });

  it('shows an error with retry for an unknown request', async () => {
    setParams({ id: 'nope' });
    renderScreen(<HelpRequestScreen />);
    expect(await screen.findByText('We could not find that.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('HelpRequestScreen as the requester', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lists the helpers to choose from and opens the scanner', async () => {
    setParams({ id: HELP.sofa });
    renderScreen(<HelpRequestScreen />);
    expect(await screen.findByText('Asked by you')).toBeTruthy();
    expect(screen.getByText('Offers (2)')).toBeTruthy();
    expect(screen.getByTestId('offer-stella_99')).toBeTruthy();
    expect(screen.getByTestId('offer-andrei_tm')).toBeTruthy();
    expect(screen.queryByTestId('offer-maria_c')).toBeNull();
    expect(screen.getByText(/Pick someone you trust/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Offer to help' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Scan helper’s QR' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/help/${HELP.sofa}/scan`);
  });

  it('asks before cancelling, then shows the request as cancelled', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    setParams({ id: HELP.sofa });
    renderScreen(<HelpRequestScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Cancel request' }));
    expect(alert).toHaveBeenCalledWith('Cancel this request?', expect.stringContaining('No points change'), expect.any(Array));
    confirmAlert(alert, 'Cancel request');
    await waitFor(() => expect(within(screen.getByTestId('help-status')).getByText('Cancelled')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Scan helper’s QR' })).toBeNull();
  });
});

describe('HelpTicketScreen', () => {
  it('draws the QR code of my helper token while the request is open', async () => {
    setParams({ id: HELP.dogWalk });
    renderScreen(<HelpTicketScreen />);
    expect((await screen.findByTestId('qr-code')).props.children).toBe('demo-help-ticket-me-3');
    expect(screen.getByText('Offered')).toBeTruthy();
    expect(await screen.findByText(/Show this code to andrei_tm/)).toBeTruthy();
  });

  it('says when my help was not needed, without a QR code', async () => {
    setParams({ id: HELP.groceries });
    renderScreen(<HelpTicketScreen />);
    expect(await screen.findByText('Not needed')).toBeTruthy();
    expect(screen.getByText(/Someone else helped first/)).toBeTruthy();
    expect(screen.queryByTestId('qr-code')).toBeNull();
  });

  it('shows "You helped" once I was scanned', async () => {
    mocks.getMockState().helpRequests.find((r) => r.id === HELP.dogWalk)!.offers[0].status = 'HELPED';
    setParams({ id: HELP.dogWalk });
    renderScreen(<HelpTicketScreen />);
    expect(await screen.findByText('You helped · +5')).toBeTruthy();
    expect(screen.queryByTestId('qr-code')).toBeNull();
  });

  it('explains when I have not offered', async () => {
    setParams({ id: HELP.ladder });
    renderScreen(<HelpTicketScreen />);
    expect(await screen.findByText('There is no current offer to help on this request.')).toBeTruthy();
    expect(screen.queryByTestId('qr-code')).toBeNull();
  });
});

describe('HelpScanScreen', () => {
  const camera = (globalThis as unknown as { __cameraState: { permission: { granted: boolean; canAskAgain: boolean } | null } }).__cameraState;
  /** Simulates the camera reading a QR code. */
  const scan = async (token: string) => {
    await act(async () => {
      (globalThis as unknown as { __scan: (t: string) => void }).__scan(token);
    });
  };

  beforeEach(() => {
    camera.permission = { granted: true, canAskAgain: true };
    setParams({ id: HELP.sofa });
  });

  it('confirms the helper, shows +5 civic trust and goes back to the request', async () => {
    renderScreen(<HelpScanScreen />);
    await screen.findByTestId('camera-view');
    await scan('demo-help-ticket-stella');
    expect(await screen.findByText('stella_99 helped you')).toBeTruthy();
    expect(screen.getByText(/\+5 civic trust for stella_99/)).toBeTruthy();
    expect(mocks.getMockState().reliabilityLog[IDS.stella][0]).toMatchObject({ reason: 'HELPED', pointsChange: 5 });
    fireEvent.press(screen.getByRole('button', { name: 'Back to request' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('refuses a second helper once the request is closed', async () => {
    await mocks.mockRequest('POST', `/help-requests/${HELP.sofa}/check-in`, {}, { token: 'demo-help-ticket-stella' });
    renderScreen(<HelpScanScreen />);
    await screen.findByTestId('camera-view');
    await scan('demo-help-ticket-andrei');
    expect(await screen.findByText('Request already closed')).toBeTruthy();
  });

  it('reports a code of another request, an unknown code and a withdrawn helper', async () => {
    renderScreen(<HelpScanScreen />);
    await screen.findByTestId('camera-view');
    await scan('demo-help-ticket-stella-1');
    expect(await screen.findByText('Wrong request')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Scan again' }));
    await waitFor(() => expect(screen.queryByTestId('scan-result')).toBeNull());
    await scan('not-a-ticket');
    expect(await screen.findByText('Not a helper code')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Scan again' }));
    await waitFor(() => expect(screen.queryByTestId('scan-result')).toBeNull());
    await scan('demo-help-ticket-maria');
    expect(await screen.findByText('Offer withdrawn')).toBeTruthy();
  });

  it('accepts a code typed by hand', async () => {
    renderScreen(<HelpScanScreen />);
    fireEvent.changeText(screen.getByLabelText('Or enter the helper’s code'), 'demo-help-ticket-andrei');
    fireEvent.press(screen.getByRole('button', { name: 'Confirm help' }));
    expect(await screen.findByText('andrei_tm helped you')).toBeTruthy();
  });

  it('refuses someone who did not ask for help', async () => {
    setParams({ id: HELP.ladder });
    renderScreen(<HelpScanScreen />);
    await screen.findByTestId('camera-view');
    await scan('demo-help-ticket-stella-1');
    expect(await screen.findByText('Scan failed')).toBeTruthy();
    expect(screen.getByText('Only the person who asked for help can do this.')).toBeTruthy();
  });

  it('asks for camera permission when it is missing', async () => {
    camera.permission = { granted: false, canAskAgain: true };
    renderScreen(<HelpScanScreen />);
    expect(await screen.findByText('Camera access needed')).toBeTruthy();
    expect(screen.getByText(/scan your helper’s QR code/)).toBeTruthy();
  });
});

describe('useHelpBoard', () => {
  it('passes an optional bbox to the board request', async () => {
    const spy = jest.spyOn(mocks, 'mockRequest');
    const client = createQueryClient();
    client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useHelpBoard({ bbox: '21.2251,45.7500,21.2300,45.7560' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith('GET', '/help-requests', { bbox: '21.2251,45.7500,21.2300,45.7560' }, undefined);
    expect(result.current.data!.map((r) => r.id)).toEqual([HELP.dogWalk, HELP.sofa, HELP.bike]);
    spy.mockRestore();
    client.clear();
  });
});

describe('Home entry point', () => {
  it('opens the help board and shows how many requests are open', async () => {
    renderScreen(<HomeScreen />);
    const button = await screen.findByLabelText('Neighbour help board');
    expect(await within(button).findByText('5')).toBeTruthy();
    fireEvent.press(button);
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/help'));
  });
});

describe('HELPED in the reliability history', () => {
  it('labels the reason and has no event link', () => {
    expect(reasonLabel('HELPED')).toBe('Helped a neighbour');
    expect(entrySubject({ reason: 'HELPED', eventTitle: null })).toBe('Help board');
    expect(entrySubject({ reason: 'HELPED', eventTitle: 'Borrow a ladder' })).toBe('Borrow a ladder');
    expect(entrySubject({ reason: 'ATTENDED', eventTitle: null })).toBe('Deleted event');
  });

  it('shows the scanned helper’s new line in their history', async () => {
    await mocks.mockRequest('POST', `/help-requests/${HELP.sofa}/check-in`, {}, { token: 'demo-help-ticket-stella' });
    renderScreen(<ReliabilityLog userId={IDS.stella} />);
    const first = within(await screen.findByTestId('reliability-entry-0'));
    expect(first.getByText('Helped a neighbour')).toBeTruthy();
    expect(first.getByText(/^Help board · /)).toBeTruthy();
    expect(first.getByText('+5')).toBeTruthy();
  });
});
