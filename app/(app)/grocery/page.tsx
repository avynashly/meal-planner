'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { GroceryItem, GroceryCategory } from '@/types';

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

const CATEGORIES: GroceryCategory[] = [
  'Produce', 'Proteins', 'Dairy & Eggs', 'Grains & Pantry', 'Frozen', 'Beverages', 'Other'
];

function categoriseIngredient(line: string): GroceryCategory {
  const l = line.toLowerCase();
  if (/\bfrozen\b/.test(l)) return 'Frozen';
  if (/\b(juice|water|coffee|tea|drink|wine|beer|beverage|soda|milk shake|smoothie)\b/.test(l)) return 'Beverages';
  if (/\b(milk|cheese|eggs?|butter|cream|yogurt|yoghurt|dairy|mozzarella|cheddar|parmesan|brie|feta|ricotta|sour cream|whipped cream)\b/.test(l)) return 'Dairy & Eggs';
  if (/\b(chicken|beef|pork|lamb|turkey|fish|salmon|tuna|shrimp|prawn|meat|steak|mince|bacon|sausage|ham|chorizo|tofu|tempeh)\b/.test(l)) return 'Proteins';
  if (/\b(flour|rice|pasta|bread|oats|oil|sauce|spice|salt|pepper|sugar|vinegar|honey|jam|cereal|noodle|cracker|biscuit|lentil|bean|chickpea|quinoa|couscous|barley|breadcrumb|panko|cornstarch|baking|yeast|vanilla)\b/.test(l)) return 'Grains & Pantry';
  if (/\b(apple|banana|orange|lemon|lime|berry|berries|strawberry|blueberry|grape|pear|peach|mango|pineapple|kiwi|avocado|tomato|lettuce|spinach|kale|carrot|onion|garlic|potato|pepper|cucumber|zucchini|broccoli|cauliflower|celery|mushroom|asparagus|corn|pea|bean|herbs?|basil|parsley|cilantro|coriander|mint|rosemary|thyme|sage|dill|ginger|chilli|capsicum|eggplant|leek|radish|beetroot|artichoke|cabbage|bok choy|fennel|arugula|watercress)\b/.test(l)) return 'Produce';
  return 'Other';
}

export default function GroceryPage() {
  const { showToast } = useToast();
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));
  const [groceryListId, setGroceryListId] = useState<string | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [addForm, setAddForm] = useState({ item_name: '', category: 'Other' as GroceryCategory });
  const [addSaving, setAddSaving] = useState(false);

  const weekStr = formatDateLocal(weekStart);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: plan } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_start', weekStr)
      .maybeSingle();

    if (!plan) { setGroceryListId(null); setItems([]); setLoading(false); return; }

    const { data: list } = await supabase
      .from('grocery_lists')
      .select('*')
      .eq('meal_plan_id', plan.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!list) { setGroceryListId(null); setItems([]); setLoading(false); return; }

    setGroceryListId(list.id);
    const { data: itemsData } = await supabase
      .from('grocery_items')
      .select('*')
      .eq('grocery_list_id', list.id)
      .order('category')
      .order('item_name');
    setItems(itemsData ?? []);
    setLoading(false);
  }, [weekStr]);

  useEffect(() => { loadData(); }, [loadData]);

  async function buildList() {
    setBuilding(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBuilding(false); return; }

    // Get or create meal plan
    let planId: string;
    const { data: plan } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_start', weekStr)
      .maybeSingle();

    if (plan) {
      planId = plan.id;
    } else {
      const { data: created, error } = await supabase
        .from('meal_plans')
        .insert({ user_id: user.id, week_start: weekStr })
        .select('id')
        .single();
      if (error) { showToast('Failed to create meal plan', 'error'); setBuilding(false); return; }
      planId = created.id;
    }

    // Get all recipe entries for this week
    const { data: entries } = await supabase
      .from('meal_plan_entries')
      .select('recipe_id, recipe:recipes(ingredients)')
      .eq('meal_plan_id', planId)
      .not('recipe_id', 'is', null);

    // Collect all ingredient lines
    const lines: string[] = [];
    for (const entry of entries ?? []) {
      const ingredients = (entry.recipe as { ingredients?: string } | null)?.ingredients;
      if (ingredients) {
        lines.push(...ingredients.split('\n').map((l: string) => l.trim()).filter(Boolean));
      }
    }

    if (lines.length === 0) {
      showToast('No recipe ingredients found for this week', 'info');
      setBuilding(false);
      return;
    }

    // Get or create grocery list
    let listId: string;
    const { data: existingList } = await supabase
      .from('grocery_lists')
      .select('id')
      .eq('meal_plan_id', planId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingList) {
      listId = existingList.id;
      // Clear existing items
      await supabase.from('grocery_items').delete().eq('grocery_list_id', listId);
    } else {
      const { data: created, error } = await supabase
        .from('grocery_lists')
        .insert({ meal_plan_id: planId, user_id: user.id })
        .select('id')
        .single();
      if (error) { showToast('Failed to create grocery list', 'error'); setBuilding(false); return; }
      listId = created.id;
    }

    const itemsToInsert = lines.map((line) => ({
      grocery_list_id: listId,
      item_name: line,
      category: categoriseIngredient(line),
      is_checked: false,
      amount: null,
    }));

    const { error } = await supabase.from('grocery_items').insert(itemsToInsert);
    if (error) {
      showToast('Failed to build grocery list: ' + error.message, 'error');
    } else {
      showToast('Grocery list built!', 'success');
      setGroceryListId(listId);
      const { data: itemsData } = await supabase
        .from('grocery_items')
        .select('*')
        .eq('grocery_list_id', listId)
        .order('category')
        .order('item_name');
      setItems(itemsData ?? []);
    }
    setBuilding(false);
  }

  async function toggleItem(item: GroceryItem) {
    const supabase = createClient();
    const { error } = await supabase
      .from('grocery_items')
      .update({ is_checked: !item.is_checked })
      .eq('id', item.id);
    if (!error) {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i));
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!groceryListId) {
      showToast('Build a grocery list first', 'info');
      return;
    }
    setAddSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('grocery_items')
      .insert({
        grocery_list_id: groceryListId,
        item_name: addForm.item_name,
        category: addForm.category,
        is_checked: false,
        amount: null,
      })
      .select()
      .single();
    if (error) {
      showToast('Failed to add item', 'error');
    } else {
      setItems((prev) => [...prev, data].sort((a, b) => a.category.localeCompare(b.category) || a.item_name.localeCompare(b.item_name)));
      setAddForm({ item_name: '', category: 'Other' });
    }
    setAddSaving(false);
  }

  async function clearList() {
    if (!groceryListId) return;
    if (!confirm('Clear all grocery items?')) return;
    setClearing(true);
    const supabase = createClient();
    await supabase.from('grocery_items').delete().eq('grocery_list_id', groceryListId);
    setItems([]);
    setClearing(false);
    showToast('List cleared', 'info');
  }

  // Group items by category
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {} as Record<GroceryCategory, GroceryItem[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Grocery List</h1>
        <button
          onClick={() => window.print()}
          className="border border-gray-300 text-gray-600 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 print:hidden"
        >
          🖨 Print
        </button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3 mb-5 print:hidden">
        <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50">← Prev</button>
        <button onClick={() => setWeekStart(getMondayOf(new Date()))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50">This week</button>
        <span className="text-sm font-medium text-gray-700">{formatDisplay(weekStart)} – {formatDisplay(addDays(weekStart, 6))}</span>
        <button onClick={() => setWeekStart((w) => addDays(w, 7))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50">Next →</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-5 print:hidden flex-wrap">
            <button
              onClick={buildList}
              disabled={building}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {building ? 'Building…' : '🛒 Build list from meal plan'}
            </button>
            {items.length > 0 && (
              <button
                onClick={clearList}
                disabled={clearing}
                className="border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                {clearing ? 'Clearing…' : 'Clear list'}
              </button>
            )}
          </div>

          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              No grocery items yet — build a list from your meal plan!
            </div>
          ) : (
            <div className="space-y-4">
              {(Object.entries(grouped) as [GroceryCategory, GroceryItem[]][]).map(([cat, catItems]) => (
                <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700">{cat}</h3>
                  </div>
                  <ul>
                    {catItems.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                        <button
                          onClick={() => toggleItem(item)}
                          className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors print:hidden ${
                            item.is_checked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {item.is_checked && <span className="text-white text-xs font-bold">✓</span>}
                        </button>
                        <span className={`text-sm flex-1 ${item.is_checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {item.item_name}
                        </span>
                        {/* Print checkbox */}
                        <span className="hidden print:inline-block w-4 h-4 border border-gray-400 rounded" />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Add item manually */}
          <div className="mt-5 print:hidden">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Add item manually</h3>
            <form onSubmit={addItem} className="flex gap-2 flex-wrap">
              <input
                required
                value={addForm.item_name}
                onChange={(e) => setAddForm((f) => ({ ...f, item_name: e.target.value }))}
                placeholder="Item name"
                className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={addForm.category}
                onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value as GroceryCategory }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button
                type="submit"
                disabled={addSaving}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {addSaving ? 'Adding…' : 'Add'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
