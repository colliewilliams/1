import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Flame, Clock } from 'lucide-react';

const EXERCISE_TYPES = ['cardio', 'strength', 'flexibility', 'sports', 'other'];
const TYPE_EMOJI = { cardio: '🏃', strength: '💪', flexibility: '🧘', sports: '⚽', other: '🏋️' };
const TYPE_COLORS = { cardio: 'text-orange-400', strength: 'text-blue-400', flexibility: 'text-green-400', sports: 'text-yellow-400', other: 'text-purple-400' };

// Calorie estimates per minute by exercise type keywords
const CAL_ESTIMATES = {
  'running': 10, 'jogging': 9, 'sprint': 12, 'walk': 4, 'cycling': 8,
  'bike': 8, 'swimming': 9, 'swim': 9, 'hiit': 12, 'crossfit': 11,
  'yoga': 3, 'pilates': 4, 'stretch': 2, 'basketball': 8, 'soccer': 8,
  'football': 8, 'tennis': 7, 'weight': 5, 'lift': 5, 'squat': 5,
  'deadlift': 6, 'bench': 5, 'cardio': 7, 'rowing': 8, 'elliptical': 7,
  'jump rope': 11, 'boxing': 9, 'dance': 6, 'zumba': 7,
};

function estimateCalories(exerciseName, durationMinutes, exerciseType) {
  const name = exerciseName.toLowerCase();
  for (const [key, rate] of Object.entries(CAL_ESTIMATES)) {
    if (name.includes(key)) return Math.round(rate * durationMinutes);
  }
  const typeRates = { cardio: 8, strength: 5, flexibility: 3, sports: 8, other: 6 };
  return Math.round((typeRates[exerciseType] || 6) * durationMinutes);
}

export default function ExerciseLog({ onDataUpdate }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [exercises, setExercises] = useState([]);
  const [form, setForm] = useState({ exercise_name: '', exercise_type: 'cardio', duration_minutes: '', calories_burned: '' });
  const [autoCalc, setAutoCalc] = useState(true);
  const isToday = date === new Date().toISOString().split('T')[0];

  const set = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (autoCalc && (k === 'exercise_name' || k === 'duration_minutes' || k === 'exercise_type')) {
        const dur = parseFloat(k === 'duration_minutes' ? v : next.duration_minutes) || 0;
        const name = k === 'exercise_name' ? v : next.exercise_name;
        const type = k === 'exercise_type' ? v : next.exercise_type;
        next.calories_burned = dur > 0 ? estimateCalories(name, dur, type) : '';
      }
      return next;
    });
  };

  const fetchExercises = useCallback(async () => {
    const res = await fetch(`/api/exercise-log?date=${date}`);
    setExercises(await res.json());
  }, [date]);

  useEffect(() => { fetchExercises(); }, [fetchExercises]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.exercise_name || !form.duration_minutes) return;
    const calories = parseFloat(form.calories_burned) || estimateCalories(form.exercise_name, parseFloat(form.duration_minutes), form.exercise_type);
    await fetch('/api/exercise-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, ...form, duration_minutes: parseInt(form.duration_minutes), calories_burned: calories }),
    });
    setForm({ exercise_name: '', exercise_type: 'cardio', duration_minutes: '', calories_burned: '' });
    fetchExercises();
    onDataUpdate?.();
  };

  const deleteExercise = async (id) => {
    await fetch(`/api/exercise-log/${id}`, { method: 'DELETE' });
    fetchExercises();
    onDataUpdate?.();
  };

  const shiftDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const totalBurned = exercises.reduce((s, e) => s + (e.calories_burned || 0), 0);
  const totalMinutes = exercises.reduce((s, e) => s + (e.duration_minutes || 0), 0);

  const COMMON_EXERCISES = [
    { name: 'Running', type: 'cardio', duration: 30 },
    { name: 'Walking', type: 'cardio', duration: 45 },
    { name: 'Weight Training', type: 'strength', duration: 45 },
    { name: 'Cycling', type: 'cardio', duration: 30 },
    { name: 'HIIT', type: 'cardio', duration: 20 },
    { name: 'Yoga', type: 'flexibility', duration: 30 },
    { name: 'Swimming', type: 'cardio', duration: 30 },
    { name: 'Jump Rope', type: 'cardio', duration: 15 },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 pb-6">
      {/* Date Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => shiftDate(-1)} className="btn-ghost p-2"><ChevronLeft size={18} /></button>
        <div className="text-center">
          <h2 className="font-semibold text-white">
            {isToday ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </h2>
          {exercises.length > 0 && (
            <p className="text-xs text-slate-500">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''} logged</p>
          )}
        </div>
        <button onClick={() => shiftDate(1)} disabled={isToday} className="btn-ghost p-2 disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>

      {/* Summary cards */}
      {exercises.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center py-4">
            <div className="flex items-center justify-center gap-2 text-orange-400 mb-1">
              <Flame size={18} />
              <span className="text-2xl font-bold text-white">{Math.round(totalBurned)}</span>
            </div>
            <div className="text-xs text-slate-500">Calories Burned</div>
          </div>
          <div className="card text-center py-4">
            <div className="flex items-center justify-center gap-2 text-blue-400 mb-1">
              <Clock size={18} />
              <span className="text-2xl font-bold text-white">{totalMinutes}</span>
            </div>
            <div className="text-xs text-slate-500">Total Minutes</div>
          </div>
        </div>
      )}

      {/* Add Exercise Form */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Log Exercise</h3>

        {/* Quick add */}
        <div className="flex flex-wrap gap-2">
          {COMMON_EXERCISES.map(ex => (
            <button
              key={ex.name}
              onClick={() => {
                const cal = estimateCalories(ex.name, ex.duration, ex.type);
                setForm({ exercise_name: ex.name, exercise_type: ex.type, duration_minutes: ex.duration.toString(), calories_burned: cal.toString() });
              }}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              {TYPE_EMOJI[ex.type]} {ex.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Exercise Name</label>
            <input
              value={form.exercise_name}
              onChange={e => set('exercise_name', e.target.value)}
              placeholder="e.g. Running, Weight Training, Yoga..."
              className="input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Type</label>
              <select
                value={form.exercise_type}
                onChange={e => set('exercise_type', e.target.value)}
                className="input"
              >
                {EXERCISE_TYPES.map(t => (
                  <option key={t} value={t}>{TYPE_EMOJI[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Duration (min)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={e => set('duration_minutes', e.target.value)}
                placeholder="30"
                className="input"
                min="1"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">Calories Burned</label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" checked={autoCalc} onChange={e => setAutoCalc(e.target.checked)} className="rounded" />
                Auto-estimate
              </label>
            </div>
            <input
              type="number"
              value={form.calories_burned}
              onChange={e => set('calories_burned', e.target.value)}
              placeholder={autoCalc ? 'Auto-calculated' : '0'}
              className="input"
              readOnly={autoCalc}
              min="0"
            />
          </div>

          <button type="submit" className="btn-primary w-full">
            Log Exercise
          </button>
        </form>
      </div>

      {/* Exercise List */}
      {exercises.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <div className="text-4xl mb-3">🏋️</div>
          <p className="text-sm">No exercises logged yet.</p>
          <p className="text-xs mt-1 text-slate-600">Add your workouts above or ask the AI Coach!</p>
        </div>
      ) : (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Today's Workouts</h3>
          {exercises.map(ex => (
            <div key={ex.id} className="flex items-center gap-3 py-2.5 border-b border-slate-800/50 last:border-0 group">
              <span className="text-xl">{TYPE_EMOJI[ex.exercise_type] || '🏋️'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{ex.exercise_name}</div>
                <div className="text-xs text-slate-500 capitalize">{ex.exercise_type}</div>
              </div>
              <div className="text-right text-xs">
                <div className="flex items-center gap-1 text-slate-400">
                  <Clock size={11} /> {ex.duration_minutes} min
                </div>
                <div className="text-orange-400 font-medium flex items-center gap-1 justify-end">
                  <Flame size={11} /> {Math.round(ex.calories_burned)}
                </div>
              </div>
              <button
                onClick={() => deleteExercise(ex.id)}
                className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-900/50 hover:bg-red-800 flex items-center justify-center transition-all ml-1"
              >
                <X size={13} className="text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
