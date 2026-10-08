import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  BatteryCharging,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth';

const schema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(8, 'Use pelo menos 8 caracteres'),
});
type LoginValues = z.infer<typeof schema>;

export function LoginPage() {
  const { session, login, enterDemo } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  if (session) return <Navigate to="/dashboard" replace />;

  async function onSubmit(values: LoginValues) {
    setSubmitError('');
    try {
      await login(values.email, values.password);
      navigate('/dashboard');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível entrar');
    }
  }

  function openDemo() {
    enterDemo();
    navigate('/dashboard');
  }

  return (
    <main className="login-shell">
      <section className="login-story" aria-label="Sobre o EV ChargeOps">
        <div className="brand brand-light">
          <span className="brand-mark">
            <Zap size={19} fill="currentColor" />
          </span>
          <span>
            EV Charge<span>Ops</span>
          </span>
        </div>
        <div className="story-copy">
          <p className="eyebrow light">Energia compartilhada. Gestão inteligente.</p>
          <h1>Transforme cada recarga em uma decisão melhor.</h1>
          <p>
            Consumo individual, rateio transparente e visão operacional em uma única plataforma.
          </p>
          <div className="story-features">
            <div>
              <CheckCircle2 size={20} />
              <span>
                <b>Rateio justo</b>
                <small>Cobrança por consumo validado</small>
              </span>
            </div>
            <div>
              <BatteryCharging size={20} />
              <span>
                <b>Operação visível</b>
                <small>Status e sessões em tempo real</small>
              </span>
            </div>
            <div>
              <ShieldCheck size={20} />
              <span>
                <b>Dados protegidos</b>
                <small>Acesso por perfil e unidade</small>
              </span>
            </div>
          </div>
        </div>
        <div className="story-meter" aria-hidden="true">
          <span className="meter-ring">
            <BatteryCharging size={27} />
          </span>
          <div>
            <small>Recarga ativa</small>
            <strong>10,8 kW</strong>
          </div>
          <div className="meter-bars">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <p className="story-footer">Enterprise Challenge 2026 · GoodWe + FIAP</p>
      </section>

      <section className="login-panel">
        <div className="mobile-brand brand">
          <span className="brand-mark">
            <Zap size={19} fill="currentColor" />
          </span>
          <span>
            EV Charge<span>Ops</span>
          </span>
        </div>
        <div className="login-card">
          <p className="eyebrow">Portal de gestão</p>
          <h2>Bem-vindo de volta</h2>
          <p className="muted">Acesse sua conta para acompanhar a operação.</p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <label>
              E-mail
              <input
                type="email"
                autoComplete="email"
                placeholder="nome@condominio.com.br"
                {...register('email')}
              />
            </label>
            {errors.email && <span className="field-error">{errors.email.message}</span>}
            <label>
              Senha
              <span className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {errors.password && <span className="field-error">{errors.password.message}</span>}
            {submitError && (
              <div className="form-alert" role="alert">
                {submitError}
              </div>
            )}
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando…' : 'Entrar'}
              <ArrowRight size={18} />
            </button>
          </form>
          {import.meta.env.VITE_ENABLE_DEMO === 'true' && (
            <button className="demo-button" type="button" onClick={openDemo}>
              <Building2 size={17} />
              Explorar demonstração
            </button>
          )}
          <p className="security-note">
            <ShieldCheck size={15} />
            Ambiente seguro. Suas credenciais são criptografadas.
          </p>
        </div>
      </section>
    </main>
  );
}
