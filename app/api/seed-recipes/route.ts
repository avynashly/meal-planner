import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SEED_RECIPES = [
  {
    name: 'Scrambled Eggs & Toast',
    category: 'Breakfast',
    cook_time_min: 10,
    servings: 2,
    tags: ['quick', 'easy', 'eggs'],
    ingredients: `4 large eggs\n2 tbsp butter\n2 tbsp milk\nSalt and pepper\n2 slices sourdough bread\n1 tbsp chives, chopped`,
    instructions: `Crack eggs into a bowl, add milk, salt and pepper, and whisk.\nMelt butter in a non-stick pan over low heat.\nAdd egg mixture and stir gently with a spatula until softly set.\nToast the bread.\nServe eggs on toast, topped with chives.`,
    notes: "Low heat is key — don't rush the eggs.",
    is_favourite: true,
  },
  {
    name: 'Overnight Oats',
    category: 'Breakfast',
    cook_time_min: 5,
    servings: 1,
    tags: ['meal-prep', 'no-cook', 'healthy'],
    ingredients: `80g rolled oats\n200ml oat milk\n1 tbsp chia seeds\n1 tbsp honey\n100g mixed berries\n2 tbsp Greek yogurt`,
    instructions: `Combine oats, oat milk, chia seeds and honey in a jar.\nStir well, cover and refrigerate overnight.\nIn the morning, top with Greek yogurt and berries.\nAdd a splash more milk if too thick.`,
    notes: 'Make 3–4 jars at once for the whole week.',
    is_favourite: false,
  },
  {
    name: 'Avocado Toast with Poached Egg',
    category: 'Breakfast',
    cook_time_min: 15,
    servings: 2,
    tags: ['avocado', 'eggs', 'brunch'],
    ingredients: `2 slices thick sourdough\n1 ripe avocado\nJuice of half a lemon\nSalt, pepper, chilli flakes\n2 eggs\n1 tsp white wine vinegar\nFresh coriander to serve`,
    instructions: `Toast the bread until golden.\nMash avocado with lemon juice, salt and pepper.\nBring a pan of water to a gentle simmer, add vinegar.\nSwirl the water and slide in each egg. Poach for 3 minutes.\nSpread avocado on toast, top with poached egg.\nSprinkle chilli flakes and coriander.`,
    notes: null,
    is_favourite: true,
  },
  {
    name: 'Chicken Caesar Salad',
    category: 'Lunch',
    cook_time_min: 20,
    servings: 2,
    tags: ['salad', 'chicken', 'classic'],
    ingredients: `2 chicken breasts\n1 tbsp olive oil\nSalt and pepper\n1 romaine lettuce, chopped\n40g parmesan, shaved\nCroutons\n4 tbsp Caesar dressing\n1 lemon wedge`,
    instructions: `Season chicken with oil, salt and pepper.\nGrill or pan-fry for 6–7 minutes each side until cooked through.\nRest for 5 minutes, then slice.\nToss lettuce with Caesar dressing.\nTop with chicken, parmesan and croutons.\nServe with a lemon wedge.`,
    notes: 'Use store-bought rotisserie chicken to save time.',
    is_favourite: false,
  },
  {
    name: 'Tomato & Lentil Soup',
    category: 'Lunch',
    cook_time_min: 35,
    servings: 4,
    tags: ['soup', 'vegetarian', 'meal-prep'],
    ingredients: `1 tbsp olive oil\n1 onion, diced\n3 garlic cloves, minced\n2 tsp cumin\n1 tsp smoked paprika\n400g can chopped tomatoes\n200g red lentils, rinsed\n1 litre vegetable stock\nSalt and pepper\nFresh parsley to serve`,
    instructions: `Heat oil in a large pot. Sauté onion for 5 minutes until soft.\nAdd garlic, cumin and paprika, cook 1 minute.\nAdd tomatoes, lentils and stock. Bring to a boil.\nReduce heat and simmer 20–25 minutes until lentils are soft.\nBlend half the soup for a creamier texture.\nSeason and serve topped with parsley.`,
    notes: 'Freezes well for up to 3 months.',
    is_favourite: false,
  },
  {
    name: 'Greek Chicken Bowl',
    category: 'Lunch',
    cook_time_min: 25,
    servings: 2,
    tags: ['greek', 'chicken', 'healthy', 'bowl'],
    ingredients: `2 chicken thighs, boneless\n2 tbsp olive oil\n1 tsp oregano\n1 tsp garlic powder\nJuice of 1 lemon\n200g cooked brown rice\n1 cucumber, diced\n200g cherry tomatoes, halved\n100g feta cheese\n50g kalamata olives\n4 tbsp tzatziki`,
    instructions: `Marinate chicken in olive oil, oregano, garlic powder and lemon juice for 10 minutes.\nCook in a hot pan for 6 minutes per side.\nRest 5 minutes, then slice.\nDivide rice between bowls.\nTop with chicken, cucumber, tomatoes, feta and olives.\nDrizzle with tzatziki.`,
    notes: null,
    is_favourite: true,
  },
  {
    name: 'Spaghetti Bolognese',
    category: 'Dinner',
    cook_time_min: 45,
    servings: 4,
    tags: ['pasta', 'beef', 'classic', 'family'],
    ingredients: `500g beef mince\n1 onion, finely diced\n2 carrots, finely diced\n2 celery sticks, finely diced\n4 garlic cloves, minced\n2 tbsp olive oil\n150ml red wine\n400g can chopped tomatoes\n2 tbsp tomato paste\n1 tsp dried oregano\n400g spaghetti\nParmesan to serve`,
    instructions: `Heat oil in a large pan. Sauté onion, carrot and celery for 8 minutes.\nAdd garlic and cook 1 minute.\nAdd mince and brown well, breaking it up.\nPour in wine and reduce by half.\nAdd tomatoes, paste and oregano. Simmer on low for 25–30 minutes.\nCook spaghetti according to packet. Drain, reserving a cup of pasta water.\nToss pasta with sauce, adding pasta water to loosen.\nServe with parmesan.`,
    notes: 'Better the next day — make a double batch.',
    is_favourite: true,
  },
  {
    name: 'Salmon with Roasted Vegetables',
    category: 'Dinner',
    cook_time_min: 30,
    servings: 2,
    tags: ['salmon', 'fish', 'healthy', 'quick'],
    ingredients: `2 salmon fillets\n1 courgette, sliced\n1 red pepper, chunked\n200g cherry tomatoes\n1 red onion, wedged\n3 tbsp olive oil\n1 tsp dried thyme\nSalt and pepper\n1 lemon, sliced`,
    instructions: `Preheat oven to 200°C.\nToss vegetables in 2 tbsp olive oil, thyme, salt and pepper.\nSpread on a roasting tray and roast for 15 minutes.\nRub salmon with remaining oil and season.\nPlace salmon on top of vegetables, add lemon slices.\nRoast for a further 12–15 minutes until salmon flakes easily.\nServe straight from the tray.`,
    notes: 'Any firm white fish works well here too.',
    is_favourite: false,
  },
  {
    name: 'Chicken & Spinach Curry',
    category: 'Dinner',
    cook_time_min: 40,
    servings: 4,
    tags: ['curry', 'chicken', 'spinach', 'indian'],
    ingredients: `600g chicken breast, cubed\n1 large onion, diced\n4 garlic cloves, minced\n1 tbsp fresh ginger, grated\n2 tbsp vegetable oil\n2 tbsp curry powder\n1 tsp turmeric\n400g can coconut milk\n400g can chopped tomatoes\n200g fresh spinach\nSalt to taste\nCooked basmati rice to serve`,
    instructions: `Heat oil in a large pan. Fry onion until golden, about 8 minutes.\nAdd garlic, ginger, curry powder and turmeric. Cook 2 minutes.\nAdd chicken and brown on all sides.\nPour in coconut milk and tomatoes. Bring to a simmer.\nCook uncovered for 20 minutes until sauce thickens.\nStir in spinach and wilt for 2 minutes.\nSeason and serve over basmati rice.`,
    notes: 'Add a chilli for extra heat.',
    is_favourite: true,
  },
  {
    name: 'Veggie Stir-Fry with Noodles',
    category: 'Dinner',
    cook_time_min: 20,
    servings: 2,
    tags: ['vegetarian', 'quick', 'asian', 'noodles'],
    ingredients: `200g egg noodles\n2 tbsp sesame oil\n1 red pepper, sliced\n1 courgette, sliced\n150g tenderstem broccoli\n2 garlic cloves, minced\n1 tbsp fresh ginger, grated\n3 tbsp soy sauce\n1 tbsp oyster sauce\n1 tsp chilli flakes\n2 spring onions, sliced\n1 tbsp sesame seeds`,
    instructions: `Cook noodles according to packet, drain and toss with a little oil.\nHeat sesame oil in a wok over high heat.\nStir-fry broccoli and pepper for 3 minutes.\nAdd courgette, garlic and ginger, cook 2 minutes.\nAdd noodles, soy sauce, oyster sauce and chilli flakes.\nToss everything together for 2 minutes.\nServe topped with spring onions and sesame seeds.`,
    notes: 'Add tofu or prawns for extra protein.',
    is_favourite: false,
  },
];

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const recipes = SEED_RECIPES.map((r) => ({ ...r, user_id: user.id }));

  const { data, error } = await supabase.from('recipes').insert(recipes).select('id, name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: data?.length ?? 0, recipes: data });
}
