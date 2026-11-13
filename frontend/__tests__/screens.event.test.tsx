// Event details, create-event form, ticket and scanner screens.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';

import EventDetailsScreen from '@/app/events/[id]/index';
import ScanScreen from '@/app/events/[id]/scan';
import TicketScreen from '@/app/events/[id]/ticket';
import NewEventScreen from '@/app/events/new';

import { IDS, mockRouter, renderScreen, setParams } from './testUtils';

/** Presses the destructive button of the last Alert.alert call. */
function confirmAlert(spy: jest.SpyInstance, label: string) {
  const buttons = spy.mock.calls[spy.mock.calls.length - 1][2] as { text: string; onPress?: () => void }[];
  act(() => buttons.find((b) => b.text === label)!.onPress?.());
}

describe('EventDetailsScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the event, organiser and participants with reliability scores', async () => {
    setParams({ id: IDS.boardGames });
    renderScreen(<EventDetailsScreen />);
    expect(await screen.findByText('Board games night')).toBeTruthy();
    expect(screen.getByText('Bring your favourite game. Beginners welcome.')).toBeTruthy();
    expect(screen.getByText('Scârț Loc Lejer · Strada Mărășești 1')).toBeTruthy();
    expect(screen.getByText('4 spots left')).toBeTruthy();
    expect(screen.getByText('stefan')).toBeTruthy();
    expect(await screen.findByText('stella_99')).toBeTruthy();
    expect(screen.getByText('Participants (8)')).toBeTruthy();
    expect(within(screen.getByTestId('participant-stella_99')).getByText('90')).toBeTruthy();
  });

  it('opens a participant profile and the organiser profile', async () => {
    setParams({ id: IDS.boardGames });
    renderScreen(<EventDetailsScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Open profile of stella_99' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/users/${IDS.stella}`);
    fireEvent.press(screen.getByRole('button', { name: 'Organiser stefan' }));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/users\//));
  });

  it('shows the event on the map', async () => {
    setParams({ id: IDS.boardGames });
    renderScreen(<EventDetailsScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Show on map' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/map',
      params: { lat: '45.7489', lon: '21.2318', title: 'Board games night', eventId: IDS.boardGames, at: expect.any(String) },
    });
  });

  it('joins, then offers the ticket and leaving', async () => {
    setParams({ id: IDS.boardGames });
    renderScreen(<EventDetailsScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Join event' }));
    expect(await screen.findByRole('button', { name: 'My ticket' })).toBeTruthy();
    expect(await screen.findByText('3 spots left')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'My ticket' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/events/${IDS.boardGames}/ticket`);
  });

  it('asks for confirmation before leaving, then offers to join again', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    setParams({ id: IDS.artWalk }); // already joined in the mock data
    renderScreen(<EventDetailsScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Leave event' }));
    expect(alert).toHaveBeenCalledWith('Leave this event?', expect.any(String), expect.any(Array));
    confirmAlert(alert, 'Leave');
    expect(await screen.findByRole('button', { name: 'Join event' })).toBeTruthy();
  });

  it('disables joining a full event', async () => {
    setParams({ id: IDS.picnic });
    renderScreen(<EventDetailsScreen />);
    const full = await screen.findByRole('button', { name: 'Event full' });
    expect(full.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('shows the scanner and a ban button to the organiser, and bans after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    setParams({ id: IDS.sunsetRun });
    renderScreen(<EventDetailsScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Scan tickets' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/events/${IDS.sunsetRun}/scan`);
    expect(screen.queryByRole('button', { name: 'Join event' })).toBeNull();

    const row = within(await screen.findByTestId('participant-maria_c'));
    fireEvent.press(row.getByRole('button', { name: 'Ban' }));
    expect(alert).toHaveBeenCalledWith('Ban maria_c?', expect.any(String), expect.any(Array));
    confirmAlert(alert, 'Ban');
    expect(await within(screen.getByTestId('participant-maria_c')).findByText('Banned')).toBeTruthy();
  });

  it('does not show ban buttons to other users', async () => {
    setParams({ id: IDS.boardGames });
    renderScreen(<EventDetailsScreen />);
    await screen.findByText('stella_99');
    expect(screen.queryByRole('button', { name: 'Ban' })).toBeNull();
  });

  it('links imported events to the ticket page and shows the price', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    setParams({ id: IDS.indieRock });
    renderScreen(<EventDetailsScreen />);
    expect(await screen.findByText('60–120 lei')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Get tickets' }));
    expect(open).toHaveBeenCalledWith('https://www.livetickets.ro');
    expect(screen.queryByText(/Participants/)).toBeNull();
  });

  it('shows an error with retry when the event does not exist', async () => {
    setParams({ id: 'does-not-exist' });
    renderScreen(<EventDetailsScreen />);
    expect(await screen.findByTestId('error-state')).toBeTruthy();
    expect(screen.getByText('We could not find that.')).toBeTruthy();
  });
});

describe('NewEventScreen', () => {
  /** Drops the pin through the location picker. */
  async function pickLocation() {
    fireEvent.press(screen.getByRole('button', { name: 'Choose on map' }));
    fireEvent(await screen.findByTestId('picker-map'), 'press', { nativeEvent: { coordinate: { latitude: 45.75, longitude: 21.22 } } });
    fireEvent.press(screen.getByRole('button', { name: 'Use this location' }));
  }

  it('shows what is missing when submitted empty', () => {
    renderScreen(<NewEventScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Create event' }));
    expect(screen.getByText('Give your event a title.')).toBeTruthy();
    expect(screen.getByText('Pick a category.')).toBeTruthy();
    expect(screen.getByText('Give your event a venue name.')).toBeTruthy();
    expect(screen.getByText('Choose the location on the map.')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('creates an event with a picked location and opens it', async () => {
    renderScreen(<NewEventScreen />);
    fireEvent.changeText(screen.getByLabelText('Title'), 'Chess in the park');
    fireEvent.changeText(screen.getByLabelText('Venue name'), 'Central Park');
    fireEvent.press(screen.getByRole('button', { name: 'Games' }));
    fireEvent.press(screen.getByRole('button', { name: 'Limited' }));
    fireEvent.changeText(screen.getByLabelText('Capacity'), '8');
    await pickLocation();
    expect(screen.getByRole('button', { name: 'Pinned at 45.7500, 21.2200' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Create event' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/events\/e0000000/)));
  });

  it('changes the hour and minute', () => {
    renderScreen(<NewEventScreen />);
    expect(screen.getByLabelText('hour 19')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Increase hour' }));
    expect(screen.getByLabelText('hour 20')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Increase minute' }));
    expect(screen.getByLabelText('minute 5')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Decrease minute' }));
    fireEvent.press(screen.getByRole('button', { name: 'Decrease minute' }));
    expect(screen.getByLabelText('minute 55')).toBeTruthy();
  });
});

describe('TicketScreen', () => {
  it('draws the QR code for the participant token', async () => {
    setParams({ id: IDS.artWalk });
    renderScreen(<TicketScreen />);
    expect((await screen.findByTestId('qr-code')).props.children).toBe('demo-ticket-me-7');
    expect(await screen.findByText('Art walk through the old town')).toBeTruthy();
    expect(screen.getByText('READY TO SCAN')).toBeTruthy();
  });

  it('explains when the user has not joined', async () => {
    setParams({ id: IDS.boardGames });
    renderScreen(<TicketScreen />);
    expect(await screen.findByText('You have not joined this event.')).toBeTruthy();
    expect(screen.queryByTestId('qr-code')).toBeNull();
  });
});

describe('ScanScreen', () => {
  const camera = (globalThis as unknown as { __cameraState: { permission: { granted: boolean; canAskAgain: boolean } | null } }).__cameraState;
  /** Simulates the camera reading a QR code. */
  const scan = async (token: string) => {
    await act(async () => {
      (globalThis as unknown as { __scan: (t: string) => void }).__scan(token);
    });
  };

  beforeEach(() => {
    camera.permission = { granted: true, canAskAgain: true };
    setParams({ id: IDS.sunsetRun });
  });

  it('checks a participant in and shows the result', async () => {
    renderScreen(<ScanScreen />);
    await screen.findByTestId('camera-view');
    await scan('demo-ticket-stella');
    expect(await screen.findByText('stella_99 checked in')).toBeTruthy();
    expect(screen.getByText(/\+5 reliability points/)).toBeTruthy();
  });

  it('reports an already scanned ticket after "Scan next"', async () => {
    renderScreen(<ScanScreen />);
    await screen.findByTestId('camera-view');
    await scan('demo-ticket-stella');
    await screen.findByText('stella_99 checked in');
    fireEvent.press(screen.getByRole('button', { name: 'Scan next' }));
    await waitFor(() => expect(screen.queryByTestId('scan-result')).toBeNull());
    await scan('demo-ticket-stella');
    expect(await screen.findByText('Already scanned')).toBeTruthy();
  });

  it('reports a ticket for another event and an unknown code', async () => {
    renderScreen(<ScanScreen />);
    await screen.findByTestId('camera-view');
    await scan('demo-ticket-stella-1'); // belongs to the board games night
    expect(await screen.findByText('Wrong event')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Scan next' }));
    await waitFor(() => expect(screen.queryByTestId('scan-result')).toBeNull());
    await scan('not-a-ticket');
    expect(await screen.findByText('Not a ticket')).toBeTruthy();
  });

  it('handles a code only once while the result is shown', async () => {
    renderScreen(<ScanScreen />);
    await screen.findByTestId('camera-view');
    await act(async () => {
      const fire = (globalThis as unknown as { __scan: (t: string) => void }).__scan;
      fire('demo-ticket-andrei');
      fire('demo-ticket-andrei');
    });
    expect(await screen.findByText('andrei_tm checked in')).toBeTruthy();
    expect(screen.queryByText('Already scanned')).toBeNull();
  });

  it('accepts a code typed by hand', async () => {
    renderScreen(<ScanScreen />);
    fireEvent.changeText(screen.getByLabelText('Or enter the ticket code'), 'demo-ticket-maria');
    fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
    expect(await screen.findByText('maria_c checked in')).toBeTruthy();
  });

  it('refuses a non-organiser', async () => {
    setParams({ id: IDS.boardGames });
    renderScreen(<ScanScreen />);
    await screen.findByTestId('camera-view');
    await scan('demo-ticket-stella-1');
    expect(await screen.findByText('Check-in failed')).toBeTruthy();
    expect(screen.getByText('Only the organiser can do this.')).toBeTruthy();
  });

  it('asks for camera permission when it is missing', async () => {
    camera.permission = { granted: false, canAskAgain: true };
    renderScreen(<ScanScreen />);
    expect(await screen.findByText('Camera access needed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Allow camera' })).toBeTruthy();
    expect(screen.queryByTestId('camera-view')).toBeNull();
  });

  it('points to the phone settings when permission was blocked', async () => {
    camera.permission = { granted: false, canAskAgain: false };
    renderScreen(<ScanScreen />);
    expect(await screen.findByText(/phone settings/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Allow camera' })).toBeNull();
  });
});
