import { useState, type FormEvent } from 'react'

type LoginScreenProps = {
  onLogin: (email: string) => void
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const emailIsValid = /^[^\s@]+@gmail\.com$/i.test(email.trim())

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    if (!emailIsValid || !password) {
      setMessage(!emailIsValid ? 'Usa tu correo docente terminado en @gmail.com.' : 'Ingresa tu contraseña.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (!response.ok) {
        setMessage(response.status === 401 ? 'Correo o contraseña incorrectos.' : 'No fue posible iniciar sesión. Inténtalo de nuevo.')
        return
      }
      setPassword('')
      onLogin(email.trim())
    } catch {
      setMessage('No se pudo conectar con Serena. Verifica que los servidores estén iniciados.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-10 text-gray-950">
      <section className="w-full max-w-[390px]" aria-labelledby="login-title">
        <header className="mb-7 text-center">
          <h1 id="login-title" className="text-[30px] font-black leading-tight text-[#d51f28]">Serena</h1>
          <p className="mt-1 text-xs text-gray-600">Aprendizaje Socioemocional</p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-100 bg-white px-6 pb-5 pt-6 shadow-md" noValidate>
          <label htmlFor="teacher-email" className="mb-2 block text-sm font-bold">Correo electrónico institucional</label>
          <input
            id="teacher-email"
            name="email"
            type="email"
            autoComplete="username"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(email) && !emailIsValid}
            aria-describedby="email-hint"
            placeholder="docente@gmail.com"
            className="h-11 w-full rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-100"
          />
          <p id="email-hint" className={`mt-1 min-h-4 text-xs ${email && !emailIsValid ? 'text-red-600' : 'text-transparent'}`} aria-live="polite">
            {email && !emailIsValid ? 'El correo debe terminar en @gmail.com.' : 'Correo válido.'}
          </p>

          <label htmlFor="teacher-password" className="mb-2 mt-3 block text-sm font-bold">Contraseña</label>
          <div className="relative">
            <input
              id="teacher-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingresa tu contraseña"
              className="h-11 w-full rounded-md border border-gray-300 px-3 pr-12 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded text-gray-500 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-red-500"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 flex h-11 w-full items-center justify-center rounded-md bg-[#d51f28] text-sm font-bold text-white transition hover:bg-[#be1b23] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            {isSubmitting ? 'Validando…' : 'Iniciar sesión'}
          </button>
          <p className="mt-3 min-h-5 text-center text-xs text-red-700" role="status" aria-live="polite">{message}</p>
          <p className="mt-1 text-center text-[11px] text-gray-500">Tus credenciales se usan únicamente para validar tu acceso.</p>
        </form>
      </section>
    </main>
  )
}
