import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Search, Plus, X, Loader2 } from 'lucide-react';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_EMOJI = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
const MEAL_COLORS = { breakfast: 'text-yellow-400', lunch: 'text-orange-400', dinner: 'text-blue-400', snack: 'text-green-400' };

function FoodItem({ food, onDelete }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-800/50 last:border-0 group">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{food.food_name}</div>
        <div className="text-xs text-slate-500">{food.serving_size}</div>
      </div>
      <div className="flex items-center gap-2 text-xs shrink-0">
        <div className="text-right">
          <div className="text-slate-300 font-medium">{Math.round(food.calories)} cal</div>
          <div className="flex gap-1 text-slate-500">
            {food.protein > 0 && <span className="text-purple-400">{Math.round(food.protein)}P</span>}
            {food.carbs > 0 && <span className="text-yellow-500">{Math.round(food.carbs)}C</span>}
            {food.fat > 0 && <span className="text-red-400">{Math.round(food.fat)}F</span>}
          </div>
        </div>
        <button
          onClick={() => onDelete(food.id)}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-red-900/50 hover:bg-red-800 flex items-center justify-center transition-all"
        >
          <X size={12} className="text-red-400" />
        </button>
      </div>
    </div>
  );
}

function SearchResult({ food, onAdd }) {
  const [servingSize, setServingSize] = useState('100');
  const mult = parseFloat(servingSize) / 100 || 0;

  return (
    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-2">
      <div>
        <div className="text-sm font-medium text-white">{food.name}</div>
        {food.brand && <div className="text-xs text-slate-500">{food.brand}</div>}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-xs text-slate-400 grid grid-cols-4 gap-2 flex-1">
          <div><span className="text-white font-medium">{Math.round(food.calories * mult)}</span><br />cal</div>
          <div><span className="text-purple-400 font-medium">{Math.round(food.protein * mult * 10) / 10}g</span><br />prot</div>
          <div><span className="text-yellow-500 font-medium">{Math.round(food.carbs * mult * 10) / 10}g</span><br />carbs</div>
          <div><span className="text-red-400 font-medium">{Math.round(food.fat * mult * 10) / 10}g</span><br />fat</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1">
          <input
            type="number"
            value={servingSize}
            onChange={e => setServingSize(e.target.value)}
            className="input w-20 text-center"
            min="1"
          />
          <span className="text-xs text-slate-400">g / ml</span>
        </div>
        <button onClick={() => onAdd(food, parseFloat(servingSize) || 100)} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1">
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}

function ManualAddForm({ meal, date, onAdd, onCancel }) {
  const [form, setForm] = useState({ food_name: '', calories: '', protein: '', carbs: '', fat: '', serving_size: '1 serving' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.food_name || !form.calories) return;
    await fetch('/api/food-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, meal_type: meal, ...form, calories: parseFloat(form.calories) || 0, protein: parseFloat(form.protein) || 0, carbs: parseFloat(form.carbs) || 0, fat: parseFloat(form.fat) || 0 }),
    });
    onAdd();
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-3">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Manual Entry</div>
      <input value={form.food_name} onChange={e => set('food_name', e.target.value)} placeholder="Food name *" className="input" required />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500">Calories *</label>
          <input type="number" value={form.calories} onChange={e => set('calories', e.target.value)} placeholder="0" className="input" min="0" required />
        </div>
        <div>
          <label className="text-xs text-slate-500">Serving size</label>
          <input value={form.serving_size} onChange={e => set('serving_size', e.target.value)} placeholder="1 serving" className="input" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['protein', 'carbs', 'fat'].map(k => (
          <div key={k}>
            <label className="text-xs text-slate-500 capitalize">{k} (g)</label>
            <input type="number" value={form[k]} onChange={e => set(k, e.target.value)} placeholder="0" className="input" min="0" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 text-sm">Add Food</button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

export default function FoodLog({ onDataUpdate }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState([]);
  const [activeMeal, setActiveMeal] = useState('breakfast');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [summary, setSummary] = useState(null);
  const searchTimeout = useRef(null);
  const isToday = date === new Date().toISOString().split('T')[0];

  const fetchLogs = useCallback(async () => {
    const [logsRes, sumRes] = await Promise.all([
      fetch(`/api/food-log?date=${date}`),
      fetch(`/api/nutrition/summary?date=${date}`),
    ]);
    setLogs(await logsRes.json());
    setSummary(await sumRes.json());
  }, [date]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.foods || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 500);
  }, [searchQuery]);

  const addFood = async (food, gramsAmount) => {
    const mult = gramsAmount / 100;
    await fetch('/api/food-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, meal_type: activeMeal,
        food_name: food.name,
        calories: Math.round(food.calories * mult),
        protein: Math.round(food.protein * mult * 10) / 10,
        carbs: Math.round(food.carbs * mult * 10) / 10,
        fat: Math.round(food.fat * mult * 10) / 10,
        fiber: Math.round(food.fiber * mult * 10) / 10,
        serving_size: `${gramsAmount}g`,
      }),
    });
    setSearchQuery('');
    setSearchResults([]);
    fetchLogs();
    onDataUpdate?.();
  };

  const deleteFood = async (id) => {
    await fetch(`/api/food-log/${id}`, { method: 'DELETE' });
    fetchLogs();
    onDataUpdate?.();
  };

  const shiftDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const mealLogs = MEALS.reduce((acc, m) => {
    acc[m] = logs.filter(l => l.meal_type === m);
    return acc;
  }, {});

  const nut = summary?.nutrition || {};

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 pb-6">
      {/* Date Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => shiftDate(-1)} className="btn-ghost p-2"><ChevronLeft size={18} /></button>
        <div className="text-center">
          <h2 className="font-semibold text-white">
            {isToday ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </h2>
          {nut.total_calories > 0 && <p className="text-xs text-slate-500">{Math.round(nut.total_calories)} calories logged</p>}
        </div>
        <button onClick={() => shiftDate(1)} disabled={isToday} className="btn-ghost p-2 disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>

      {/* Daily totals bar */}
      {nut.total_calories > 0 && (
        <div className="card py-3">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { label: 'Calories', value: Math.round(nut.total_calories), color: 'text-white' },
              { label: 'Protein', value: `${Math.round(nut.total_protein)}g`, color: 'text-purple-400' },
              { label: 'Carbs', value: `${Math.round(nut.total_carbs)}g`, color: 'text-yellow-500' },
              { label: 'Fat', value: `${Math.round(nut.total_fat)}g`, color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className={`text-base font-bold ${color}`}>{value}</div>
                <div className="text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meal Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {MEALS.map(meal => (
          <button
            key={meal}
            onClick={() => setActiveMeal(meal)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              activeMeal === meal
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {MEAL_EMOJI[meal]} {meal.charAt(0).toUpperCase() + meal.slice(1)}
            {mealLogs[meal]?.length > 0 && (
              <span className="bg-white/20 text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {mealLogs[meal].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search foods to add to ${activeMeal}...`}
            className="input pl-9 pr-9"
          />
          {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 animate-spin" />}
          {searchQuery && !searching && (
            <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-slate-500 hover:text-white" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((food, i) => (
              <SearchResult key={i} food={food} onAdd={addFood} />
            ))}
          </div>
        )}
        {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-4">
            No results found. Try manual entry below.
          </div>
        )}

        {/* Manual entry toggle */}
        {!showManual ? (
          <button onClick={() => setShowManual(true)} className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
            <Plus size={12} /> Manual entry
          </button>
        ) : (
          <ManualAddForm
            meal={activeMeal}
            date={date}
            onAdd={() => { fetchLogs(); onDataUpdate?.(); }}
            onCancel={() => setShowManual(false)}
          />
        )}
      </div>

      {/* Meal Section */}
      <div className="card space-y-1">
        <div className={`text-sm font-semibold mb-2 flex items-center gap-2 ${MEAL_COLORS[activeMeal]}`}>
          {MEAL_EMOJI[activeMeal]} {activeMeal.charAt(0).toUpperCase() + activeMeal.slice(1)}
          {mealLogs[activeMeal]?.length > 0 && (
            <span className="text-slate-500 font-normal">
              — {Math.round(mealLogs[activeMeal].reduce((s, f) => s + f.calories, 0))} cal
            </span>
          )}
        </div>
        {mealLogs[activeMeal]?.length === 0 ? (
          <p className="text-slate-600 text-sm py-2">Nothing logged yet. Search above or use the AI Coach!</p>
        ) : (
          mealLogs[activeMeal].map(food => (
            <FoodItem key={food.id} food={food} onDelete={deleteFood} />
          ))
        )}
      </div>

      {/* Other meals preview */}
      {MEALS.filter(m => m !== activeMeal && mealLogs[m]?.length > 0).map(meal => (
        <div key={meal} className="card space-y-1">
          <div className={`text-sm font-semibold mb-2 flex items-center gap-2 ${MEAL_COLORS[meal]}`}>
            {MEAL_EMOJI[meal]} {meal.charAt(0).toUpperCase() + meal.slice(1)}
            <span className="text-slate-500 font-normal">
              — {Math.round(mealLogs[meal].reduce((s, f) => s + f.calories, 0))} cal
            </span>
          </div>
          {mealLogs[meal].map(food => (
            <FoodItem key={food.id} food={food} onDelete={deleteFood} />
          ))}
        </div>
      ))}
    </div>
  );
}
