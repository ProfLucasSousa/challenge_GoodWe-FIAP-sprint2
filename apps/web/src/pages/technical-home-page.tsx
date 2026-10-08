import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Braces,
  Database,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const stack = [
  { icon: Braces, name: 'React + Vite', note: 'Interface TypeScript com Tailwind CSS' },
  { icon: Server, name: 'NestJS', note: 'API tipada com OpenAPI e Swagger' },
  { icon: Database, name: 'PostgreSQL', note: 'Persistência gerenciada pelo Prisma' },
  { icon: ShieldCheck, name: 'Read-only first', note: 'Integrações isoladas por provider' },
];

export function TechnicalHomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    retry: false,
    refetchInterval: 15_000,
  });
  const connected = health.data?.status === 'ok';

  return (
    <main className="technical-home">
      <div className="technical-glow" aria-hidden="true" />
      <header className="technical-nav">
        <div className="brand">
          <span className="brand-mark">
            <Zap size={19} fill="currentColor" />
          </span>
          <span>
            EV Charge<span>Ops</span>
          </span>
        </div>
        <nav aria-label="Acessos rápidos">
          <a href="/api/docs" target="_blank" rel="noreferrer">
            <BookOpen size={16} /> API Docs
          </a>
          <Link to="/login">
            Acessar operação <ArrowRight size={16} />
          </Link>
        </nav>
      </header>

      <section className="technical-hero">
        <div className="technical-copy">
          <p className="eyebrow">Fundação técnica · Sprint 1</p>
          <h1>Uma base segura para operar a recarga compartilhada.</h1>
          <p className="technical-lead">
            Monorepo preparado para evoluir integrações, telemetria e rateio sem acoplar o domínio a
            um único fabricante.
          </p>
          <div className="technical-actions">
            <Link className="technical-primary" to="/login">
              Abrir painel <ArrowRight size={17} />
            </Link>
            <a className="technical-secondary" href="/api/docs" target="_blank" rel="noreferrer">
              Explorar Swagger
            </a>
          </div>
        </div>

        <aside className="health-card" aria-live="polite">
          <div className="health-card-heading">
            <span>System health</span>
            <button
              type="button"
              onClick={() => void health.refetch()}
              aria-label="Consultar API novamente"
            >
              <RefreshCw size={15} className={health.isFetching ? 'spin' : ''} />
            </button>
          </div>
          <div className={`health-state ${connected ? 'connected' : 'unavailable'}`}>
            <i />
            <div>
              <small>{health.isFetching && !health.data ? 'VERIFICANDO' : 'STATUS ATUAL'}</small>
              <strong>{connected ? 'API conectada' : 'API indisponível'}</strong>
            </div>
          </div>
          <div className="health-contract">
            <span>
              <b>GET</b> /api/health
            </span>
            <code>{connected ? '{ "status": "ok" }' : '{ "status": "unavailable" }'}</code>
          </div>
          <p>Verificação automática a cada 15 segundos.</p>
        </aside>
      </section>

      <section className="stack-section" aria-labelledby="stack-title">
        <div>
          <p className="eyebrow">Arquitetura inicial</p>
          <h2 id="stack-title">Pronta para desenvolver e testar.</h2>
        </div>
        <div className="stack-grid">
          {stack.map(({ icon: Icon, name, note }) => (
            <article key={name}>
              <span>
                <Icon size={19} />
              </span>
              <h3>{name}</h3>
              <p>{note}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
