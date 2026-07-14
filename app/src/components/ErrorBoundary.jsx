import { Component } from 'react';
import { STRINGS } from '../utils/strings';

// A render crash without this leaves a blank white page — confusing for
// beginner students. Show a bilingual message with a way out instead.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center max-w-sm px-4">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-lg font-semibold text-gray-800 dark:text-white mb-1">{STRINGS.somethingWrong.en}</p>
          <p className="text-indigo-500 text-sm font-medium mb-4">{STRINGS.somethingWrong.so}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            {STRINGS.reloadPage.en} / {STRINGS.reloadPage.so}
          </button>
        </div>
      </div>
    );
  }
}
