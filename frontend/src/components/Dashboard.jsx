import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Droplets, Plus, Minus, Flame, TrendingUp } from 'lucide-react';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_EMOJI = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

function CircularProgress({ value, max, size = 160, strokeWidth = 16, color = '#10b981', label, sublabel }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - pct);
  const isOver = value > max;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={isOver ? '#ef4444' : color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="progress-ring"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-3xl font-bold ${isOver ? 'text-red-400' : 'text-white'}`}>
            {Math.round(value)}
          </span>
          <span className="text-xs text-slate-500">of {Math.round(max)}</span>
          {sublabel && <span className="text-xs text-slate-400 mt-0.5">{sublabel}</span>}
        </div>
      </div>
      {label && <span className="text-sm font-semibold text-slate-300">{label}</span>}
    </div>
  );
}

function MacroBar({ label, value, max, color, unit = 'g' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isOver = value > max;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className={isOver ? 'text-red-400 font-semibold' : 'text-slate-300'}>
          {Math.round(value)}{unit} / {Math.round(max)}{unit}
        </span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: isOver ? '#ef4444' : color }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nutrition/summary?date=${date}`);
      setSummary(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const shiftDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const updateWater = async (delta) => {
    if (!summary) return;
    const newGlasses = Math.max(0, (summary.water_glasses || 0) + delta);
    await fetch('/api/water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, glasses: newGlasses }),
    });
    fetchSummary();
  };

  const isToday = date === new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const goals = summary?.goals || {};
  const nut = summary?.nutrition || {};
  const remaining = (goals.calories_goal || 2000) - (nut.total_calories || 0) + (summary?.exercise_calories_burned || 0);
  const foodsByMeal = {};
  (summary?.foods_logged || []).forEach(f => {
    if (!foodsByMeal[f.meal_type]) foodsByMeal[f.meal_type] = [];
    foodsByMeal[f.meal_type].push(f);
  });

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 pb-6">
      {/* Date Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => shiftDate(-1)} className="btn-ghost p-2">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <h2 className="font-semibold text-white">
            {isToday ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </h2>
          {!isToday && (
            <button onClick={() => setDate(new Date().toISOString().split('T')[0])} className="text-xs text-emerald-400 hover:underline">
              Back to Today
            </button>
          )}
        </div>
        <button onClick={() => shiftDate(1)} disabled={isToday} className="btn-ghost p-2 disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calorie Ring */}
      <div className="card flex flex-col items-center gap-4 py-6">
        <CircularProgress
          value={nut.total_calories || 0}
          max={goals.calories_goal || 2000}
          label="Calories"
          sublabel={remaining > 0 ? `${Math.round(remaining)} remaining` : `${Math.round(-remaining)} over`}
        />

        {/* Calorie Breakdown */}
        <div className="grid grid-cols-3 gap-4 w-full text-center text-sm">
          <div>
            <div className="text-slate-400 text-xs mb-0.5">Goal</div>
            <div className="font-semibold text-white">{Math.round(goals.calories_goal || 2000)}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs mb-0.5 flex items-center justify-center gap-1">
              <Flame size={12} className="text-orange-400" /> Burned
            </div>
            <div className="font-semibold text-orange-400">{Math.round(summary?.exercise_calories_burned || 0)}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs mb-0.5">Net</div>
            <div className={`font-semibold ${remaining < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {Math.round(remaining)}
            </div>
          </div>
        </div>
      </div>

      {/* Macros */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <TrendingUp size={15} className="text-emerald-400" /> Macros
        </h3>
        <MacroBar label="Protein" value={nut.total_protein || 0} max={goals.protein_goal || 150} color="#8b5cf6" />
        <MacroBar label="Carbs" value={nut.total_carbs || 0} max={goals.carbs_goal || 250} color="#f59e0b" />
        <MacroBar label="Fat" value={nut.total_fat || 0} max={goals.fat_goal || 65} color="#ef4444" />
        <MacroBar label="Fiber" value={nut.total_fiber || 0} max={goals.fiber_goal || 30} color="#10b981" />
      </div>

      {/* Water Tracker */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets size={18} className="text-blue-400" />
            <span className="font-semibold text-slate-300 text-sm">Water</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => updateWater(-1)} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors">
              <Minus size={14} />
            </button>
            <div className="text-center min-w-[4rem]">
              <span className="text-xl font-bold text-white">{summary?.water_glasses || 0}</span>
              <span className="text-slate-500 text-sm"> / {goals.water_goal || 8}</span>
              <div className="text-xs text-slate-500">glasses</div>
            </div>
            <button onClick={() => updateWater(1)} className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>
        {/* Water dots */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {Array.from({ length: goals.water_goal || 8 }).map((_, i) => (
            <button key={i} onClick={() => updateWater(i < (summary?.water_glasses || 0) ? -(summary.water_glasses - i) : (i + 1 - (summary?.water_glasses || 0)))}
              className={`w-8 h-8 rounded-lg transition-colors text-sm ${i < (summary?.water_glasses || 0) ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-600'}`}>
              💧
            </button>
          ))}
        </div>
      </div>

      {/* Today's Meals */}
      {Object.keys(foodsByMeal).length > 0 && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Today's Meals</h3>
          {MEAL_ORDER.filter(m => foodsByMeal[m]).map(meal => (
            <div key={meal}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                {MEAL_EMOJI[meal]} {meal}
              </div>
              {foodsByMeal[meal].map((food, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0 text-sm">
                  <span className="text-slate-300 truncate flex-1">{food.food_name}</span>
                  <div className="flex items-center gap-3 text-xs text-slate-500 ml-2">
                    <span className="text-slate-400 font-medium">{Math.round(food.calories)} cal</span>
                    {food.protein > 0 && <span className="text-purple-400">{Math.round(food.protein)}P</span>}
                    {food.carbs > 0 && <span className="text-yellow-500">{Math.round(food.carbs)}C</span>}
                    {food.fat > 0 && <span className="text-red-400">{Math.round(food.fat)}F</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Exercises */}
      {(summary?.exercises_logged || []).length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            🏃 Exercise
          </h3>
          {summary.exercises_logged.map((ex, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-800/60 last:border-0">
              <span className="text-slate-300">{ex.exercise_name}</span>
              <div className="text-xs text-slate-500 flex gap-2">
                <span>{ex.duration_minutes} min</span>
                <span className="text-orange-400">{Math.round(ex.calories_burned)} cal</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!nut.total_calories && !(summary?.exercises_logged?.length) && (
        <div className="text-center py-8 text-slate-500">
          <div className="text-4xl mb-2">🍽️</div>
          <p className="text-sm">No data logged yet for this day.</p>
          <p className="text-xs mt-1">Use the Food Log or ask the AI Coach to get started!</p>
        </div>
      )}
    </div>
  );
}
