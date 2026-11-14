// Profile skills and the larger Help Board category list (PLAN 28): rules, mock backend, the Profile editor (add, edit,
// delete), skills on a public profile, helpers' skills on a request (matching ones first) and "Fits your skills" on the board.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ProfileScreen from '@/app/(tabs)/profile';
import HelpBoardScreen from '@/app/help/index';
import HelpRequestScreen from '@/app/help/[id]/index';
import PublicProfileScreen from '@/app/users/[id]';
import { ApiError } from '@/api/errors';
import type { Skill } from '@/api/types';
import { HELP_CATEGORIES } from '@/api/types.help';
import { HELP_CATEGORY_META } from '@/features/help/categories';
import { cleanSkillName, matchingFirst, skillCategories, skillsFor, validateSkill } from '@/features/users/skills';
import { getMockState, mockRequest, MOCK_ME_ID } from '@test/mocks';

import { HELP, IDS, renderScreen, setParams } from './testUtils';

const call = (method: string, path: string, body?: unknown) => mockRequest(method, path, {}, body) as Promise<any>;
const STEFAN = '22222222-2222-4222-8222-222222222222';
const skill = (id: string, name: string, category: Skill['category']): Skill => ({ id, name, category });

/** Resolves to the error code a call fails with. */
async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    return (e as ApiError).code;
  }
  throw new Error('expected the call to fail');
}

/** Presses a button of the last Alert.alert call. */
function confirmAlert(spy: jest.SpyInstance, label: string) {
  const buttons = spy.mock.calls[spy.mock.calls.length - 1][2] as { text: string; onPress?: () => void }[];
  act(() => buttons.find((b) => b.text === label)!.onPress?.());
}

describe('help categories (PLAN 28)', () => {
  it('has 18 categories, OTHER last, each with a label, icon and hint', () => {
    expect(HELP_CATEGORIES).toHaveLength(18);
    expect(HELP_CATEGORIES.slice(0, 5)).toEqual(['BORROW', 'CARRY', 'PETS', 'ERRANDS', 'REPAIRS']);
    expect(HELP_CATEGORIES).toEqual(expect.arrayContaining(['CARPENTRY', 'PLUMBING', 'ELECTRICAL', 'TECH', 'ELDERLY']));
    expect(HELP_CATEGORIES[HELP_CATEGORIES.length - 1]).toBe('OTHER');
    for (const c of HELP_CATEGORIES) {
      expect(HELP_CATEGORY_META[c].label).toBeTruthy();
      expect(HELP_CATEGORY_META[c].icon).toBeTruthy();
      expect(HELP_CATEGORY_META[c].hint).toBeTruthy();
    }
    expect(new Set(HELP_CATEGORIES.map((c) => HELP_CATEGORY_META[c].label)).size).toBe(18);
  });
});

describe('skill rules', () => {
  const mine = [skill('a', 'Carpentry', 'CARPENTRY'), skill('b', 'Bike repair', 'BIKES'), skill('c', 'Shelves', 'CARPENTRY')];

  it('cleans and validates like the API', () => {
    expect(cleanSkillName('  Fixing   bikes ')).toBe('Fixing bikes');
    expect(validateSkill('x', 'TECH')).toMatch(/2–40/);
    expect(validateSkill('x'.repeat(41), 'TECH')).toMatch(/2–40/);
    expect(validateSkill('Cooking', null)).toBe('Pick a category.');
    expect(validateSkill('CARPENTRY', 'REPAIRS', mine)).toBe('You already listed this skill.');
    expect(validateSkill(' Cooking ', 'COOKING', mine)).toBeNull();
  });

  it('finds and orders skills that fit a category', () => {
    expect(skillsFor(mine, 'CARPENTRY').map((s) => s.id)).toEqual(['a', 'c']);
    expect(skillsFor(undefined, 'TECH')).toEqual([]);
    expect(matchingFirst(mine, 'BIKES').map((s) => s.id)).toEqual(['b', 'a', 'c']);
    expect(matchingFirst(mine, undefined).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect([...skillCategories(mine)].sort()).toEqual(['BIKES', 'CARPENTRY']);
  });
});

describe('mock backend: /users/me/skills', () => {
  it('adds, lists, edits and deletes my skills; profiles carry them', async () => {
    expect(await call('GET', '/users/me/skills')).toEqual([]);
    const added = await call('POST', '/users/me/skills', { name: '  Tech   help ', category: 'tech' });
    expect(added).toMatchObject({ name: 'Tech help', category: 'TECH' });
    expect((await call('GET', '/users/me')).skills).toEqual([added]);

    const edited = await call('PATCH', `/users/me/skills/${added.id}`, { name: 'Phone help', category: 'TECH' });
    expect(edited).toEqual({ id: added.id, name: 'Phone help', category: 'TECH' });
    expect((await call('GET', `/users/${MOCK_ME_ID}`)).skills).toEqual([edited]);

    await call('DELETE', `/users/me/skills/${added.id}`);
    expect(await call('GET', '/users/me/skills')).toEqual([]);
    expect(await codeOf(call('DELETE', `/users/me/skills/${added.id}`))).toBe('NOT_FOUND');
    expect((await call('GET', `/users/${STEFAN}`)).skills.map((s: Skill) => s.name)).toEqual(['Carpentry', 'Moving furniture']);
  });

  it('refuses bad names, unknown categories, duplicates, the 11th skill and others’ skills', async () => {
    expect(await codeOf(call('POST', '/users/me/skills', { name: 'x', category: 'TECH' }))).toBe('VALIDATION_FAILED');
    expect(await codeOf(call('POST', '/users/me/skills', { name: 'Welding', category: 'WELDING' }))).toBe('VALIDATION_FAILED');
    await call('POST', '/users/me/skills', { name: 'Cooking', category: 'COOKING' });
    expect(await codeOf(call('POST', '/users/me/skills', { name: 'COOKING', category: 'OTHER' }))).toBe('SKILL_EXISTS');
    for (let i = 1; i < 10; i++) await call('POST', '/users/me/skills', { name: `Skill ${i}`, category: 'OTHER' });
    expect(await codeOf(call('POST', '/users/me/skills', { name: 'Eleventh', category: 'OTHER' }))).toBe('SKILL_LIMIT');
    expect(await codeOf(call('PATCH', '/users/me/skills/e0000000-0000-4000-8000-000000000001', { name: 'Mine now', category: 'OTHER' }))).toBe(
      'NOT_FOUND',
    );
  });

  it('puts each helper’s skills on the offers of a request', async () => {
    const detail = await call('GET', `/help-requests/${HELP.sofa}`);
    const andrei = detail.offers.find((o: any) => o.user.username === 'andrei_tm');
    expect(andrei.skills.map((s: Skill) => s.name)).toEqual(['Bike repair', 'Computer help']);
  });
});

describe('ProfileScreen: my skills', () => {
  afterEach(() => jest.restoreAllMocks());

  it('starts empty, adds a skill and shows it', async () => {
    renderScreen(<ProfileScreen />);
    expect(await screen.findByTestId('skills-empty')).toBeTruthy();
    fireEvent.press(screen.getByTestId('add-skill'));
    fireEvent.changeText(screen.getByLabelText('New skill'), '  Carpentry ');
    fireEvent.press(screen.getByTestId('skill-category-CARPENTRY'));
    fireEvent.press(screen.getByTestId('save-skill'));
    await waitFor(() => expect(screen.queryByTestId('skill-form')).toBeNull());
    // Name and category label (both "Carpentry") on the new row.
    expect(screen.getAllByText('Carpentry')).toHaveLength(2);
    expect(getMockState().skills[MOCK_ME_ID]).toEqual([expect.objectContaining({ name: 'Carpentry', category: 'CARPENTRY' })]);
    expect(screen.queryByTestId('skills-empty')).toBeNull();
  });

  it('shows what is wrong before sending, and the server’s duplicate error', async () => {
    renderScreen(<ProfileScreen />);
    fireEvent.press(await screen.findByTestId('add-skill'));
    fireEvent.press(screen.getByTestId('save-skill'));
    expect(screen.getByText(/Use 2–40 characters/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('New skill'), 'Gardening');
    expect(screen.getByText('Pick a category.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('skill-category-GARDENING'));
    expect(screen.queryByText('Pick a category.')).toBeNull();
    // Someone added the same skill from another phone: the server refuses it.
    getMockState().skills[MOCK_ME_ID] = [skill('e0000000-0000-4000-8000-000000000099', 'gardening', 'GARDENING')];
    fireEvent.press(screen.getByTestId('save-skill'));
    expect(await screen.findByText('You already listed this skill.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('skill-form')).toBeNull();
  });

  it('edits a skill and deletes one after confirming', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    getMockState().skills[MOCK_ME_ID] = [skill('s1', 'Painting', 'PAINTING'), skill('s2', 'Cooking', 'COOKING')];
    renderScreen(<ProfileScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Edit Painting' }));
    const form = screen.getByTestId('skill-form-s1');
    fireEvent.changeText(within(form).getByLabelText('Skill'), 'Wall painting');
    fireEvent.press(within(form).getByTestId('skill-category-REPAIRS'));
    fireEvent.press(within(form).getByTestId('save-skill'));
    await waitFor(() => expect(screen.getByText('Wall painting')).toBeTruthy());
    expect(within(screen.getByTestId('my-skill-s1')).getByText('Repairs')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Delete Cooking' }));
    expect(alert).toHaveBeenCalledWith('Delete skill?', expect.stringContaining('Cooking'), expect.any(Array));
    confirmAlert(alert, 'Delete');
    await waitFor(() => expect(screen.queryByTestId('my-skill-s2')).toBeNull());
    expect(getMockState().skills[MOCK_ME_ID].map((s) => s.name)).toEqual(['Wall painting']);
  });

  it('hides the add button at 10 skills', async () => {
    getMockState().skills[MOCK_ME_ID] = Array.from({ length: 10 }, (_, i) => skill(`s${i}`, `Skill ${i}`, 'OTHER'));
    renderScreen(<ProfileScreen />);
    expect(await screen.findByText(/You listed 10 skills/)).toBeTruthy();
    expect(screen.queryByTestId('add-skill')).toBeNull();
  });
});

describe('PublicProfileScreen: skills', () => {
  it('lists the user’s skills, or says there are none', async () => {
    setParams({ id: STEFAN });
    const view = renderScreen(<PublicProfileScreen />);
    const chips = await screen.findByTestId('profile-skills');
    expect(within(chips).getByText('Carpentry')).toBeTruthy();
    expect(within(chips).getByText('Moving furniture')).toBeTruthy();
    view.unmount();

    setParams({ id: '55555555-5555-4555-8555-555555555555' });
    renderScreen(<PublicProfileScreen />);
    expect(await screen.findByText('maria_c has not listed any skills yet.')).toBeTruthy();
  });
});

describe('HelpRequestScreen: helpers’ skills', () => {
  it('shows each helper’s skills, the ones fitting the request first and marked', async () => {
    getMockState().skills[IDS.stella] = [skill('st1', 'Dog walking', 'PETS'), skill('st2', 'Strong arms', 'CARRY')];
    setParams({ id: HELP.sofa });
    renderScreen(<HelpRequestScreen />);
    const stella = await screen.findByTestId('offer-stella_99');
    expect(within(stella).getByText(/Has a matching skill/)).toBeTruthy();
    expect(within(stella).getByTestId('skill-match-st2')).toBeTruthy();
    expect(within(stella).getByTestId('skill-st1')).toBeTruthy();
    const pills = within(screen.getByTestId('offer-skills-stella_99')).getAllByText(/Dog walking|Strong arms/);
    expect(pills.map((p) => p.props.children)).toEqual(['Strong arms', 'Dog walking']);

    const andrei = screen.getByTestId('offer-andrei_tm');
    expect(within(andrei).queryByText(/Has a matching skill/)).toBeNull();
    expect(within(andrei).getByText('Bike repair')).toBeTruthy();
  });
});

describe('HelpBoardScreen: Fits your skills', () => {
  it('marks open requests in a category I have a skill in', async () => {
    getMockState().skills[MOCK_ME_ID] = [skill('m1', 'Ladders', 'BORROW')];
    renderScreen(<HelpBoardScreen />);
    const ladder = await screen.findByTestId(`help-card-${HELP.ladder}`);
    await waitFor(() => expect(within(ladder).getByText('Fits your skills')).toBeTruthy());
    expect(within(screen.getByTestId(`help-card-${HELP.parcel}`)).queryByText('Fits your skills')).toBeNull();
  });

  it('shows the new categories as filters', async () => {
    renderScreen(<HelpBoardScreen />);
    expect(await screen.findByText('Carpentry')).toBeTruthy();
    expect(screen.getByText('Elderly care')).toBeTruthy();
  });
});
