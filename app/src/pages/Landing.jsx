import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-3 leading-tight">
            Learn English. Change Your Life.
          </h1>
          <p className="text-2xl md:text-3xl text-indigo-200 mb-4 font-medium">
            Baaro Ingiriisi. Beddel Noloshaada.
          </p>
          <p className="text-lg text-indigo-100 max-w-2xl mx-auto mb-2">
            A structured English course built for Somali speakers — with an AI tutor that explains everything in Somali.
          </p>
          <p className="text-base text-indigo-200 max-w-2xl mx-auto mb-10">
            Koorse Ingiriisi oo si gaar ah loogu sameeyay dadka ku hadla Af-Soomaali — oo leh macalin AI ah oo ku sharha dhammaan waxyaabaha Af-Soomaaliga.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/auth?mode=register"
              className="px-8 py-4 bg-white text-indigo-700 rounded-xl font-bold text-lg hover:bg-indigo-50 transition-colors shadow-lg"
            >
              Bilow Hadda → / Get Started
            </Link>
            <Link
              to="/auth"
              className="px-8 py-4 bg-indigo-500 text-white rounded-xl font-bold text-lg hover:bg-indigo-400 transition-colors border border-indigo-400"
            >
              Gali Akoonka / Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">Why Barashada Ingiriisiga?</h2>
        <p className="text-center text-gray-500 mb-12">Maxay kuu gaarka tahay?</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: '🎯',
              en: 'Placement Test',
              so: 'Imtixaanka Heerka',
              desc: 'Start at the right level — no wasted time.',
              descSo: 'Ka bilow heerka saxda ah.',
            },
            {
              icon: '🤖',
              en: 'AI Tutor in Somali',
              so: 'Macalin AI ah',
              desc: 'Ask any question and get answers in Somali.',
              descSo: 'Su\'aal kasta weydii, Af-Soomaaliga ku jawaab.',
            },
            {
              icon: '📚',
              en: 'Real Books',
              so: 'Buugaag Dhabta ah',
              desc: 'Read graded readers with comprehension quizzes.',
              descSo: 'Akhri buugaag heerkaaga ku habboon.',
            },
            {
              icon: '📊',
              en: 'Track Progress',
              so: 'La soco Horumarkaaga',
              desc: 'See your CEFR level and completed lessons.',
              descSo: 'Eeg heerkaaga iyo casharkii aad dhamaysatay.',
            },
          ].map((f) => (
            <div key={f.en} className="bg-gray-50 rounded-2xl p-6 text-center hover:shadow-md transition-shadow">
              <div className="text-4xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-gray-900 text-lg">{f.en}</h3>
              <p className="text-indigo-600 text-sm font-medium mb-2">{f.so}</p>
              <p className="text-gray-600 text-sm">{f.desc}</p>
              <p className="text-gray-400 text-xs mt-1">{f.descSo}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">How It Works</h2>
          <p className="text-center text-gray-500 mb-12">Sidee u shaqeysaa?</p>
          <div className="space-y-6">
            {[
              {
                n: '1',
                en: 'Take the Placement Test',
                so: 'Qaado Imtixaanka Heerka',
                desc: 'A short 15-minute test finds your exact English level.',
                descSo: 'Imtixaan gaaban 15-daqiiqo ayaa heerkaaga saxda ah ogaanaysa.',
              },
              {
                n: '2',
                en: 'Study Lessons with AI Help',
                so: 'Baaro Casharka Macaalinaha AI kala Caawin',
                desc: 'Work through structured lessons. When stuck, your AI tutor explains in Somali.',
                descSo: 'Ka shaqee casharka. Marka aad ku xannibato, macaalinkaagu AI wuu ku sharxayaa Af-Soomaali.',
              },
              {
                n: '3',
                en: 'Read Real Books',
                so: 'Akhri Buugaag Dhabta ah',
                desc: 'Build reading fluency with graded books and comprehension quizzes.',
                descSo: 'Xooji akhrinta buugaag iyo su\'aalaha fahanka.',
              },
            ].map((s) => (
              <div key={s.n} className="flex gap-5 items-start bg-white rounded-xl p-6 shadow-sm">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {s.n}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{s.en}</h3>
                  <p className="text-indigo-600 text-sm font-medium mb-1">{s.so}</p>
                  <p className="text-gray-600 text-sm">{s.desc}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{s.descSo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-green-600 text-white py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-2">Ready to start? It's free.</h2>
          <p className="text-green-100 text-lg mb-8">Ma diyaar baad u tahay? Waa lacag la'aan.</p>
          <Link
            to="/auth?mode=register"
            className="inline-block px-10 py-4 bg-white text-green-700 rounded-xl font-bold text-lg hover:bg-green-50 transition-colors shadow-lg"
          >
            Create Account → / Samee Akoon
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p>© 2025 Barashada Ingiriisiga · Learn English in Somali</p>
      </div>
    </div>
  );
}
