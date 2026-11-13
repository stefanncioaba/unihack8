// Sign-in and sign-up screens.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import SignInScreen from '@/app/(auth)/sign-in';
import SignUpScreen from '@/app/(auth)/sign-up';

import { fakeAuth, mockRouter, renderScreen } from './testUtils';

describe('SignInScreen', () => {
  it('shows validation errors and does not call signIn', () => {
    const { auth } = renderScreen(<SignInScreen />, fakeAuth({ session: null }));
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid e-mail address.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('signs in with the typed e-mail and password', async () => {
    const { auth } = renderScreen(<SignInScreen />, fakeAuth({ session: null }));
    fireEvent.changeText(screen.getByLabelText('E-mail'), 'me@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret12');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('me@example.com', 'secret12'));
  });

  it('shows the error from the server', async () => {
    const signIn = jest.fn().mockRejectedValue(new Error('Invalid login credentials'));
    renderScreen(<SignInScreen />, fakeAuth({ session: null, signIn }));
    fireEvent.changeText(screen.getByLabelText('E-mail'), 'me@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid login credentials')).toBeTruthy();
  });

  it('links to the sign-up screen', () => {
    renderScreen(<SignInScreen />, fakeAuth({ session: null }));
    fireEvent.press(screen.getByText('Create an account'));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-up');
  });

  it('warns when Supabase is not configured', () => {
    renderScreen(<SignInScreen />, fakeAuth({ session: null, configured: false }));
    expect(screen.getByTestId('config-warning')).toBeTruthy();
  });
});

describe('SignUpScreen', () => {
  /** Fills the three fields. */
  function fill(username: string, email: string, password: string) {
    fireEvent.changeText(screen.getByLabelText('Username'), username);
    fireEvent.changeText(screen.getByLabelText('E-mail'), email);
    fireEvent.changeText(screen.getByLabelText('Password'), password);
  }

  it('validates every field', () => {
    const { auth } = renderScreen(<SignUpScreen />, fakeAuth({ session: null }));
    fill('a', 'bad', '123');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Use 3–20 letters, digits or underscores.')).toBeTruthy();
    expect(screen.getByText('Enter a valid e-mail address.')).toBeTruthy();
    expect(screen.getByText('Use at least 6 characters.')).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('creates the account with username, e-mail and password', async () => {
    const { auth } = renderScreen(<SignUpScreen />, fakeAuth({ session: null }));
    fill('new_user', 'new@example.com', 'secret12');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'secret12', username: 'new_user' }));
  });

  it('shows username problems under the username field', async () => {
    const signUp = jest.fn().mockRejectedValue(new Error('That username is already taken.'));
    renderScreen(<SignUpScreen />, fakeAuth({ session: null, signUp }));
    fill('stefan', 'new@example.com', 'secret12');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('That username is already taken.')).toBeTruthy();
  });

  it('asks the user to confirm their e-mail when the project requires it', async () => {
    const signUp = jest.fn().mockResolvedValue({ needsConfirmation: true });
    renderScreen(<SignUpScreen />, fakeAuth({ session: null, signUp }));
    fill('new_user', 'new@example.com', 'secret12');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/confirm your e-mail/)).toBeTruthy();
  });
});
