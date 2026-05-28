'use client'

import { useState, useTransition } from 'react'
import { requestInviteAction } from '@/app/actions'

export default function WaitlistIntakeForm() {
  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccess(false)

    if (!email.trim()) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    startTransition(async () => {
      const res = await requestInviteAction(email, 'Private waitlist intake access request')
      if (res.success) {
        setSuccess(true)
        setEmail('')
      } else {
        setErrorMessage(res.error || 'Failed to request invite. Please try again.')
      }
    })
  }

  if (success) {
    return (
      <div className="bg-zen-sage/30 border border-white/30 backdrop-blur-md rounded-2xl p-6 text-center max-w-md w-full shadow-sm animate-fade-in">
        <p className="text-zen-charcoal font-medium">
          Your invitation request has been logged. We will reach out quietly when your spot opens.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email for private access"
            aria-label="Email address for private access"
            className="flex-1 bg-white/40 backdrop-blur-md border border-white/20 shadow-sm rounded-full text-zen-charcoal placeholder:text-zen-charcoal/50 px-6 py-4 outline-none focus:border-zen-charcoal/30 transition-all text-base"
            disabled={isPending}
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-zen-charcoal text-zen-base rounded-full font-bold px-8 py-4 hover:bg-zen-charcoal/90 disabled:opacity-50 transition-all text-base shrink-0 shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            {isPending ? 'Requesting...' : 'Request Private Access'}
          </button>
        </div>
        {errorMessage && (
          <p className="text-zen-peach text-sm font-medium px-4 text-center">
            {errorMessage}
          </p>
        )}
      </form>
    </div>
  )
}
