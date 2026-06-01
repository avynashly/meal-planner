'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MealPlan, MealPlanEntry, GroceryItem, GroceryCategory } from '@/types';
import CategoryBadge from '@/components/CategoryBadge';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
const CATEGORIES: GroceryCategory[] = ['Produce', 'Proteins', 'Dairy & Eggs', 'Grains & Pantry', 'Frozen', 'Beverages', 'Other'];

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplay(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SummaryPage() {
  const [weekStart] = useState(() => getMondayOf(new Date()));
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStr = formatDateLocal(weekStart);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: plan } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStr)
      .maybeSingle();

    if (!plan) { setLoading(false); return; }
    setMealPlan(plan);

    const [entriesRes, listsRes] = await Promise.all([
      supabase.from('meal_plan_entries').select('*, recipe:recipes(*)').eq('meal_plan_id', plan.id),
      supabase.from('grocery_lists').select('id').eq('meal_plan_id', plan.id).eq('user_id', user.id).maybeSingle(),
    ]);

    setEntries(entriesRes.data ?? []);

    if (listsRes.data) {
      const { data: items } = await supabase
        .from('grocery_items')
        .select('*')
        .eq('grocery_list_id', listsRes.data.id)
        .order('category')
        .order('item_name');
      setGroceryItems(items ?? []);
    }

    setLoading(false);
  }, [weekStr]);

  useEffect(() => { loadData(); }, [loadData]);

  function getEntry(day: string, meal: string) {
    return entries.find((e) => e.day_of_week === day && e.meal_type === meal);
  }

  const uniqueRecipes = Array.from(
    new Map(
      entries.filter((e) => e.recipe).map((e) => [e.recipe!.id, e.recipe!])
    ).values()
  );

  const groupedGrocery = CATEGORIES.reduce((acc, cat) => {
    const catItems = groceryItems.filter((i) => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {} as Record<GroceryCategory, GroceryItem[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly Summary</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatDisplay(weekStart)} – {formatDisplay(addDays(weekStart, 6))}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 print:hidden"
        >
          🖨 Print / Save PDF
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !mealPlan ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          No meal plan for this week.{' '}
          <Link href="/planner" className="text-blue-600 hover:underline">Go to Planner</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {mealPlan.diet_style && (
            <p className="text-sm text-gray-600">Diet style: <strong>{mealPlan.diet_style}</strong></p>
          )}
          {mealPlan.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-sm text-amber-800">{mealPlan.notes}</p>
            </div>
          )}

          {/* Compact meal grid */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 w-16"></th>
                  {DAYS.map((day) => (
                    <th key={day} className="px-2 py-2 text-center font-semibold text-gray-700 min-w-[80px]">
                      {day.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map((meal) => (
                  <tr key={meal} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-1.5 font-medium text-gray-500 uppercase tracking-wide align-top pt-2">
                      {meal.slice(0, 3)}
                    </td>
                    {DAYS.map((day) => {
                      const entry = getEntry(day, meal);
                      const label = entry?.recipe?.name ?? entry?.custom_meal;
                      return (
                        <td key={day} className="px-1 py-1 align-top">
                          {label ? (
                            <span className="text-xs text-gray-700 block px-1">{label}</span>
                          ) : (
                            <span className="text-gray-300 text-xs block px-1">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Unique recipes */}
          {uniqueRecipes.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">Recipes this week</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {uniqueRecipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.id}`}
                    className="bg-white rounded-xl border border-gray-200 px-4 py-3 hover:shadow-sm transition-shadow flex items-center gap-2 print:pointer-events-none"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{recipe.name}</p>
                      <div className="mt-0.5">
                        <CategoryBadge category={recipe.category} />
                      </div>
                    </div>
                    {recipe.cook_time_min && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{recipe.cook_time_min}m</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Grocery list read-only */}
          {groceryItems.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">Grocery list</h2>
              <div className="space-y-3">
                {(Object.entries(groupedGrocery) as [GroceryCategory, GroceryItem[]][]).map(([cat, catItems]) => (
                  <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{cat}</h3>
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {catItems.map((item) => (
                        <li key={item.id} className="flex items-center gap-3 px-4 py-2">
                          <span className="w-4 h-4 border border-gray-300 rounded flex-shrink-0" />
                          <span className="text-sm text-gray-700">{item.item_name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
