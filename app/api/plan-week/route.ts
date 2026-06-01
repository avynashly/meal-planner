import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a personal meal planning assistant. Your job is to plan a healthy, balanced weekly meal plan using the user's saved recipe library.

Rules:
- Only use recipes from the provided library, identified by their exact recipe ID and name
- Assign Breakfast, Lunch, and Dinner for every day Monday–Sunday
- Snack slots are optional — only fill them if it makes sense
- Vary the meals — don't repeat the same recipe more than twice in a week
- Avoid repeating meals that appeared in the last 3 weeks where possible
- Consider the user's prompt carefully — respect constraints like time, ingredients on hand, dietary preferences
- Aim for nutritional balance across the week
- You must respond with valid JSON only, no explanation, no markdown

Response format:
{
  "plan": [
    {
      "day_of_week": "Monday",
      "meal_type": "Breakfast",
      "recipe_id": "uuid-here",
      "recipe_name": "Recipe Name"
    }
  ],
  "summary": "2-3 sentence summary of why this plan works well"
}`;

async function callClaude(userMessage: string): Promise<{ plan: Array<{ day_of_week: string; meal_type: string; recipe_id: string; recipe_name: string }>; summary: string }> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return JSON.parse(text);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { week_start, prompt, existing_entries } = body as {
    week_start: string;
    prompt: string;
    existing_entries?: Array<{ day_of_week: string; meal_type: string; label: string }>;
  };

  if (!week_start || !prompt) {
    return NextResponse.json({ error: 'Missing week_start or prompt' }, { status: 400 });
  }

  // Fetch user's recipes
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, category, cook_time_min, tags, ingredients')
    .order('name');

  if (!recipes || recipes.length < 3) {
    return NextResponse.json({ error: 'Please add at least 3 recipes to your library before using AI planning.' }, { status: 400 });
  }

  // Fetch last 3 weeks of meal plan entries
  const threeWeeksAgo = new Date(week_start);
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

  const { data: pastPlans } = await supabase
    .from('meal_plans')
    .select('id, week_start')
    .eq('user_id', user.id)
    .gte('week_start', threeWeeksAgo.toISOString().slice(0, 10))
    .lt('week_start', week_start);

  let pastMeals: Array<{ week_start: string; day_of_week: string; meal_type: string; recipe_name: string }> = [];
  if (pastPlans && pastPlans.length > 0) {
    const planIds = pastPlans.map((p) => p.id);
    const { data: pastEntries } = await supabase
      .from('meal_plan_entries')
      .select('day_of_week, meal_type, recipe:recipes(name), meal_plan_id')
      .in('meal_plan_id', planIds);

    if (pastEntries) {
      pastMeals = pastEntries
        .filter((e) => e.recipe)
        .map((e) => ({
          week_start: pastPlans.find((p) => p.id === e.meal_plan_id)?.week_start ?? '',
          day_of_week: e.day_of_week,
          meal_type: e.meal_type,
          recipe_name: (e.recipe as unknown as { name: string } | null)?.name ?? '',
        }));
    }
  }

  // Build existing slots section if partial fill
  let existingSlotsText = '';
  if (existing_entries && existing_entries.length > 0) {
    existingSlotsText = '\nAlready planned slots (do not fill these):\n' +
      existing_entries.map((e) => `${e.day_of_week} ${e.meal_type}: ${e.label}`).join('\n');
  }

  const userMessage = `Here is my recipe library:
${JSON.stringify(recipes, null, 2)}

Here are my last 3 weeks of meals:
${JSON.stringify(pastMeals, null, 2)}

My request for this week:
${prompt}

Week starts: ${week_start}${existingSlotsText}`;

  let result;
  try {
    result = await callClaude(userMessage);
  } catch {
    // Retry once on JSON parse failure
    try {
      result = await callClaude(userMessage);
    } catch (err) {
      return NextResponse.json({ error: 'AI planning failed. Please try again.' + (err instanceof Error ? ' ' + err.message : '') }, { status: 500 });
    }
  }

  // Ensure meal_plans row exists
  let { data: mealPlan } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('user_id', user.id)
    .eq('week_start', week_start)
    .maybeSingle();

  if (!mealPlan) {
    const { data: newPlan, error } = await supabase
      .from('meal_plans')
      .insert({ user_id: user.id, week_start, notes: '', diet_style: 'Omnivore' })
      .select('id')
      .single();
    if (error || !newPlan) {
      return NextResponse.json({ error: 'Failed to create meal plan' }, { status: 500 });
    }
    mealPlan = newPlan;
  }

  // Upsert each entry
  for (const item of result.plan) {
    // Check if slot already exists
    const { data: existing } = await supabase
      .from('meal_plan_entries')
      .select('id')
      .eq('meal_plan_id', mealPlan.id)
      .eq('day_of_week', item.day_of_week)
      .eq('meal_type', item.meal_type)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('meal_plan_entries')
        .update({ recipe_id: item.recipe_id, custom_meal: null, servings: 2 })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('meal_plan_entries')
        .insert({
          meal_plan_id: mealPlan.id,
          day_of_week: item.day_of_week,
          meal_type: item.meal_type,
          recipe_id: item.recipe_id,
          custom_meal: null,
          servings: 2,
        });
    }
  }

  return NextResponse.json({ plan: result.plan, summary: result.summary });
}
