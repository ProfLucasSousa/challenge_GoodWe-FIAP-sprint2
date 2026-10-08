import {
  Activity,
  BarChart3,
  BatteryCharging,
  Building2,
  Cable,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PlugZap,
  Tag,
  UserCircle,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

const sections = [
  {
    label: 'OPERAÇÃO',
    items: [
      { to: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
      { to: '/carregadores', label: 'Carregadores', icon: BatteryCharging },
      { to: '/sessoes', label: 'Sessões', icon: Activity },
    ],
  },
  {
    label: 'GESTÃO COMPARTILHADA',
    items: [
      { to: '/unidades', label: 'Unidades', icon: Building2 },
      { to: '/usuarios', label: 'Usuários', icon: Users },
      { to: '/veiculos', label: 'Veículos', icon: Cable },
      { to: '/rfids', label: 'Cartões RFID', icon: CreditCard },
    ],
  },
  {
    label: 'RATEIO E INTELIGÊNCIA',
    items: [
      { to: '/tarifas', label: 'Tarifas', icon: Tag },
      { to: '/faturas', label: 'Faturas', icon: FileText },
      { to: '/inteligencia', label: 'Inteligência', icon: BarChart3 },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { to: '/integracoes/goodwe', label: 'Integração GoodWe', icon: PlugZap },
      { to: '/minha-conta', label: 'Minha conta', icon: UserCircle },
    ],
  },
];
const titles: Record<string, string> = {
  dashboard: 'Visão geral',
  carregadores: 'Carregadores',
  sessoes: 'Sessões de recarga',
  unidades: 'Unidades',
  usuarios: 'Usuários',
  veiculos: 'Veículos',
  rfids: 'Cartões RFID',
  tarifas: 'Tarifas',
  faturas: 'Faturas',
  inteligencia: 'Inteligência operacional',
  integracoes: 'Integrações',
  'minha-conta': 'Minha conta',
};

export function AppShell() {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const key = location.pathname.split('/')[1] || 'dashboard';
  const initials = session?.user.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const role =
    session?.user.role === 'USER'
      ? 'Morador'
      : session?.user.role === 'MANAGER'
        ? 'Gestor'
        : 'Administrador';
  return (
    <div className="portal-shell">
      <aside className={`portal-sidebar ${open ? 'open' : ''}`}>
        <div className="portal-brand">
          <span>
            <Zap fill="currentColor" />
          </span>
          <b>
            EV Charge<i>Ops</i>
          </b>
          <button onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X />
          </button>
        </div>
        <div className="community-card">
          <span>
            <Building2 />
          </span>
          <div>
            <small>AMBIENTE ATUAL</small>
            <b>Residencial Horizonte</b>
            <em>4 carregadores · 28 unidades</em>
          </div>
        </div>
        <nav>
          {sections.map((section) => (
            <div className="nav-section" key={section.label}>
              <p>{section.label}</p>
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}>
                  <item.icon />
                  <span>{item.label}</span>
                  {item.to === '/sessoes' && <em>2</em>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="profile-block">
          <span>{initials}</span>
          <div>
            <b>{session?.user.name}</b>
            <small>{role}</small>
          </div>
          <button onClick={logout} title="Sair">
            <LogOut />
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="portal-overlay"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <main className="portal-main">
        <header className="portal-topbar">
          <button className="mobile-menu" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div>
            <small>EV CHARGEOPS / {titles[key]?.toUpperCase()}</small>
            <h1>{titles[key]}</h1>
          </div>
          <div className="live-pill">
            <i />
            {session?.accessToken === 'demo'
              ? 'DEMO · dados MOCK identificados'
              : 'Operação monitorada'}
          </div>
          <span className="top-initials">{initials}</span>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <span>{description}</span>
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="section-header">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
