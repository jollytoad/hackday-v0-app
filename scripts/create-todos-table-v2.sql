-- Add order column to existing todos table
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Update existing todos to have sequential order values
UPDATE public.todos 
SET order_index = subquery.row_number 
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as row_number 
  FROM public.todos
) AS subquery 
WHERE public.todos.id = subquery.id;

-- Create index for better performance on ordering
CREATE INDEX IF NOT EXISTS idx_todos_order ON public.todos(order_index);
