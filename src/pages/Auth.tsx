import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/hooks/use-language'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Mail, Lock } from 'lucide-react'
import closerLogo from '@/assets/closer_logo-fcd09.png'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function Auth() {
  const { user, signIn, signUp, loading } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to="/app" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const result =
        mode === 'signin' ? await signIn(email, password) : await signUp(email, password)

      if (result.error) {
        setError(getErrorMessage(result.error))
        return
      }

      navigate('/app', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="px-6 py-4 flex items-center justify-between">
        <Link to="/">
          <img src={closerLogo} alt="Closer" className="h-8 w-auto object-contain" />
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-elevation border border-border/40 rounded-[2rem]">
          <CardHeader className="space-y-2 text-center pb-6">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {mode === 'signin' ? t('sign_in') : t('get_started')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {mode === 'signin'
                ? 'Entre na sua conta para continuar'
                : 'Crie sua conta para começar'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="voce@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 rounded-xl"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 rounded-xl"
                    required
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
              <Button
                type="submit"
                className="w-full rounded-xl h-12 font-medium"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : mode === 'signin' ? (
                  t('sign_in')
                ) : (
                  t('get_started')
                )}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                  setError(null)
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {mode === 'signin' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
              </button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
