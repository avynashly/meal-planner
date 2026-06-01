'use client';

import Link from 'next/link';
import { Recipe } from '@/types';
import CategoryBadge from './CategoryBadge';

interface RecipeCardProps {
  recipe: Recipe;
  onToggleFavourite?: (id: string, current: boolean) => void;
}

export default function RecipeCard({ recipe, onToggleFavourite }: RecipeCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/recipes/${recipe.id}`} className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors">
            {recipe.name}
          </h3>
        </Link>
        {onToggleFavourite && (
          <button
            onClick={() => onToggleFavourite(recipe.id, recipe.is_favourite)}
            className="text-xl leading-none flex-shrink-0 focus:outline-none"
            title={recipe.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
          >
            {recipe.is_favourite ? '★' : '☆'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <CategoryBadge category={recipe.category} />
        {recipe.cook_time_min != null && (
          <span className="text-xs text-gray-500">{recipe.cook_time_min} min</span>
        )}
        {recipe.servings > 0 && (
          <span className="text-xs text-gray-500">{recipe.servings} servings</span>
        )}
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
    </div>
  );
}
