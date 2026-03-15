import { useState } from 'react';
import { LayoutDashboard, UtensilsCrossed, Dumbbell, MessageSquare, Target } from 'lucide-react';
import Dashboard from './components/Dashboard';
import FoodLog from './components/FoodLog';
import ExerciseLog from './components/ExerciseLog';
import AIChat from './components/AIChat';
import Goals from './components/Goals';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'food', label: 'Food Log', icon: UtensilsCrossed },
  { id: 'exercise', label: 'Exercise', icon: Dumbbell },
  { id: 'chat', label: 'AI Coach', icon: MessageSquare },
  { id: 'goals', label: 'Goals', icon: Target },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDataUpdate = () => setRefreshKey(k => k + 1);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥗</span>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">NutriAI</h1>
            <p className="text-xs text-emerald-400">Powered by Claude</p>
          </div>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-slate-500 hidden sm:block">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'dashboard' && <Dashboard key={refreshKey} />}
        {activeTab === 'food' && <FoodLog onDataUpdate={handleDataUpdate} />}
        {activeTab === 'exercise' && <ExerciseLog onDataUpdate={handleDataUpdate} />}
        {activeTab === 'chat' && <AIChat onDataUpdate={handleDataUpdate} />}
        {activeTab === 'goals' && <Goals />}
      </main>

      {/* Bottom Nav */}
      <nav className="bg-slate-900 border-t border-slate-800 flex">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              activeTab === id
                ? 'text-emerald-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 1.5} />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
