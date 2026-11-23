import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const KEY = 'upkeep:store';

describe('Upkeep', () => {
  it('shows due work, spend and lifespan on the dashboard', () => {
    window.location.hash = '/dashboard';
    render(<App />);
    expect(screen.getAllByText('Replace furnace filter').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /Spending per month for the last 12 months/ })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /Gas furnace: \d+% of expected lifespan/ })).toBeInTheDocument();
  });

  it('logging scheduled work moves its due date', async () => {
    window.location.hash = '/log/demo-s-filter';
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByLabelText('What was done')).toHaveValue('Replace furnace filter');
    await user.type(screen.getByLabelText('Cost (USD)'), '19.99');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    expect(await screen.findByRole('heading', { name: 'Gas furnace' })).toBeInTheDocument();
    expect(screen.getAllByText('Replace furnace filter').length).toBeGreaterThan(0);
    expect(screen.getByText(/Due in 9\d days/)).toBeInTheDocument();
  });

  it('validates a service record', async () => {
    window.location.hash = '/log';
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    expect(screen.getByText('Choose what was serviced.')).toBeInTheDocument();
    expect(screen.getByText('Describe the work.')).toBeInTheDocument();
  });

  it('adds an item and a recurring task', async () => {
    localStorage.setItem(KEY, JSON.stringify({ assets: [], schedules: [], records: [] }));
    window.location.hash = '/assets';
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('Nothing tracked yet')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Add item' }));
    await user.click(await screen.findByRole('button', { name: 'Save item' }));
    expect(screen.getByText('Name the appliance or system.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Sump pump');
    await user.click(screen.getByRole('button', { name: 'Save item' }));
    expect(await screen.findByRole('heading', { name: 'Sump pump' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Task'), 'Test float switch');
    await user.click(screen.getByRole('button', { name: 'Add schedule' }));
    expect(screen.getByText('Scheduled “Test float switch”.')).toBeInTheDocument();
    expect(screen.getByText('Due today')).toBeInTheDocument();
  });

  it('filters the service log and totals what is shown', async () => {
    window.location.hash = '/records';
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Type'), 'Repair');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('Total shown: $624.50')).toBeInTheDocument();
  });
});
