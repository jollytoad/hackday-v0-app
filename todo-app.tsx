"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, Plus, Loader2, Edit2, Check, X, GripVertical } from "lucide-react"
import { supabase, type Todo } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// Sortable Todo Item Component
function SortableTodoItem({
  todo,
  editingId,
  editingText,
  setEditingText,
  startEditing,
  saveEdit,
  cancelEdit,
  toggleTodo,
  deleteTodo,
}: {
  todo: Todo
  editingId: number | null
  editingText: string
  setEditingText: (text: string) => void
  startEditing: (todo: Todo) => void
  saveEdit: () => void
  cancelEdit: () => void
  toggleTodo: (id: number, completed: boolean) => void
  deleteTodo: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        todo.completed ? "bg-muted/50 border-muted" : "bg-background border-border hover:shadow-sm"
      } ${isDragging ? "shadow-lg z-10" : ""}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ml-1"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <Checkbox
        id={`todo-${todo.id}`}
        checked={todo.completed}
        onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
        disabled={editingId === todo.id}
      />

      {editingId === todo.id ? (
        // Edit mode
        <>
          <Input
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                saveEdit()
              } else if (e.key === "Escape") {
                cancelEdit()
              }
            }}
            className="flex-1"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={saveEdit}
            aria-label="Save edit"
            className="h-8 w-8 text-green-600 hover:text-green-700"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelEdit}
            aria-label="Cancel edit"
            className="h-8 w-8 text-gray-500 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        // View mode
        <>
          <label
            htmlFor={`todo-${todo.id}`}
            className={`flex-1 cursor-pointer ${
              todo.completed ? "line-through text-muted-foreground" : "text-foreground"
            }`}
            onDoubleClick={() => !todo.completed && startEditing(todo)}
            title="Double-click to edit"
          >
            {todo.text}
          </label>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => startEditing(todo)}
            aria-label={`Edit task: ${todo.text}`}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            disabled={todo.completed}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteTodo(todo.id)}
            aria-label={`Delete task: ${todo.text}`}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState("")
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState("")
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Fetch todos from Supabase
  const fetchTodos = async () => {
    try {
      const { data, error } = await supabase.from("todos").select("*").order("order_index", { ascending: true })

      if (error) {
        // PostgreSQL error code 42P01 = undefined_table
        if ((error as any).code === "42P01") {
          toast({
            title: "Database not initialised",
            description: "The todos table has not been created yet. Please run the SQL script in Supabase.",
            variant: "destructive",
          })
        }
        throw error
      }
      setTodos(data || [])
    } catch (error) {
      console.error("Error fetching todos:", error)
      toast({
        title: "Error",
        description: "Failed to load todos. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Add new todo
  const addTodo = async () => {
    if (newTodo.trim() === "") return

    setAdding(true)
    try {
      // Get the highest order_index and add 1
      const maxOrder = todos.length > 0 ? Math.max(...todos.map((t) => t.order_index)) : 0

      const { data, error } = await supabase
        .from("todos")
        .insert([{ text: newTodo.trim(), order_index: maxOrder + 1 }])
        .select()
        .single()

      if (error) throw error

      setTodos([...todos, data])
      setNewTodo("")
      toast({
        title: "Success",
        description: "Todo added successfully!",
      })
    } catch (error) {
      console.error("Error adding todo:", error)
      toast({
        title: "Error",
        description: "Failed to add todo. Please try again.",
        variant: "destructive",
      })
    } finally {
      setAdding(false)
    }
  }

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = todos.findIndex((todo) => todo.id === active.id)
    const newIndex = todos.findIndex((todo) => todo.id === over.id)

    const newTodos = arrayMove(todos, oldIndex, newIndex)

    // Update local state immediately for smooth UX
    setTodos(newTodos)

    try {
      // Update order_index for all affected todos
      const updates = newTodos.map((todo, index) => ({
        id: todo.id,
        order_index: index,
      }))

      // Update in batches for better performance
      for (const update of updates) {
        await supabase.from("todos").update({ order_index: update.order_index }).eq("id", update.id)
      }

      toast({
        title: "Success",
        description: "Todo order updated successfully!",
      })
    } catch (error) {
      console.error("Error updating todo order:", error)
      // Revert the local state if the update failed
      setTodos(todos)
      toast({
        title: "Error",
        description: "Failed to update todo order. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Start editing a todo
  const startEditing = (todo: Todo) => {
    setEditingId(todo.id)
    setEditingText(todo.text)
  }

  // Save edited todo
  const saveEdit = async () => {
    if (editingId === null || editingText.trim() === "") return

    try {
      const { error } = await supabase.from("todos").update({ text: editingText.trim() }).eq("id", editingId)

      if (error) throw error

      setTodos(todos.map((todo) => (todo.id === editingId ? { ...todo, text: editingText.trim() } : todo)))

      setEditingId(null)
      setEditingText("")

      toast({
        title: "Success",
        description: "Todo updated successfully!",
      })
    } catch (error) {
      console.error("Error updating todo:", error)
      toast({
        title: "Error",
        description: "Failed to update todo. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null)
    setEditingText("")
  }

  // Toggle todo completion
  const toggleTodo = async (id: number, completed: boolean) => {
    try {
      const { error } = await supabase.from("todos").update({ completed: !completed }).eq("id", id)

      if (error) throw error

      setTodos(todos.map((todo) => (todo.id === id ? { ...todo, completed: !completed } : todo)))
    } catch (error) {
      console.error("Error updating todo:", error)
      toast({
        title: "Error",
        description: "Failed to update todo. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Delete todo
  const deleteTodo = async (id: number) => {
    try {
      const { error } = await supabase.from("todos").delete().eq("id", id)

      if (error) throw error

      setTodos(todos.filter((todo) => todo.id !== id))
      toast({
        title: "Success",
        description: "Todo deleted successfully!",
      })
    } catch (error) {
      console.error("Error deleting todo:", error)
      toast({
        title: "Error",
        description: "Failed to delete todo. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Clear completed todos
  const clearCompleted = async () => {
    const completedIds = todos.filter((todo) => todo.completed).map((todo) => todo.id)

    try {
      const { error } = await supabase.from("todos").delete().in("id", completedIds)

      if (error) throw error

      setTodos(todos.filter((todo) => !todo.completed))
      toast({
        title: "Success",
        description: "Completed todos cleared successfully!",
      })
    } catch (error) {
      console.error("Error clearing completed todos:", error)
      toast({
        title: "Error",
        description: "Failed to clear completed todos. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Load todos on component mount
  useEffect(() => {
    fetchTodos()
  }, [])

  const completedCount = todos.filter((todo) => todo.completed).length
  const totalCount = todos.length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading todos...</span>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Todo List</CardTitle>
            {totalCount > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {completedCount} of {totalCount} tasks completed
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add new todo */}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Add a new task..."
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !adding) {
                    addTodo()
                  }
                }}
                className="flex-1"
                disabled={adding}
              />
              <Button onClick={addTodo} size="icon" aria-label="Add task" disabled={adding || newTodo.trim() === ""}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {/* Todo list with drag and drop */}
            <div className="space-y-2">
              {todos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No tasks yet. Add one above!</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={todos.map((todo) => todo.id)} strategy={verticalListSortingStrategy}>
                    {todos.map((todo) => (
                      <SortableTodoItem
                        key={todo.id}
                        todo={todo}
                        editingId={editingId}
                        editingText={editingText}
                        setEditingText={setEditingText}
                        startEditing={startEditing}
                        saveEdit={saveEdit}
                        cancelEdit={cancelEdit}
                        toggleTodo={toggleTodo}
                        deleteTodo={deleteTodo}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Clear completed tasks */}
            {completedCount > 0 && (
              <div className="pt-4 border-t">
                <Button variant="outline" size="sm" onClick={clearCompleted} className="w-full">
                  Clear {completedCount} completed task{completedCount !== 1 ? "s" : ""}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
