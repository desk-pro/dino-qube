import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';

function App() {
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('runner-highscore');
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
  }, []);

  const handleGameOver = (score: number) => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('runner-highscore', score.toString());
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      
      <div className="w-full max-w-3xl mb-6 flex items-center justify-between text-white opacity-80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl">
            G
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Quentin Qui Court</h1>
            <p className="text-xs text-slate-400">Runner infini</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-slate-400">Astuce</p>
          <p className="text-sm font-medium">Appuie sur Espace pour sauter</p>
        </div>
      </div>

      <main className="w-full">
        <GameCanvas 
          onGameOver={handleGameOver} 
          highScore={highScore} 
        />
      </main>

      <footer className="mt-8 text-slate-500 text-sm text-center max-w-md mx-auto">
        <p>Un clone du Dino Chrome recréé avec React & Canvas.</p>
        <p className="mt-2 text-xs opacity-50">Partage ton score avec tes amis pour voir qui est le meilleur !</p>
      </footer>
    </div>
  );
}

export default App;