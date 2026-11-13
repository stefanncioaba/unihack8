// Root layout: providers and the signed-in / signed-out gate.
import { render, screen, waitFor } from '@testing-library/react-native';

import RootLayout from '@/app/_layout';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

const getSession = supabase.auth.getSession as jest.Mock;

describe('RootLayout', () => {
  beforeEach(() => getSession.mockResolvedValue({ data: { session: null } }));

  // Clear query garbage-collection timers so the Jest process exits after the suite.
  afterEach(() => queryClient.clear());

  it('shows a loading screen while the stored session is read, then leaves it', async () => {
    render(<RootLayout />);
    expect(screen.getByText('Starting…')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Starting…')).toBeNull());
  });

  it('clears cached data when nobody is signed in', async () => {
    queryClient.setQueryData(['me'], { username: 'previous_user' });
    render(<RootLayout />);
    await waitFor(() => expect(queryClient.getQueryData(['me'])).toBeUndefined());
  });

  it('keeps cached data for a signed-in user', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    queryClient.setQueryData(['me'], { username: 'current_user' });
    render(<RootLayout />);
    await waitFor(() => expect(screen.queryByText('Starting…')).toBeNull());
    expect(queryClient.getQueryData(['me'])).toEqual({ username: 'current_user' });
  });
});
