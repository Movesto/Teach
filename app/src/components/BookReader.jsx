import React, { useState } from 'react';
import { Book, Download, ExternalLink, Volume2 } from 'lucide-react';

/**
 * BookReader Component
 * Displays book content with options for PDF viewing and audio
 */
function BookReader({ book }) {
  const [viewMode, setViewMode] = useState('embed'); // 'embed' or 'external'

  if (!book) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <Book className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No book loaded</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-start gap-4 mb-6">
        {/* Book Cover */}
        <img
          src={book.cover_image}
          alt={book.title}
          className="w-32 h-48 object-cover rounded-lg shadow-md"
          onError={(e) => {
            e.target.src = '/placeholder-book-cover.png';
          }}
        />

        {/* Book Info */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2">{book.title}</h2>
          <p className="text-lg text-gray-600 mb-3">by {book.author}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {book.level}
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              {book.pages} pages
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
              ~{book.reading_time_minutes} min
            </span>
          </div>

          <p className="text-gray-700 mb-4">{book.description}</p>

          {/* Themes */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-600 mb-2">Themes:</p>
            <div className="flex flex-wrap gap-2">
              {book.themes.map((theme, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reading Options */}
      <div className="border-t pt-6">
        <h3 className="font-bold text-lg mb-4">📖 Read This Book</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* PDF Option */}
          <div className="border rounded-lg p-4 hover:border-blue-500 transition">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="text-blue-500" size={20} />
              <h4 className="font-semibold">Open PDF</h4>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Open the full book in a new tab
            </p>
            <a
              href={book.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-4 py-2 bg-blue-500 text-white text-center rounded hover:bg-blue-600"
            >
              Open PDF
            </a>
          </div>

          {/* Download Option */}
          <div className="border rounded-lg p-4 hover:border-green-500 transition">
            <div className="flex items-center gap-2 mb-2">
              <Download className="text-green-500" size={20} />
              <h4 className="font-semibold">Download</h4>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Save to read offline
            </p>
            <a
              href={book.pdf_url}
              download
              className="block w-full px-4 py-2 bg-green-500 text-white text-center rounded hover:bg-green-600"
            >
              Download PDF
            </a>
          </div>

          {/* Audio Option */}
          {book.audio_url && (
            <div className="border rounded-lg p-4 hover:border-purple-500 transition">
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="text-purple-500" size={20} />
                <h4 className="font-semibold">Listen</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Audio narration available
              </p>
              <a
                href={book.audio_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 bg-purple-500 text-white text-center rounded hover:bg-purple-600"
              >
                Play Audio
              </a>
            </div>
          )}
        </div>

        {/* Embedded PDF Viewer */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold">Read Online</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('embed')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'embed'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Embedded
              </button>
              <button
                onClick={() => setViewMode('external')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'external'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                New Tab
              </button>
            </div>
          </div>

          {viewMode === 'embed' ? (
            <iframe
              src={book.pdf_url}
              className="w-full h-96 border rounded"
              title={book.title}
            >
              <p>
                Your browser doesn't support embedded PDFs.{' '}
                <a
                  href={book.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline"
                >
                  Click here to open the PDF
                </a>
              </p>
            </iframe>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">
                PDF will open in a new tab for better reading experience
              </p>
              <a
                href={book.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Open in New Tab
              </a>
            </div>
          )}
        </div>

        {/* Reading Tips */}
        <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
          <h4 className="font-semibold mb-2">📚 Reading Tips:</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Read the book completely before answering questions</li>
            <li>• Take notes on important events and characters</li>
            <li>• Look up words you don't know</li>
            <li>• Think about the themes as you read</li>
            <li>• You can re-read sections while answering questions</li>
          </ul>
        </div>

        {/* Vocabulary Preview */}
        <div className="mt-6">
          <h4 className="font-semibold mb-3">📝 Key Vocabulary:</h4>
          <div className="flex flex-wrap gap-2">
            {book.vocabulary_focus.slice(0, 10).map((word, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookReader;
