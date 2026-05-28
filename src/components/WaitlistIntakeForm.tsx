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
      <div className="bg-zen-sage/30 border border-white/30 backdrop-blur-md rounded-2xl sm:rounded-full px-6 sm:px-8 py-4 text-center max-w-xl w-full shadow-sm mx-auto">
        <p className="text-zen-charcoal font-bold text-sm sm:text-base">
          Your invitation request has been logged. We will reach out quietly when your spot opens.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white/60 backdrop-blur-md border border-white/40 shadow-sm rounded-2xl sm:rounded-full p-2 sm:p-1.5 w-full gap-3 sm:gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email for private access"
            aria-label="Email address for private access"
            className="flex-1 bg-transparent text-zen-charcoal placeholder:text-zen-charcoal/50 px-4 sm:pl-6 sm:pr-3 py-3 outline-none text-base w-full border-none"
            disabled={isPending}
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-zen-charcoal text-zen-base rounded-full font-bold px-6 sm:px-8 py-3 sm:py-3.5 hover:bg-zen-charcoal/90 disabled:opacity-50 disabled:pointer-events-none transition-all text-base shrink-0 shadow-md flex items-center justify-center w-full sm:w-auto sm:min-w-[220px] hover:scale-[1.02] active:scale-[0.98]"
          >
            {isPending ? 'Requesting...' : 'Request Private Access'}
          </button>
        </div>
        {errorMessage && (
          <p className="text-zen-peach text-sm font-bold px-4 text-center">
            {errorMessage}
          </p>
        )}
      </form>
    </div>
  )
}
