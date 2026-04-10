import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from '../pages/AuthPage';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockLogin    = vi.fn();
const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helpers ────────────────────────────────────────────────────────────────

function renderAuthPage(mode = 'login') {
  return render(
    <MemoryRouter initialEntries={[`/auth?mode=${mode}`]}>
      <AuthPage />
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

// ── Login mode ─────────────────────────────────────────────────────────────

describe('Login mode', () => {
  it('renders the Welcome Back heading', () => {
    renderAuthPage('login');
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('renders email and password inputs', () => {
    renderAuthPage('login');
    expect(screen.getByPlaceholderText('ahmed@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('shows "Email is required" when submitting with empty email', () => {
    renderAuthPage('login');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('shows "Invalid email address" for a malformed email', () => {
    renderAuthPage('login');
    fireEvent.change(screen.getByPlaceholderText('ahmed@example.com'), {
      target: { value: 'notanemail' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
  });

  it('shows "Password is required" when password is empty', () => {
    renderAuthPage('login');
    fireEvent.change(screen.getByPlaceholderText('ahmed@example.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('calls login with trimmed email and password on valid submit', async () => {
    mockLogin.mockResolvedValue({ placement_done: true });
    renderAuthPage('login');
    fireEvent.change(screen.getByPlaceholderText('ahmed@example.com'), {
      target: { value: '  user@example.com  ' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'mypassword')
    );
  });

  it('navigates to /dashboard when placement is done after login', async () => {
    mockLogin.mockResolvedValue({ placement_done: true });
    renderAuthPage('login');
    fireEvent.change(screen.getByPlaceholderText('ahmed@example.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows server error message on login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'));
    renderAuthPage('login');
    fireEvent.change(screen.getByPlaceholderText('ahmed@example.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    );
  });
});

// ── Register mode ──────────────────────────────────────────────────────────

describe('Register mode', () => {
  it('renders the Create Account heading', () => {
    renderAuthPage('register');
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
  });

  it('renders name, email, and password fields', () => {
    renderAuthPage('register');
    expect(screen.getByPlaceholderText('Ahmed Hassan')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ahmed@example.com')).toBeInTheDocument();
  });

  it('shows "Name is required" when name is empty', () => {
    renderAuthPage('register');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('shows error when password is shorter than 8 characters', () => {
    renderAuthPage('register');
    fireEvent.change(screen.getByPlaceholderText('Ahmed Hassan'), { target: { value: 'Faadumo' } });
    fireEvent.change(screen.getByPlaceholderText('ahmed@example.com'), { target: { value: 'f@example.com' } });
    const [passField] = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passField, { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('shows "Passwords do not match" when confirm does not match', () => {
    renderAuthPage('register');
    fireEvent.change(screen.getByPlaceholderText('Ahmed Hassan'), { target: { value: 'Faadumo' } });
    fireEvent.change(screen.getByPlaceholderText('ahmed@example.com'), { target: { value: 'f@example.com' } });
    const [passField, confirmField] = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passField,   { target: { value: 'password123' } });
    fireEvent.change(confirmField, { target: { value: 'different123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('calls register with name, email, and password on valid submit', async () => {
    mockRegister.mockResolvedValue({ placement_done: false });
    renderAuthPage('register');
    fireEvent.change(screen.getByPlaceholderText('Ahmed Hassan'), { target: { value: 'Faadumo' } });
    fireEvent.change(screen.getByPlaceholderText('ahmed@example.com'), { target: { value: 'f@example.com' } });
    const [passField, confirmField] = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passField,    { target: { value: 'password123' } });
    fireEvent.change(confirmField, { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith('Faadumo', 'f@example.com', 'password123')
    );
  });
});
