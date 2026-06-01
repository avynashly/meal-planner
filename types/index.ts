export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  category: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Dessert';
  cook_time_min: number | null;
  servings: number;
  tags: string[];
  ingredients: string;
  instructions: string;
  notes: string | null;
  image_url: string | null;
  is_favourite: boolean;
  created_at: string;
  updated_at: string;
}

export interface MealPlan {
  id: string;
  user_id: string;
  week_start: string;
  notes: string | null;
  diet_style: string | null;
  created_at: string;
  updated_at: string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface MealPlanEntry {
  id: string;
  meal_plan_id: string;
  day_of_week: DayOfWeek;
  meal_type: MealType;
  recipe_id: string | null;
  custom_meal: string | null;
  servings: number;
  created_at: string;
  recipe?: Recipe;
}

export interface GroceryList {
  id: string;
  meal_plan_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type GroceryCategory =
  | 'Produce'
  | 'Proteins'
  | 'Dairy & Eggs'
  | 'Grains & Pantry'
  | 'Frozen'
  | 'Beverages'
  | 'Other';

export interface GroceryItem {
  id: string;
  grocery_list_id: string;
  category: GroceryCategory;
  item_name: string;
  amount: string | null;
  is_checked: boolean;
  created_at: string;
}
