const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Database Setup ──────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'nutriai.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS food_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL DEFAULT 'snack',
    food_name TEXT NOT NULL,
    calories REAL DEFAULT 0,
    protein REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    fat REAL DEFAULT 0,
    fiber REAL DEFAULT 0,
    serving_size TEXT DEFAULT '1 serving',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exercise_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    exercise_name TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 0,
    calories_burned REAL DEFAULT 0,
    exercise_type TEXT DEFAULT 'cardio',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calories_goal REAL DEFAULT 2000,
    protein_goal REAL DEFAULT 150,
    carbs_goal REAL DEFAULT 250,
    fat_goal REAL DEFAULT 65,
    fiber_goal REAL DEFAULT 30,
    water_goal REAL DEFAULT 8,
    current_weight REAL,
    weight_goal REAL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS water_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    glasses INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default goals
const goalsCount = db.prepare('SELECT COUNT(*) as count FROM goals').get();
if (goalsCount.count === 0) {
  db.prepare('INSERT INTO goals (calories_goal, protein_goal, carbs_goal, fat_goal) VALUES (2000, 150, 250, 65)').run();
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getToday() {
  return new Date().toISOString().split('T')[0];
}

async function searchUSDA(query) {
  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=DEMO_KEY&pageSize=8&dataType=Survey%20(FNDDS),SR%20Legacy,Branded`
    );
    const data = await res.json();
    return (data.foods || []).slice(0, 8).map(food => {
      const n = {};
      (food.foodNutrients || []).forEach(fn => {
        if (fn.nutrientName === 'Energy') n.calories = fn.value;
        if (fn.nutrientName === 'Protein') n.protein = fn.value;
        if (fn.nutrientName === 'Carbohydrate, by difference') n.carbs = fn.value;
        if (fn.nutrientName === 'Total lipid (fat)') n.fat = fn.value;
        if (fn.nutrientName === 'Fiber, total dietary') n.fiber = fn.value;
      });
      return {
        id: food.fdcId,
        name: food.description,
        brand: food.brandOwner || food.brandName || null,
        calories: Math.round(n.calories || 0),
        protein: Math.round((n.protein || 0) * 10) / 10,
        carbs: Math.round((n.carbs || 0) * 10) / 10,
        fat: Math.round((n.fat || 0) * 10) / 10,
        fiber: Math.round((n.fiber || 0) * 10) / 10,
        serving_size: '100g',
      };
    });
  } catch {
    return [];
  }
}

function getDailySummary(date) {
  const nutrition = db.prepare(`
    SELECT
      COALESCE(SUM(calories), 0) as total_calories,
      COALESCE(SUM(protein), 0) as total_protein,
      COALESCE(SUM(carbs), 0) as total_carbs,
      COALESCE(SUM(fat), 0) as total_fat,
      COALESCE(SUM(fiber), 0) as total_fiber,
      COUNT(*) as meal_count
    FROM food_logs WHERE date = ?
  `).get(date);

  const exercise = db.prepare(`
    SELECT COALESCE(SUM(calories_burned), 0) as total_burned, COUNT(*) as exercise_count
    FROM exercise_logs WHERE date = ?
  `).get(date);

  const goals = db.prepare('SELECT * FROM goals ORDER BY id DESC LIMIT 1').get();
  const foods = db.prepare('SELECT food_name, meal_type, calories, protein, carbs, fat FROM food_logs WHERE date = ? ORDER BY meal_type, created_at').all(date);
  const exercises = db.prepare('SELECT exercise_name, duration_minutes, calories_burned FROM exercise_logs WHERE date = ? ORDER BY created_at').all(date);
  const water = db.prepare('SELECT glasses FROM water_logs WHERE date = ?').get(date);

  return {
    date,
    nutrition,
    exercise_calories_burned: exercise.total_burned,
    exercise_count: exercise.exercise_count,
    net_calories: nutrition.total_calories - exercise.total_burned,
    goals,
    foods_logged: foods,
    exercises_logged: exercises,
    water_glasses: water?.glasses || 0,
  };
}

// ─── Food Log Routes ──────────────────────────────────────────────────────────
app.get('/api/food-log', (req, res) => {
  const date = req.query.date || getToday();
  const logs = db.prepare('SELECT * FROM food_logs WHERE date = ? ORDER BY meal_type, created_at ASC').all(date);
  res.json(logs);
});

app.post('/api/food-log', (req, res) => {
  const { date, meal_type, food_name, calories, protein, carbs, fat, fiber, serving_size } = req.body;
  const d = date || getToday();
  const result = db.prepare(`
    INSERT INTO food_logs (date, meal_type, food_name, calories, protein, carbs, fat, fiber, serving_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(d, meal_type || 'snack', food_name, calories || 0, protein || 0, carbs || 0, fat || 0, fiber || 0, serving_size || '1 serving');
  res.json(db.prepare('SELECT * FROM food_logs WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/food-log/:id', (req, res) => {
  db.prepare('DELETE FROM food_logs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Exercise Log Routes ──────────────────────────────────────────────────────
app.get('/api/exercise-log', (req, res) => {
  const date = req.query.date || getToday();
  const logs = db.prepare('SELECT * FROM exercise_logs WHERE date = ? ORDER BY created_at ASC').all(date);
  res.json(logs);
});

app.post('/api/exercise-log', (req, res) => {
  const { date, exercise_name, duration_minutes, calories_burned, exercise_type } = req.body;
  const d = date || getToday();
  const result = db.prepare(`
    INSERT INTO exercise_logs (date, exercise_name, duration_minutes, calories_burned, exercise_type)
    VALUES (?, ?, ?, ?, ?)
  `).run(d, exercise_name, duration_minutes || 0, calories_burned || 0, exercise_type || 'cardio');
  res.json(db.prepare('SELECT * FROM exercise_logs WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/exercise-log/:id', (req, res) => {
  db.prepare('DELETE FROM exercise_logs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Nutrition Summary ────────────────────────────────────────────────────────
app.get('/api/nutrition/summary', (req, res) => {
  const date = req.query.date || getToday();
  res.json(getDailySummary(date));
});

// ─── Goals ────────────────────────────────────────────────────────────────────
app.get('/api/goals', (req, res) => {
  res.json(db.prepare('SELECT * FROM goals ORDER BY id DESC LIMIT 1').get());
});

app.put('/api/goals', (req, res) => {
  const { calories_goal, protein_goal, carbs_goal, fat_goal, fiber_goal, water_goal, current_weight, weight_goal } = req.body;
  const existing = db.prepare('SELECT id FROM goals ORDER BY id DESC LIMIT 1').get();
  if (existing) {
    db.prepare(`
      UPDATE goals SET calories_goal=?, protein_goal=?, carbs_goal=?, fat_goal=?, fiber_goal=?,
      water_goal=?, current_weight=?, weight_goal=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(calories_goal, protein_goal, carbs_goal, fat_goal, fiber_goal || 30, water_goal, current_weight, weight_goal, existing.id);
  }
  res.json(db.prepare('SELECT * FROM goals ORDER BY id DESC LIMIT 1').get());
});

// ─── Water Tracking ───────────────────────────────────────────────────────────
app.post('/api/water', (req, res) => {
  const { date, glasses } = req.body;
  const d = date || getToday();
  db.prepare(`
    INSERT INTO water_logs (date, glasses) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET glasses=?, updated_at=CURRENT_TIMESTAMP
  `).run(d, glasses, glasses);
  res.json({ date: d, glasses });
});

// ─── Food Search (USDA) ───────────────────────────────────────────────────────
app.get('/api/foods/search', async (req, res) => {
  const query = req.query.q;
  if (!query || query.trim().length < 2) return res.json({ foods: [] });
  const foods = await searchUSDA(query);
  res.json({ foods });
});

// ─── AI Chat (SSE Streaming) ──────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages = [], date } = req.body;
  const today = date || getToday();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const tools = [
    {
      name: 'search_food',
      description: 'Search for food nutritional information from the USDA FoodData Central database. Returns calories, protein, carbs, fat, fiber per 100g.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Food name or description to search for' },
        },
        required: ['query'],
      },
    },
    {
      name: 'log_food',
      description: "Log a food item to the user's food diary for today",
      input_schema: {
        type: 'object',
        properties: {
          food_name: { type: 'string', description: 'Name of the food' },
          meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'], description: 'Which meal this belongs to' },
          calories: { type: 'number', description: 'Total calories for this serving' },
          protein: { type: 'number', description: 'Protein in grams' },
          carbs: { type: 'number', description: 'Carbohydrates in grams' },
          fat: { type: 'number', description: 'Fat in grams' },
          fiber: { type: 'number', description: 'Fiber in grams' },
          serving_size: { type: 'string', description: 'Serving size description (e.g. "1 cup", "200g", "1 medium")' },
        },
        required: ['food_name', 'meal_type', 'calories'],
      },
    },
    {
      name: 'log_exercise',
      description: "Log an exercise or workout session to the user's exercise diary for today",
      input_schema: {
        type: 'object',
        properties: {
          exercise_name: { type: 'string', description: 'Name of the exercise or workout' },
          duration_minutes: { type: 'number', description: 'Duration in minutes' },
          calories_burned: { type: 'number', description: 'Estimated calories burned (estimate based on exercise type and duration if not provided)' },
          exercise_type: { type: 'string', enum: ['cardio', 'strength', 'flexibility', 'sports', 'other'], description: 'Category of exercise' },
        },
        required: ['exercise_name', 'duration_minutes', 'calories_burned'],
      },
    },
    {
      name: 'get_daily_summary',
      description: "Get the user's complete nutrition and exercise summary for today or a specific date",
      input_schema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format. Omit for today.' },
        },
      },
    },
    {
      name: 'get_goals',
      description: "Retrieve the user's current nutrition and fitness goals",
      input_schema: {
        type: 'object',
        properties: {},
      },
    },
  ];

  const systemPrompt = `You are NutriAI — an expert AI nutrition and fitness coach that combines the precision of MyFitnessPal with the conversational intelligence of ChatGPT.

Today's date: ${today}

Your capabilities:
- Search food nutritional data and log meals to the user's diary
- Log exercise sessions with calorie burn estimates
- Analyze their daily nutrition against their goals
- Provide personalized dietary and fitness recommendations
- Answer any questions about nutrition, macros, meal planning, and fitness

Your personality:
- Encouraging and motivating, but honest about data
- Proactive: if a user mentions eating something, offer to log it immediately
- If they mention working out, offer to log that too
- Always reference their actual data and goals in your advice
- Be specific with numbers, not vague platitudes

When logging food:
- First search for the food to get accurate nutrition data if not already known
- Ask for serving size if unclear
- Assign the correct meal type (breakfast/lunch/dinner/snack) based on context or ask

When estimating exercise calories:
- Running: ~10 cal/min, Walking: ~4 cal/min, Cycling: ~8 cal/min
- Strength training: ~5 cal/min, HIIT: ~12 cal/min, Yoga: ~3 cal/min
- Swimming: ~8 cal/min, sports like basketball/soccer: ~8 cal/min

Keep responses concise and action-oriented. Use data to make your advice specific.`;

  try {
    const claudeMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    let continueLoop = true;

    while (continueLoop) {
      const stream = client.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        system: systemPrompt,
        tools,
        messages: claudeMessages,
      });

      const responseContent = [];
      let currentToolInput = '';
      let currentToolIndex = -1;

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'text') {
            responseContent.push({ type: 'text', text: '' });
          } else if (event.content_block.type === 'tool_use') {
            responseContent.push({ type: 'tool_use', id: event.content_block.id, name: event.content_block.name, input: {} });
            currentToolIndex = responseContent.length - 1;
            currentToolInput = '';
          } else if (event.content_block.type === 'thinking') {
            responseContent.push({ type: 'thinking', thinking: '' });
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            const last = responseContent[responseContent.length - 1];
            if (last?.type === 'text') {
              last.text += event.delta.text;
              sendEvent({ type: 'text', content: event.delta.text });
            }
          } else if (event.delta.type === 'input_json_delta') {
            currentToolInput += event.delta.partial_json;
          } else if (event.delta.type === 'thinking_delta') {
            // Skip thinking blocks in output
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolIndex >= 0 && responseContent[currentToolIndex]?.type === 'tool_use') {
            try {
              responseContent[currentToolIndex].input = currentToolInput ? JSON.parse(currentToolInput) : {};
            } catch { /* ignore parse errors */ }
            currentToolIndex = -1;
            currentToolInput = '';
          }
        }
      }

      const finalMsg = await stream.finalMessage();
      claudeMessages.push({ role: 'assistant', content: responseContent });

      if (finalMsg.stop_reason === 'tool_use') {
        const toolUseBlocks = responseContent.filter(b => b.type === 'tool_use');
        const toolResults = [];

        for (const toolUse of toolUseBlocks) {
          let result;
          sendEvent({ type: 'tool_use', tool: toolUse.name, input: toolUse.input });

          try {
            if (toolUse.name === 'search_food') {
              const foods = await searchUSDA(toolUse.input.query);
              result = JSON.stringify({ foods, note: 'Nutrition values are per 100g' });

            } else if (toolUse.name === 'log_food') {
              const inp = toolUse.input;
              db.prepare(`
                INSERT INTO food_logs (date, meal_type, food_name, calories, protein, carbs, fat, fiber, serving_size)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(today, inp.meal_type, inp.food_name, inp.calories || 0, inp.protein || 0, inp.carbs || 0, inp.fat || 0, inp.fiber || 0, inp.serving_size || '1 serving');
              result = JSON.stringify({ success: true, logged: inp });
              sendEvent({ type: 'data_updated', kind: 'food' });

            } else if (toolUse.name === 'log_exercise') {
              const inp = toolUse.input;
              db.prepare(`
                INSERT INTO exercise_logs (date, exercise_name, duration_minutes, calories_burned, exercise_type)
                VALUES (?, ?, ?, ?, ?)
              `).run(today, inp.exercise_name, inp.duration_minutes, inp.calories_burned || 0, inp.exercise_type || 'cardio');
              result = JSON.stringify({ success: true, logged: inp });
              sendEvent({ type: 'data_updated', kind: 'exercise' });

            } else if (toolUse.name === 'get_daily_summary') {
              const d = toolUse.input.date || today;
              result = JSON.stringify(getDailySummary(d));

            } else if (toolUse.name === 'get_goals') {
              result = JSON.stringify(db.prepare('SELECT * FROM goals ORDER BY id DESC LIMIT 1').get());
            }
          } catch (err) {
            result = JSON.stringify({ error: err.message });
          }

          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
        }

        claudeMessages.push({ role: 'user', content: toolResults });
      } else {
        continueLoop = false;
      }
    }

    sendEvent({ type: 'done' });
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    sendEvent({ type: 'error', message: err.message });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`\n🥗 NutriAI backend running on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY not set — AI chat will not work');
  }
});
