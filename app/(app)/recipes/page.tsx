'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import RecipeCard from '@/components/RecipeCard';
import { Recipe } from '@/types';
import { useToast } from '@/components/Toast';

const CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'] as const;

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [seeding, setSeeding] = useState(false);
  const { showToast } = useToast();

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      showToast('Failed to load recipes', 'error');
    } else {
      setRecipes(data ?? []);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  async function toggleFavourite(id: string, current: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from('recipes')
      .update({ is_favourite: !current, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      showToast('Failed to update favourite', 'error');
    } else {
      setRecipes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_favourite: !current } : r))
      );
    }
  }

  async function seedRecipes() {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed-recipes', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`Added ${data.inserted} test recipes!`, 'success');
      await fetchRecipes();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Seed failed', 'error');
    }
    setSeeding(false);
  }

  const filtered = recipes.filter((r) => {
    const matchCat = category === 'All' || r.category === category;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      (r.tags ?? []).some((t) => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
        <Link
          href="/recipes/new"
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Recipe
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              category === cat
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">
            {recipes.length === 0
              ? "No recipes yet — add your first one!"
              : "No recipes match your search."}
          </p>
          {recipes.length === 0 && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <Link
                href="/recipes/new"
                className="inline-block bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
              >
                Add Recipe
              </Link>
              <button
                onClick={seedRecipes}
                disabled={seeding}
                className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 disabled:opacity-50"
              >
                {seeding ? 'Adding test recipes…' : 'Or add 10 test recipes'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onToggleFavourite={toggleFavourite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
