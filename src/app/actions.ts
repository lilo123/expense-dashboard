'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { Expense } from '@/types/database'

export async function addExpenseAction(data: {
  item: string
  amount: number
  category_id: string
  date: string
}): Promise<{ success: boolean; data?: Expense; error?: string }> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data: newExpense, error } = await supabase
    .from('expenses')
    .insert([
      {
        user_id: userData.user.id,
        item: data.item,
        amount: data.amount,
        category_id: data.category_id,
        date: data.date
      }
    ])
    .select('*, categories(name)')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true, data: newExpense }
}

export async function deleteExpenseAction(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  
  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function updateExpenseAction(
  id: string,
  updates: Partial<{ item: string; amount: number; category_id: string; date: string }>
): Promise<{ success: boolean; data?: Expense; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .select('*, categories(name)')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true, data }
}

export async function addCategoryAction(name: string): Promise<{ success: boolean; data?: { id: string, name: string }; error?: string }> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  
  if (userError || !userData?.user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('categories')
    .insert([{ user_id: userData.user.id, name }])
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A category with this name already exists. Please choose a different name.' }
    }
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true, data }
}

export async function updateCategoryAction(id: string, name: string): Promise<{ success: boolean; data?: { id: string, name: string }; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .update({ name })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true, data }
}

export async function deleteCategoryAction(id: string, fallbackCategoryId?: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  if (fallbackCategoryId) {
    // Reassign expenses first
    const { error: updateError } = await supabase
      .from('expenses')
      .update({ category_id: fallbackCategoryId })
      .eq('category_id', id)

    if (updateError) {
      return { success: false, error: updateError.message }
    }
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)
  
  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function bulkDeleteAction(ids: string[]): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().in('id', ids)
  
  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function bulkUpdateAction(
  ids: string[],
  updates: Partial<{ item: string; amount: number; category_id: string; date: string }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').update(updates).in('id', ids)
  
  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}
