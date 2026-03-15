import { BrowserRouter as Router, Routes, Route, Link, Navigate, useSearchParams } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import LessonView from './pages/LessonView';
import Dashboard from './pages/Dashboard';
import PlacementTest from './pages/PlacementTest';
import Landing from './pages/Landing';
import AuthPage from './pages/AuthPage';
import BookAssignment from './components/BookAssignment';
import GrammarGuide from './pages/GrammarGuide';
import UnitTest from './pages/UnitTest';

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen dark:bg-gray-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );
}

function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-indigo-400 dark:hover:bg-gray-800 transition-colors"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function NavBar() {
  const { user, logout } = useAuth();
  return (
    <nav className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-indigo-600 flex items-center gap-2">
              📚 Barashada Ingiriisiga
            </Link>
          </div>
          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <Link to="/dashboard" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-medium">
                  Dashboard
                </Link>
                <Link to="/grammar" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-medium">
                  Grammar Guide
                </Link>
                <span className="text-sm text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700 pl-3 ml-1">{user.name}</span>
                <button
                  onClick={logout}
                  className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/auth" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-medium">
                  Sign In
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                  Get Started
                </Link>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Landing />;
  if (!user.placement_done) return <Navigate to="/placement" replace />;
  return <Navigate to="/dashboard" replace />;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <AuthPage />;
  if (!user.placement_done) return <Navigate to="/placement" replace />;
  return <Navigate to="/dashboard" replace />;
}

function PlacementRoute() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (user.placement_done && !searchParams.get('retake')) return <Navigate to="/dashboard" replace />;
  return <PlacementTest />;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.placement_done) return <Navigate to="/placement" replace />;
  return children;
}

function AppShell() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <NavBar />
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/auth" element={<AuthRoute />} />
        <Route path="/placement" element={<PlacementRoute />} />
        <Route path="/home" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/lesson/:lessonId" element={<ProtectedRoute><LessonView /></ProtectedRoute>} />
        <Route path="/book/:bookId" element={<ProtectedRoute><BookAssignment /></ProtectedRoute>} />
        <Route path="/grammar" element={<ProtectedRoute><GrammarGuide /></ProtectedRoute>} />
        <Route path="/unit-test/:unitId" element={<ProtectedRoute><UnitTest /></ProtectedRoute>} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
