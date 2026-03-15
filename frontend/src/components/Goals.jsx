import { useState, useEffect } from 'react';
import { Target, Save, Check, Info } from 'lucide-react';

const PRESETS = [
  { label: 'Weight Loss', description: 'Moderate deficit for steady fat loss', values: { calories_goal: 1600, protein_goal: 140, carbs_goal: 160, fat_goal: 55, fiber_goal: 30, water_goal: 10 } },
  { label: 'Maintenance', description: 'Maintain current weight and health', values: { calories_goal: 2000, protein_goal: 150, carbs_goal: 250, fat_goal: 65, fiber_goal: 30, water_goal: 8 } },
  { label: 'Muscle Gain', description: 'Calorie surplus for muscle building', values: { calories_goal: 2500, protein_goal: 200, carbs_goal: 300, fat_goal: 80, fiber_goal: 35, water_goal: 12 } },
  { label: 'High Protein', description: 'Maximize protein for performance', values: { calories_goal: 2200, protein_goal: 220, carbs_goal: 200, fat_goal: 70, fiber_goal: 30, water_goal: 10 } },
];

function GoalInput({ label, field, value, onChange, unit = '', min = 0, hint }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        {hint && <span className="text-xs text-slate-600 flex items-center gap-1"><Info size={10} />{hint}</span>}
      </div>
      <div className="relative">
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange(field, parseFloat(e.target.value) || 0)}
          className="input pr-10"
          min={min}
          step="any"
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

function MacroCalc({ calories, protein, carbs, fat }) {
  const proteinCal = protein * 4;
  const carbsCal = carbs * 4;
  const fatCal = fat * 9;
  const total = proteinCal + carbsCal + fatCal;
  const diff = Math.abs(total - calories);

  return (
    <div className="card bg-slate-800/50 text-xs space-y-2">
      <div className="font-semibold text-slate-400">Macro Calorie Breakdown</div>
      {[
        { label: 'Protein', cal: proteinCal, color: 'bg-purple-500', pct: total > 0 ? (proteinCal / total * 100) : 0 },
        { label: 'Carbs', cal: carbsCal, color: 'bg-yellow-500', pct: total > 0 ? (carbsCal / total * 100) : 0 },
        { label: 'Fat', cal: fatCal, color: 'bg-red-500', pct: total > 0 ? (fatCal / total * 100) : 0 },
      ].map(m => (
        <div key={m.label} className="space-y-0.5">
          <div className="flex justify-between text-slate-400">
            <span>{m.label}</span>
            <span>{Math.round(m.cal)} cal ({Math.round(m.pct)}%)</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full">
            <div className={`h-full rounded-full ${m.color}`} style={{ width: `${m.pct}%` }} />
          </div>
        </div>
      ))}
      <div className={`font-medium pt-1 ${diff > 100 ? 'text-yellow-400' : 'text-emerald-400'}`}>
        Macro total: {Math.round(total)} cal
        {diff > 100 && ` (${Math.round(diff)} ${total > calories ? 'over' : 'under'} goal)`}
        {diff <= 100 && ' ✓'}
      </div>
    </div>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState({
    calories_goal: 2000, protein_goal: 150, carbs_goal: 250,
    fat_goal: 65, fiber_goal: 30, water_goal: 8,
    current_weight: '', weight_goal: '',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/goals')
      .then(r => r.json())
      .then(g => {
        if (g) setGoals(prev => ({ ...prev, ...g }));
        setLoading(false);
      });
  }, []);

  const set = (k, v) => setGoals(g => ({ ...g, [k]: v }));

  const applyPreset = (preset) => {
    setGoals(g => ({ ...g, ...preset.values }));
  };

  const save = async () => {
    await fetch('/api/goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goals),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-slate-500">Loading...</div></div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
          <Target size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Goals</h2>
          <p className="text-sm text-slate-400">Set your daily nutrition targets</p>
        </div>
      </div>

      {/* Presets */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Quick Presets</h3>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="text-left p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 hover:border-emerald-500/40 transition-all"
            >
              <div className="text-sm font-semibold text-white">{preset.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{preset.description}</div>
              <div className="text-xs text-emerald-400 mt-1">{preset.values.calories_goal} kcal</div>
            </button>
          ))}
        </div>
      </div>

      {/* Calorie Goal */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Calorie Goal</h3>
        <GoalInput label="Daily Calories" field="calories_goal" value={goals.calories_goal} onChange={set} unit="kcal" />
      </div>

      {/* Macro Goals */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Macro Goals</h3>
        <div className="grid grid-cols-2 gap-4">
          <GoalInput label="Protein" field="protein_goal" value={goals.protein_goal} onChange={set} unit="g" hint="~4 cal/g" />
          <GoalInput label="Carbohydrates" field="carbs_goal" value={goals.carbs_goal} onChange={set} unit="g" hint="~4 cal/g" />
          <GoalInput label="Fat" field="fat_goal" value={goals.fat_goal} onChange={set} unit="g" hint="~9 cal/g" />
          <GoalInput label="Fiber" field="fiber_goal" value={goals.fiber_goal} onChange={set} unit="g" hint="Daily target" />
        </div>
        <MacroCalc calories={goals.calories_goal} protein={goals.protein_goal} carbs={goals.carbs_goal} fat={goals.fat_goal} />
      </div>

      {/* Water & Weight */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Water & Weight</h3>
        <GoalInput label="Daily Water Goal" field="water_goal" value={goals.water_goal} onChange={set} unit="glasses" />
        <div className="grid grid-cols-2 gap-4">
          <GoalInput label="Current Weight" field="current_weight" value={goals.current_weight} onChange={set} unit="kg" min={0} />
          <GoalInput label="Target Weight" field="weight_goal" value={goals.weight_goal} onChange={set} unit="kg" min={0} />
        </div>
        {goals.current_weight && goals.weight_goal && (
          <div className={`text-sm font-medium px-3 py-2 rounded-lg ${
            goals.weight_goal < goals.current_weight
              ? 'bg-blue-900/30 text-blue-400 border border-blue-800/40'
              : goals.weight_goal > goals.current_weight
              ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40'
              : 'bg-slate-800 text-slate-400'
          }`}>
            {goals.weight_goal < goals.current_weight
              ? `📉 Goal: Lose ${(goals.current_weight - goals.weight_goal).toFixed(1)} kg`
              : goals.weight_goal > goals.current_weight
              ? `📈 Goal: Gain ${(goals.weight_goal - goals.current_weight).toFixed(1)} kg`
              : '🎯 You\'re at your goal weight!'}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="card bg-emerald-900/10 border-emerald-800/30 text-sm space-y-2">
        <h3 className="font-semibold text-emerald-400">💡 Nutrition Tips</h3>
        <ul className="text-slate-400 space-y-1 text-xs list-disc list-inside">
          <li>Protein: 1.6–2.2g per kg of bodyweight for muscle maintenance/growth</li>
          <li>Carbs: 45–65% of daily calories for most people</li>
          <li>Fat: 20–35% of daily calories for hormonal health</li>
          <li>Fiber: at least 25–38g/day for digestive health</li>
          <li>Water: ~35ml per kg of bodyweight, more if exercising</li>
        </ul>
      </div>

      {/* Save */}
      <button onClick={save} className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
        {saved ? (
          <><Check size={18} /> Goals Saved!</>
        ) : (
          <><Save size={18} /> Save Goals</>
        )}
      </button>
    </div>
  );
}
