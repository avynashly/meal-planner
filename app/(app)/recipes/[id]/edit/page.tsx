'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { Recipe } from '@/types';

type Category = Recipe['category'];
const CATEGORIES: Category[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'];

export default function EditRecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'Dinner' as Category,
    cook_time_min: '',
    servings: '2',
    tags: '',
    ingredients: '',
    instructions: '',
    notes: '',
    is_favourite: false,
  });

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
        return;
      }
      setForm({
        name: data.name,
        category: data.category,
        cook_time_min: data.cook_time_min != null ? String(data.cook_time_min) : '',
        servings: String(data.servings),
        tags: (data.tags ?? []).join(', '),
        ingredients: data.ingredients ?? '',
        instructions: data.instructions ?? '',
        notes: data.notes ?? '',
        is_favourite: data.is_favourite,
      });
      setLoading(false);
    }
    load();
  }, [id, router, showToast]);

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from('recipes').update({
      name: form.name,
      category: form.category,
      cook_time_min: form.cook_time_min ? parseInt(form.cook_time_min) : null,
      servings: parseInt(form.servings) || 2,
      tags,
      ingredients: form.ingredients,
      instructions: form.instructions,
      notes: form.notes || null,
      is_favourite: form.is_favourite,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) {
      showToast('Failed to update recipe: ' + error.message, 'error');
      setSaving(false);
    } else {
      showToast('Recipe updated!', 'success');
      router.push(`/recipes/${id}`);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Recipe</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
          <input
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cook time (min)</label>
            <input
              type="number"
              min="0"
              value={form.cook_time_min}
              onChange={(e) => set('cook_time_min', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
            <input
              type="number"
              min="1"
              value={form.servings}
              onChange={(e) => set('servings', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ingredients (one per line)</label>
          <textarea
            rows={5}
            value={form.ingredients}
            onChange={(e) => set('ingredients', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (one step per line)</label>
          <textarea
            rows={5}
            value={form.instructions}
            onChange={(e) => set('instructions', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={form.is_favourite}
            onClick={() => set('is_favourite', !form.is_favourite)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              form.is_favourite ? 'bg-amber-400' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                form.is_favourite ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <label className="text-sm font-medium text-gray-700">Favourite ★</label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
