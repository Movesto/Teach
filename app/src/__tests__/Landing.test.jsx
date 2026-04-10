import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../pages/Landing';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, token: null }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );
}

describe('Landing page', () => {
  it('renders the app name or hero heading', () => {
    renderLanding();
    // The landing page has a hero title — check for key text
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('has a sign-in link', () => {
    renderLanding();
    const links = screen.getAllByRole('link');
    const hrefs = links.map(l => l.getAttribute('href'));
    expect(hrefs.some(h => h?.includes('/auth'))).toBe(true);
  });

  it('has a get started / register link', () => {
    renderLanding();
    const links = screen.getAllByRole('link');
    const texts = links.map(l => l.textContent?.toLowerCase());
    expect(texts.some(t => t?.includes('start') || t?.includes('register') || t?.includes('begin'))).toBe(true);
  });
});
