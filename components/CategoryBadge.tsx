import { Recipe } from '@/types';

const categoryColors: Record<Recipe['category'], string> = {
  Breakfast: 'bg-amber-100 text-amber-800',
  Lunch: 'bg-teal-100 text-teal-800',
  Dinner: 'bg-blue-100 text-blue-800',
  Snack: 'bg-green-100 text-green-800',
  Dessert: 'bg-pink-100 text-pink-800',
};

export default function CategoryBadge({ category }: { category: Recipe['category'] }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[category]}`}>
      {category}
    </span>
  );
}
