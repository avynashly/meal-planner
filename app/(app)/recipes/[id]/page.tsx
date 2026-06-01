'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Recipe, MealPlan, DayOfWeek, MealType } from '@/types';
import CategoryBadge from '@/components/CategoryBadge';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    week_start: formatDateLocal(getMondayOf(new Date())),
    day_of_week: 'Monday' as DayOfWeek,
    meal_type: 'Dinner' as MealType,
    servings: '2',
  });
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) {
        showToast('Recipe not found', 'error');
        router.push('/recipes');
      } else {
        setRecipe(data);
      }
      setLoading(false);
    }
    load();
  }, [id, router, showToast]);

  async function handleDelete() {
    if (!confirm('Delete this recipe?')) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) {
      showToast('Failed to delete recipe', 'error');
      setDeleting(false);
    } else {
      showToast('Recipe deleted', 'info');
      router.push('/recipes');
    }
  }

  async function handleAddToMealPlan(e: React.FormEvent) {
    e.preventDefault();
    setAddSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast('Not authenticated', 'error'); setAddSaving(false); return; }

    // Upsert meal plan for the week
    let mealPlan: MealPlan | null = null;
    const { data: existing } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', addForm.week_start)
      .maybeSingle();

    if (existing) {
      mealPlan = existing;
    } else {
      const { data: created, error } = await supabase
        .from('meal_plans')
        .insert({ user_id: user.id, week_start: addForm.week_start })
        .select()
        .single();
      if (error) { showToast('Failed to create meal plan', 'error'); setAddSaving(false); return; }
      mealPlan = created;
    }

    const { error } = await supabase.from('meal_plan_entries').insert({
      meal_plan_id: mealPlan!.id,
      day_of_week: addForm.day_of_week,
      meal_type: addForm.meal_type,
      recipe_id: id,
      servings: parseInt(addForm.servings) || 2,
    });

    if (error) {
      showToast('Failed to add to meal plan: ' + error.message, 'error');
    } else {
      showToast('Added to meal plan!', 'success');
      setAddModal(false);
    }
    setAddSaving(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!recipe) return null;

  const ingredientLines = recipe.ingredients?.split('\n').filter(Boolean) ?? [];
  const instructionLines = recipe.instructions?.split('\n').filter(Boolean) ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/recipes" className="text-gray-400 hover:text-gray-600 text-xl">←</Link>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">{recipe.name}</h1>
        <span className="text-2xl">{recipe.is_favourite ? '★' : '☆'}</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5">
        <div className="flex flex-wrap gap-2 items-center">
          <CategoryBadge category={recipe.category} />
          {recipe.cook_time_min != null && (
            <span className="text-sm text-gray-500">🕐 {recipe.cook_time_min} min</span>
          )}
          <span className="text-sm text-gray-500">👥 {recipe.servings} servings</span>
        </div>

        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recipe.tags.map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {ingredientLines.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-2">Ingredients</h2>
            <ul className="space-y-1">
              {ingredientLines.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {instructionLines.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-2">Instructions</h2>
            <ol className="space-y-2">
              {instructionLines.map((line, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ol>
          </div>
        )}

        {recipe.notes && (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Notes</h2>
            <p className="text-sm text-gray-600">{recipe.notes}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => setAddModal(true)}
            className="flex-1 min-w-[140px] bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Add to Meal Plan
          </button>
          <Link
            href={`/recipes/${id}/edit`}
            className="flex-1 min-w-[100px] text-center border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 min-w-[100px] border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add to Meal Plan">
        <form onSubmit={handleAddToMealPlan} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Week starting (Monday)</label>
            <input
              type="date"
              value={addForm.week_start}
              onChange={(e) => setAddForm((f) => ({ ...f, week_start: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
            <select
              value={addForm.day_of_week}
              onChange={(e) => setAddForm((f) => ({ ...f, day_of_week: e.target.value as DayOfWeek }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meal</label>
            <select
              value={addForm.meal_type}
              onChange={(e) => setAddForm((f) => ({ ...f, meal_type: e.target.value as MealType }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {MEAL_TYPES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
            <input
              type="number"
              min="1"
              value={addForm.servings}
              onChange={(e) => setAddForm((f) => ({ ...f, servings: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAddModal(false)}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addSaving}
              className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {addSaving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
