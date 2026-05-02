'use client'

import { useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.push('/')
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else setMessage('Check your email for the confirmation link.')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50 dark:bg-zinc-900">
      <div className="p-8 bg-white dark:bg-black rounded-lg shadow-md w-96 border dark:border-zinc-800">
        <h1 className="mb-6 text-2xl font-bold text-center text-gray-900 dark:text-white">Welcome</h1>
        <form className="flex flex-col space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
            required
          />
          <button
            onClick={handleSignIn}
            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Sign In
          </button>
          <button
            onClick={handleSignUp}
            className="w-full px-4 py-2 font-bold text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-zinc-800"
          >
            Sign Up
          </button>
        </form>
        {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
        {message && <p className="mt-4 text-sm text-green-600 text-center">{message}</p>}
      </div>
    </div>
  )
}
