'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Recipe, MealPlan, MealPlanEntry, DayOfWeek, MealType } from '@/types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const DIET_STYLES = ['Omnivore', 'Vegetarian', 'Vegan', 'Keto', 'Other'];

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(d.getDate() + n);
  return result;
}

function formatDateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface CellModalState {
  day: DayOfWeek;
  meal: MealType;
  entry?: MealPlanEntry;
}

export default function PlannerPage() {
  const { showToast } = useToast();
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [dietStyle, setDietStyle] = useState('Omnivore');
  const [savingMeta, setSavingMeta] = useState(false);

  const [cellModal, setCellModal] = useState<CellModalState | null>(null);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [customMeal, setCustomMeal] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  const [filledModal, setFilledModal] = useState<CellModalState | null>(null);

  // AI planning state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiReplace, setAiReplace] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [summaryDismissed, setSummaryDismissed] = useState(false);

  const weekStr = formatDateLocal(weekStart);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [recipesRes, planRes] = await Promise.all([
      supabase.from('recipes').select('*').order('name'),
      supabase.from('meal_plans').select('*').eq('user_id', user.id).eq('week_start', weekStr).maybeSingle(),
    ]);

    setRecipes(recipesRes.data ?? []);

    if (planRes.data) {
      setMealPlan(planRes.data);
      setNotes(planRes.data.notes ?? '');
      setDietStyle(planRes.data.diet_style ?? 'Omnivore');

      const entriesRes = await supabase
        .from('meal_plan_entries')
        .select('*, recipe:recipes(*)')
        .eq('meal_plan_id', planRes.data.id);
      setEntries(entriesRes.data ?? []);
    } else {
      setMealPlan(null);
      setNotes('');
      setDietStyle('Omnivore');
      setEntries([]);
    }
    setLoading(false);
  }, [weekStr]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset AI summary when week changes
  useEffect(() => {
    setAiSummary('');
    setSummaryDismissed(false);
  }, [weekStr]);

  function getEntry(day: DayOfWeek, meal: MealType) {
    return entries.find((e) => e.day_of_week === day && e.meal_type === meal);
  }

  async function ensureMealPlan(): Promise<MealPlan | null> {
    if (mealPlan) return mealPlan;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('meal_plans')
      .insert({ user_id: user.id, week_start: weekStr, notes: '', diet_style: dietStyle })
      .select()
      .single();
    if (error) { showToast('Failed to create meal plan', 'error'); return null; }
    setMealPlan(data);
    return data;
  }

  async function saveMeta() {
    setSavingMeta(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingMeta(false); return; }

    if (mealPlan) {
      await supabase.from('meal_plans').update({ notes, diet_style: dietStyle, updated_at: new Date().toISOString() }).eq('id', mealPlan.id);
    } else {
      const { data } = await supabase.from('meal_plans').insert({ user_id: user.id, week_start: weekStr, notes, diet_style: dietStyle }).select().single();
      if (data) setMealPlan(data);
    }
    setSavingMeta(false);
    showToast('Saved!', 'success');
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!cellModal) return;
    setAddSaving(true);

    const plan = await ensureMealPlan();
    if (!plan) { setAddSaving(false); return; }

    const selectedRecipe = recipes.find((r) => r.name === recipeSearch);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('meal_plan_entries')
      .insert({
        meal_plan_id: plan.id,
        day_of_week: cellModal.day,
        meal_type: cellModal.meal,
        recipe_id: selectedRecipe?.id ?? null,
        custom_meal: selectedRecipe ? null : (customMeal || null),
        servings: 2,
      })
      .select('*, recipe:recipes(*)')
      .single();

    if (error) {
      showToast('Failed to add entry', 'error');
    } else {
      setEntries((prev) => [...prev, data]);
      setCellModal(null);
      setRecipeSearch('');
      setCustomMeal('');
    }
    setAddSaving(false);
  }

  async function handleRemoveEntry(entryId: string) {
    const supabase = createClient();
    await supabase.from('meal_plan_entries').delete().eq('id', entryId);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    setFilledModal(null);
    showToast('Removed', 'info');
  }

  async function handleAiPlan(e: React.FormEvent) {
    e.preventDefault();
    setAiLoading(true);
    setAiError('');

    // Build existing entries list for partial fill
    const existing_entries = aiReplace
      ? []
      : entries.map((entry) => ({
          day_of_week: entry.day_of_week,
          meal_type: entry.meal_type,
          label: entry.recipe?.name ?? entry.custom_meal ?? '',
        }));

    try {
      const res = await fetch('/api/plan-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStr, prompt: aiPrompt, existing_entries }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error ?? 'Something went wrong. Please try again.');
        setAiLoading(false);
        return;
      }

      setAiModalOpen(false);
      setAiPrompt('');
      setAiReplace(false);
      setAiSummary(data.summary ?? '');
      setSummaryDismissed(false);
      showToast('Your week is planned!', 'success');
      await loadData();
    } catch {
      setAiError('Network error. Please try again.');
    }
    setAiLoading(false);
  }

  const filteredRecipes = recipes.filter((r) =>
    r.name.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  const weekLabel = `Week of ${formatDisplay(weekStart)} – ${formatDisplay(addDays(weekStart, 6))}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Planner</h1>
      </div>

      {/* Week navigation + AI button */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          ← Prev
        </button>
        <button
          onClick={() => setWeekStart(getMondayOf(new Date()))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          This week
        </button>
        <span className="text-sm font-medium text-gray-700">
          {formatDisplay(weekStart)} – {formatDisplay(addDays(weekStart, 6))}
        </span>
        <button
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Next →
        </button>

        {recipes.length >= 3 && (
          <button
            onClick={() => { setAiModalOpen(true); setAiError(''); }}
            className="ml-auto flex items-center gap-1.5 bg-indigo-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <span>✨</span> Plan with AI
          </button>
        )}
      </div>

      {/* AI summary banner */}
      {aiSummary && !summaryDismissed && (
        <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex gap-3 items-start">
          <span className="text-indigo-500 text-lg flex-shrink-0">✨</span>
          <p className="text-sm text-indigo-800 flex-1">{aiSummary}</p>
          <button
            onClick={() => setSummaryDismissed(true)}
            className="text-indigo-400 hover:text-indigo-600 flex-shrink-0 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Meal grid - scrollable on mobile */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white mb-5">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 w-20"></th>
                  {DAYS.map((day, i) => (
                    <th key={day} className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[90px]">
                      <div>{day.slice(0, 3)}</div>
                      <div className="text-xs text-gray-400 font-normal">{formatDisplay(addDays(weekStart, i))}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map((meal) => (
                  <tr key={meal} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide align-top pt-3">
                      {meal}
                    </td>
                    {DAYS.map((day) => {
                      const entry = getEntry(day, meal);
                      const label = entry?.recipe?.name ?? entry?.custom_meal;
                      return (
                        <td key={day} className="px-1 py-1 align-top">
                          {label ? (
                            <button
                              onClick={() => setFilledModal({ day, meal, entry })}
                              className="w-full text-left text-xs bg-blue-50 text-blue-700 rounded-lg px-2 py-1.5 hover:bg-blue-100 transition-colors line-clamp-2"
                            >
                              {label}
                            </button>
                          ) : (
                            <button
                              onClick={() => { setCellModal({ day, meal }); setRecipeSearch(''); setCustomMeal(''); }}
                              className="w-full h-8 flex items-center justify-center text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors text-lg"
                            >
                              +
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Week meta */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diet style</label>
                <select
                  value={dietStyle}
                  onChange={(e) => setDietStyle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {DIET_STYLES.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Week notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Any notes for this week…"
                />
              </div>
            </div>
            <button
              onClick={saveMeta}
              disabled={savingMeta}
              className="self-end bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {savingMeta ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      )}

      {/* AI planning modal */}
      <Modal
        open={aiModalOpen}
        onClose={() => { if (!aiLoading) setAiModalOpen(false); }}
        title="Plan my week with AI"
      >
        <form onSubmit={handleAiPlan} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Week being planned</label>
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">{weekLabel}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What should I know for this week?</label>
            <textarea
              rows={4}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={aiLoading}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:opacity-60"
              placeholder="e.g. I have chicken and spinach at home. Busy weekdays — keep it under 30 min. One vegetarian day. We had a lot of pasta last week."
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={aiReplace}
              onChange={(e) => setAiReplace(e.target.checked)}
              disabled={aiLoading}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Replace existing meals this week
          </label>

          {aiError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{aiError}</p>
          )}

          {aiLoading && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-indigo-700 font-medium">Claude is planning your week…</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAiModalOpen(false)}
              disabled={aiLoading}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={aiLoading || !aiPrompt.trim()}
              className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {aiLoading ? 'Planning…' : '✨ Plan my week'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add entry modal */}
      <Modal
        open={!!cellModal}
        onClose={() => setCellModal(null)}
        title={cellModal ? `${cellModal.meal} — ${cellModal.day}` : ''}
      >
        <form onSubmit={handleAddEntry} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search recipes</label>
            <input
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type to search…"
            />
            {recipeSearch && filteredRecipes.length > 0 && (
              <ul className="border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto">
                {filteredRecipes.slice(0, 10).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setRecipeSearch(r.name)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="text-center text-xs text-gray-400">— or —</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom meal (type freely)</label>
            <input
              value={customMeal}
              onChange={(e) => { setCustomMeal(e.target.value); if (e.target.value) setRecipeSearch(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Leftovers, Takeout"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setCellModal(null)}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addSaving || (!recipeSearch && !customMeal)}
              className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {addSaving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Filled cell modal */}
      <Modal
        open={!!filledModal}
        onClose={() => setFilledModal(null)}
        title={filledModal ? `${filledModal.meal} — ${filledModal.day}` : ''}
      >
        {filledModal?.entry && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-700">
              <strong>{filledModal.entry.recipe?.name ?? filledModal.entry.custom_meal}</strong>
            </p>
            <div className="flex gap-2">
              {filledModal.entry.recipe_id && (
                <a
                  href={`/recipes/${filledModal.entry.recipe_id}`}
                  className="flex-1 text-center border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  View Recipe
                </a>
              )}
              <button
                onClick={() => {
                  setFilledModal(null);
                  setCellModal({ day: filledModal.day, meal: filledModal.meal });
                  setRecipeSearch('');
                  setCustomMeal('');
                }}
                className="flex-1 border border-blue-200 text-blue-600 rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-50"
              >
                Change
              </button>
              <button
                onClick={() => handleRemoveEntry(filledModal.entry!.id)}
                className="flex-1 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
