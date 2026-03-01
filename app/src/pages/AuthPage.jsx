import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'register' ? 'register' : 'login');
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setErrors({});
    setServerError('');
  }, [mode]);

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (mode === 'register' && !form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email address';
    if (!form.password) e.password = 'Password is required';
    else if (mode === 'register' && form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (mode === 'register' && form.password !== form.confirm) e.confirm = 'Passwords do not match';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    setServerError('');
    try {
      let user;
      if (mode === 'register') {
        user = await register(form.name.trim(), form.email.trim(), form.password);
      } else {
        user = await login(form.email.trim(), form.password);
      }
      navigate(user.placement_done ? '/dashboard' : '/placement');
    } catch (err) {
      setServerError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📚</div>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'register' ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {mode === 'register' ? 'Samee Akoon · Join for free' : 'Gali Akoonka · Sign in to continue'}
          </p>
        </div>

        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-gray-400 font-normal">/ Magacaaga</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Ahmed Hassan"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400 font-normal">/ Iimaylka</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="ahmed@example.com"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-gray-400 font-normal">/ Erayga Sirta</span>
              {mode === 'register' && <span className="text-gray-400 font-normal"> (min 8)</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.password ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password <span className="text-gray-400 font-normal">/ Xaqiiji Erayga</span>
              </label>
              <input
                type="password"
                value={form.confirm}
                onChange={e => set('confirm', e.target.value)}
                placeholder="••••••••"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.confirm ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {mode === 'register' ? 'Creating account...' : 'Signing in...'}
              </>
            ) : (
              mode === 'register' ? 'Create Account / Samee Akoon' : 'Sign In / Gali'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          {mode === 'register' ? (
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-indigo-600 font-semibold hover:underline">
                Sign In / Gali
              </button>
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button onClick={() => setMode('register')} className="text-indigo-600 font-semibold hover:underline">
                Create Account / Samee Akoon
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
