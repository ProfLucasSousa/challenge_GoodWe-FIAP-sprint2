import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Activity,
  ArrowLeft,
  BatteryCharging,
  Bot,
  Cable,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  Gauge,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  Zap,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { PageHeader, SectionHeader } from '../components/app-shell';
import {
  DataTable,
  EnergyChart,
  InsightCard,
  ProviderStatusCard,
  StatCard,
  StatusBadge,
} from '../components/ui';
import {
  chargers,
  dailyEnergy,
  invoices,
  rfids,
  sessions,
  units,
  users,
  vehicles,
} from '../lib/portal-data';
import { api, type AssistantResponse } from '../lib/api';

function Toolbar({
  placeholder = 'Buscar por nome, unidade ou identificador',
}: {
  placeholder?: string;
}) {
  return (
    <div className="list-toolbar">
      <label>
        <Search />
        <input placeholder={placeholder} />
      </label>
      <button className="filter-button">Todos os status</button>
      <button className="primary-action">
        <Plus />
        Novo registro
      </button>
    </div>
  );
}
function Missing({ label }: { label: string }) {
  return (
    <div className="missing-state">
      <BatteryCharging />
      <h3>{label} não encontrado</h3>
      <p>O registro solicitado não está disponível no escopo autorizado.</p>
      <Link to="/dashboard">Voltar ao painel</Link>
    </div>
  );
}

export function ChargersPage() {
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="INFRAESTRUTURA"
        title="Carregadores compartilhados"
        description="Disponibilidade, potência e ocupação da infraestrutura de recarga."
        action={
          <button className="secondary-action">
            <RefreshCw />
            Atualizar status
          </button>
        }
      />
      <section className="stats-grid four">
        <StatCard
          label="Total instalado"
          value="4"
          helper="51 kW nominais"
          icon={<BatteryCharging />}
        />
        <StatCard label="Disponíveis" value="1" helper="pronto para uso" icon={<Check />} />
        <StatCard label="Carregando" value="1" helper="10,8 kW agora" icon={<Zap />} />
        <StatCard label="Indisponíveis" value="2" helper="1 falha · 1 offline" icon={<Gauge />} />
      </section>
      <Toolbar placeholder="Buscar carregador ou localização" />
      <div className="charger-catalog">
        {chargers.map((charger) => (
          <Link to={`/carregadores/${charger.id}`} className="charger-tile" key={charger.id}>
            <header>
              <span>
                <BatteryCharging />
              </span>
              <StatusBadge status={charger.status} />
            </header>
            <h3>{charger.name}</h3>
            <p>{charger.location}</p>
            <dl>
              <div>
                <dt>Modelo</dt>
                <dd>{charger.model}</dd>
              </div>
              <div>
                <dt>Potência</dt>
                <dd>{charger.power}</dd>
              </div>
              <div>
                <dt>Último sinal</dt>
                <dd>{charger.lastSeen}</dd>
              </div>
              <div>
                <dt>Utilização</dt>
                <dd>{charger.utilization}%</dd>
              </div>
            </dl>
            <div className="util-bar">
              <i style={{ width: `${charger.utilization}%` }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ChargerDetailPage() {
  const { id } = useParams();
  const item = chargers.find((charger) => charger.id === id);
  if (!item) return <Missing label="Carregador" />;
  return (
    <div className="page-content">
      <Link className="back-link" to="/carregadores">
        <ArrowLeft />
        Carregadores
      </Link>
      <PageHeader
        eyebrow={item.model}
        title={item.name}
        description={`${item.location} · ${item.power}`}
        action={<StatusBadge status={item.status} />}
      />
      <div className="detail-grid">
        <section className="surface detail-hero">
          <span className="large-device">
            <BatteryCharging />
          </span>
          <div>
            <small>POTÊNCIA ATUAL</small>
            <strong>{item.status === 'CHARGING' ? '10,8 kW' : '0,0 kW'}</strong>
            <p>Último sinal {item.lastSeen}</p>
          </div>
          <dl>
            <div>
              <dt>Energia hoje</dt>
              <dd>42,6 kWh</dd>
            </div>
            <div>
              <dt>Sessões no mês</dt>
              <dd>16</dd>
            </div>
            <div>
              <dt>Utilização</dt>
              <dd>{item.utilization}%</dd>
            </div>
          </dl>
        </section>
        <section className="surface">
          <SectionHeader title="Energia entregue" description="Últimos 12 dias · kWh" />
          <EnergyChart
            data={dailyEnergy.map((point) => ({
              ...point,
              value: Math.round((point.value * item.utilization) / 100),
            }))}
          />
        </section>
      </div>
      <section className="surface">
        <SectionHeader title="Sessões deste carregador" />
        <DataTable
          rows={sessions.filter((session) => session.charger === item.name)}
          columns={[
            {
              key: 'id',
              label: 'Sessão',
              render: (row) => (
                <Link className="table-link" to={`/sessoes/${row.id}`}>
                  {row.id}
                </Link>
              ),
            },
            { key: 'unit', label: 'Unidade', render: (row) => row.unit },
            { key: 'start', label: 'Início', render: (row) => row.startedAt },
            { key: 'energy', label: 'Energia', render: (row) => row.energy },
            {
              key: 'quality',
              label: 'Qualidade',
              render: (row) => <StatusBadge status={row.quality} />,
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <StatusBadge status={row.status} />,
            },
          ]}
        />
      </section>
    </div>
  );
}

export function SessionsPage() {
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="ENERGIA VALIDADA"
        title="Sessões de recarga"
        description="Acompanhe cada ciclo, sua qualidade e o vínculo usado no rateio."
      />
      <section className="stats-grid four">
        <StatCard
          label="Neste mês"
          value="38"
          trend="+8,6%"
          helper="vs. setembro"
          icon={<Activity />}
        />
        <StatCard label="Energia validada" value="842,6 kWh" helper="36 sessões" icon={<Zap />} />
        <StatCard label="Em andamento" value="1" helper="monitorada agora" icon={<Clock3 />} />
        <StatCard
          label="Revisão pendente"
          value="2"
          helper="não faturadas"
          icon={<ShieldCheck />}
        />
      </section>
      <Toolbar placeholder="Buscar sessão, usuário ou carregador" />
      <section className="surface">
        <DataTable
          rows={sessions}
          columns={[
            {
              key: 'id',
              label: 'Sessão',
              render: (row) => (
                <Link className="table-link" to={`/sessoes/${row.id}`}>
                  {row.id}
                </Link>
              ),
            },
            {
              key: 'identity',
              label: 'Unidade / usuário',
              render: (row) => (
                <>
                  <b>{row.unit}</b>
                  <small>{row.user}</small>
                </>
              ),
            },
            { key: 'charger', label: 'Carregador', render: (row) => row.charger },
            {
              key: 'start',
              label: 'Início / duração',
              render: (row) => (
                <>
                  {row.startedAt}
                  <small>{row.duration}</small>
                </>
              ),
            },
            { key: 'energy', label: 'Energia', render: (row) => row.energy },
            {
              key: 'quality',
              label: 'Qualidade',
              render: (row) => <StatusBadge status={row.quality} />,
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <StatusBadge status={row.status} />,
            },
          ]}
        />
      </section>
    </div>
  );
}

export function SessionDetailPage() {
  const { id } = useParams();
  const item = sessions.find((session) => session.id === id);
  if (!item) return <Missing label="Sessão" />;
  return (
    <div className="page-content">
      <Link className="back-link" to="/sessoes">
        <ArrowLeft />
        Sessões
      </Link>
      <PageHeader
        eyebrow="SESSÃO DE RECARGA"
        title={item.id}
        description={`${item.startedAt} · ${item.charger}`}
        action={<StatusBadge status={item.status} />}
      />
      <div className="detail-grid narrow-right">
        <section className="surface session-timeline">
          <SectionHeader title="Ciclo de energia" description="Dado observado preservado" />
          <div className="energy-orbit">
            <span>
              <Zap />
            </span>
            <strong>{item.energy}</strong>
            <small>energia validada</small>
          </div>
          <div className="timeline">
            <div className="done">
              <i />
              <span>
                <b>Início</b>
                {item.startedAt}
              </span>
            </div>
            <div className="done">
              <i />
              <span>
                <b>Leitura validada</b>Fonte externa · qualidade {item.quality}
              </span>
            </div>
            <div>
              <i />
              <span>
                <b>Encerramento</b>
                {item.duration} após o início
              </span>
            </div>
          </div>
        </section>
        <aside className="surface facts">
          <SectionHeader title="Identificação e rateio" />
          <dl>
            <div>
              <dt>Usuário</dt>
              <dd>{item.user}</dd>
            </div>
            <div>
              <dt>Unidade</dt>
              <dd>{item.unit}</dd>
            </div>
            <div>
              <dt>Carregador</dt>
              <dd>{item.charger}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{item.amount}</dd>
            </div>
            <div>
              <dt>Qualidade</dt>
              <dd>
                <StatusBadge status={item.quality} />
              </dd>
            </div>
          </dl>
          {item.status === 'PENDING_REVIEW' && (
            <button className="primary-action">Resolver identificação</button>
          )}
        </aside>
      </div>
    </div>
  );
}

export function UnitsPage() {
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="GESTÃO COMPARTILHADA"
        title="Unidades e participação"
        description="Consumo consolidado por unidade, sem expor telemetria individual indevida."
      />
      <Toolbar placeholder="Buscar bloco, unidade ou responsável" />
      <section className="surface">
        <DataTable
          rows={units}
          columns={[
            {
              key: 'unit',
              label: 'Unidade',
              render: (row) => (
                <Link className="table-link" to={`/unidades/${row.id}`}>
                  {row.code}
                </Link>
              ),
            },
            { key: 'responsible', label: 'Responsável', render: (row) => row.responsible },
            { key: 'people', label: 'Usuários', render: (row) => String(row.users) },
            { key: 'vehicles', label: 'Veículos', render: (row) => String(row.vehicles) },
            { key: 'energy', label: 'Consumo no mês', render: (row) => <b>{row.energy}</b> },
            { key: 'trend', label: 'Variação', render: (row) => row.trend },
            {
              key: 'amount',
              label: 'Rateio',
              align: 'right',
              render: (row) => <b>{row.amount}</b>,
            },
          ]}
        />
      </section>
    </div>
  );
}

export function UnitDetailPage() {
  const { id } = useParams();
  const item = units.find((unit) => unit.id === id);
  if (!item) return <Missing label="Unidade" />;
  return (
    <div className="page-content">
      <Link className="back-link" to="/unidades">
        <ArrowLeft />
        Unidades
      </Link>
      <PageHeader
        eyebrow="UNIDADE RESIDENCIAL"
        title={item.code}
        description={`Responsável: ${item.responsible}`}
      />
      <section className="stats-grid four">
        <StatCard
          label="Energia no mês"
          value={item.energy}
          trend={item.trend}
          helper="vs. mês anterior"
          icon={<Zap />}
        />
        <StatCard
          label="Rateio estimado"
          value={item.amount}
          helper="antes do fechamento"
          icon={<CircleDollarSign />}
        />
        <StatCard
          label="Usuários"
          value={String(item.users)}
          helper="vinculados"
          icon={<Users />}
        />
        <StatCard label="Veículos" value={String(item.vehicles)} helper="ativos" icon={<Cable />} />
      </section>
      <div className="two-col wide-left">
        <section className="surface">
          <SectionHeader title="Evolução do consumo" description="Últimos seis meses" />
          <EnergyChart
            data={[
              { label: 'Mai', value: 72 },
              { label: 'Jun', value: 89 },
              { label: 'Jul', value: 81 },
              { label: 'Ago', value: 104 },
              { label: 'Set', value: 118 },
              { label: 'Out', value: 127 },
            ]}
          />
        </section>
        <section className="surface facts">
          <SectionHeader title="Resumo cadastral" />
          <dl>
            <div>
              <dt>Bloco</dt>
              <dd>{item.code.split(' · ')[0]}</dd>
            </div>
            <div>
              <dt>Unidade</dt>
              <dd>{item.code.split(' · ')[1]}</dd>
            </div>
            <div>
              <dt>Responsável</dt>
              <dd>{item.responsible}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                <StatusBadge status="ACTIVE" />
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

export function UsersPage() {
  return (
    <SimpleResourcePage
      eyebrow="ACESSO E RESPONSABILIDADE"
      title="Usuários"
      description="Perfis autorizados e seus vínculos com unidades."
      icon={<Users />}
      rows={users}
      columns={[
        {
          key: 'name',
          label: 'Usuário',
          render: (row) => (
            <>
              <b>{row.name}</b>
              <small>{row.email}</small>
            </>
          ),
        },
        { key: 'unit', label: 'Unidade', render: (row) => row.unit },
        { key: 'role', label: 'Perfil', render: (row) => row.role },
        { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      ]}
    />
  );
}
export function VehiclesPage() {
  return (
    <SimpleResourcePage
      eyebrow="MOBILIDADE"
      title="Veículos"
      description="Veículos elétricos associados aos moradores."
      icon={<Cable />}
      rows={vehicles}
      columns={[
        { key: 'name', label: 'Veículo', render: (row) => <b>{row.name}</b> },
        { key: 'owner', label: 'Responsável', render: (row) => row.owner },
        { key: 'plate', label: 'Placa', render: (row) => <code>{row.plate}</code> },
        { key: 'type', label: 'Tipo', render: (row) => row.type },
        { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      ]}
    />
  );
}
export function RfidsPage() {
  return (
    <SimpleResourcePage
      eyebrow="IDENTIFICAÇÃO SEGURA"
      title="Cartões RFID"
      description="Credenciais mascaradas usadas para associar sessões com segurança."
      icon={<CreditCard />}
      rows={rfids}
      columns={[
        { key: 'uid', label: 'Identificador', render: (row) => <code>{row.uid}</code> },
        { key: 'owner', label: 'Usuário', render: (row) => row.owner },
        { key: 'unit', label: 'Unidade', render: (row) => row.unit },
        { key: 'last', label: 'Último uso', render: (row) => row.lastUse },
        { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
      ]}
    />
  );
}

function SimpleResourcePage<T extends { id: string }>({
  eyebrow,
  title,
  description,
  icon,
  rows,
  columns,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  rows: T[];
  columns: Parameters<typeof DataTable<T>>[0]['columns'];
}) {
  return (
    <div className="page-content">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={<span className="page-icon">{icon}</span>}
      />
      <Toolbar />
      <section className="surface">
        <DataTable rows={rows} columns={columns} />
      </section>
    </div>
  );
}

export function TariffsPage() {
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="REGRAS DE RATEIO"
        title="Tarifas"
        description="Preço de energia e taxa operacional aplicados como snapshot às sessões elegíveis."
        action={
          <button className="primary-action">
            <Plus />
            Nova tarifa
          </button>
        }
      />
      <div className="tariff-grid">
        <article className="tariff-card active">
          <span>ATIVA</span>
          <Tag />
          <h3>Tarifa residencial 2026</h3>
          <strong>
            R$ 1,08<small>/ kWh</small>
          </strong>
          <dl>
            <div>
              <dt>Taxa operacional</dt>
              <dd>R$ 1,50 / sessão</dd>
            </div>
            <div>
              <dt>Vigência</dt>
              <dd>01/01/2026 — atual</dd>
            </div>
          </dl>
          <button>Editar vigência</button>
        </article>
        <article className="tariff-card">
          <span>HISTÓRICO</span>
          <Tag />
          <h3>Tarifa residencial 2025</h3>
          <strong>
            R$ 0,94<small>/ kWh</small>
          </strong>
          <dl>
            <div>
              <dt>Taxa operacional</dt>
              <dd>R$ 1,50 / sessão</dd>
            </div>
            <div>
              <dt>Vigência</dt>
              <dd>01/01 — 31/12/2025</dd>
            </div>
          </dl>
          <button>Ver detalhes</button>
        </article>
      </div>
      <div className="formula-card">
        <div>
          <Sparkles />
        </div>
        <span>
          <small>FÓRMULA TRANSPARENTE</small>
          <b>Energia validada × preço por kWh + taxa operacional</b>
          <p>
            Sessões pendentes, ativas, com erro ou qualidade inválida não entram no rateio
            automático.
          </p>
        </span>
      </div>
    </div>
  );
}

export function InvoicesPage() {
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="RATEIO POR CONSUMO"
        title="Faturas"
        description="Cobranças consolidadas por unidade com rastreabilidade até cada sessão."
        action={
          <button className="primary-action">
            <CalendarDays />
            Gerar outubro
          </button>
        }
      />
      <section className="stats-grid four">
        <StatCard
          label="Total do período"
          value="R$ 911,28"
          helper="842,6 kWh"
          icon={<CircleDollarSign />}
        />
        <StatCard label="Faturas abertas" value="12" helper="R$ 486,20" icon={<Clock3 />} />
        <StatCard label="Fechadas" value="9" helper="aguardando pagamento" icon={<ShieldCheck />} />
        <StatCard label="Pagas" value="7" helper="no período" icon={<Check />} />
      </section>
      <Toolbar placeholder="Buscar fatura ou unidade" />
      <section className="surface">
        <DataTable
          rows={invoices}
          columns={[
            {
              key: 'id',
              label: 'Fatura',
              render: (row) => (
                <Link className="table-link" to={`/faturas/${row.id}`}>
                  {row.id}
                </Link>
              ),
            },
            { key: 'unit', label: 'Unidade', render: (row) => <b>{row.unit}</b> },
            { key: 'reference', label: 'Referência', render: (row) => row.reference },
            { key: 'energy', label: 'Energia', render: (row) => row.energy },
            { key: 'total', label: 'Total', render: (row) => <b>{row.total}</b> },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <StatusBadge status={row.status} />,
            },
          ]}
        />
      </section>
    </div>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams();
  const item = invoices.find((invoice) => invoice.id === id);
  if (!item) return <Missing label="Fatura" />;
  return (
    <div className="page-content">
      <Link className="back-link" to="/faturas">
        <ArrowLeft />
        Faturas
      </Link>
      <PageHeader
        eyebrow={item.reference.toUpperCase()}
        title={item.id}
        description={`Rateio consolidado da unidade ${item.unit}`}
        action={
          <>
            <button className="secondary-action">
              <Download />
              Exportar
            </button>{' '}
            <StatusBadge status={item.status} />
          </>
        }
      />
      <div className="invoice-summary">
        <div>
          <small>ENERGIA VALIDADA</small>
          <strong>{item.energy}</strong>
        </div>
        <span>×</span>
        <div>
          <small>TARIFA SNAPSHOT</small>
          <strong>R$ 1,08/kWh</strong>
        </div>
        <span>+</span>
        <div>
          <small>TAXAS</small>
          <strong>{item.fees}</strong>
        </div>
        <span>=</span>
        <div className="total">
          <small>TOTAL</small>
          <strong>{item.total}</strong>
        </div>
      </div>
      <section className="surface">
        <SectionHeader title="Sessões incluídas" description="Cada sessão aparece uma única vez" />
        <DataTable
          rows={sessions.filter((session) => session.status !== 'PENDING_REVIEW').slice(0, 3)}
          columns={[
            {
              key: 'id',
              label: 'Sessão',
              render: (row) => (
                <Link className="table-link" to={`/sessoes/${row.id}`}>
                  {row.id}
                </Link>
              ),
            },
            { key: 'charger', label: 'Carregador', render: (row) => row.charger },
            { key: 'start', label: 'Data', render: (row) => row.startedAt },
            { key: 'energy', label: 'Energia', render: (row) => row.energy },
            {
              key: 'quality',
              label: 'Qualidade',
              render: (row) => <StatusBadge status={row.quality} />,
            },
            { key: 'amount', label: 'Valor', align: 'right', render: (row) => <b>{row.amount}</b> },
          ]}
        />
      </section>
    </div>
  );
}

const questionSchema = z.object({ question: z.string().min(3).max(500) });
export function IntelligencePage() {
  const { session } = useAuth();
  const analysis = useQuery({
    queryKey: ['intelligence', 90],
    queryFn: () => api.intelligence(session!.accessToken),
    enabled: session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER',
  });
  const insight = analysis.data;
  const peak = insight?.peakHours[0];
  const forecast = insight?.demandForecast.predictions[0];
  const [messages, setMessages] = useState<
    Array<{ question: string; response: AssistantResponse }>
  >([]);
  const [assistantError, setAssistantError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<z.infer<typeof questionSchema>>({ resolver: zodResolver(questionSchema) });
  const ask = async ({ question }: z.infer<typeof questionSchema>) => {
    setAssistantError('');
    try {
      const response = await api.assistant(session!.accessToken, question);
      setMessages((current) => [...current, { question, response }]);
      reset();
    } catch (error) {
      setAssistantError(
        error instanceof Error ? error.message : 'O Síndico Virtual está indisponível.',
      );
    }
  };
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="INTELIGÊNCIA EXPLICÁVEL"
        title="Decisões apoiadas por dados"
        description="Padrões, anomalias e previsão sem caixas-pretas ou métricas inventadas."
      />
      <div className="intelligence-layout">
        <div>
          <section className="stats-grid three">
            <StatCard
              label="Pico de uso"
              value={peak?.hour ?? 'Não identificado'}
              helper={peak ? `${peak.percentage}% das sessões` : 'dados insuficientes'}
              icon={<Gauge />}
              origin="CALCULATED"
            />
            <StatCard
              label="Sessão média"
              value={
                insight?.averageSessionEnergy == null
                  ? 'Não disponível'
                  : `${insight.averageSessionEnergy.toLocaleString('pt-BR')} kWh`
              }
              helper={
                insight?.averageSessionDuration == null
                  ? 'dados insuficientes'
                  : `${Math.round(insight.averageSessionDuration)} min`
              }
              icon={<Zap />}
              origin="CALCULATED"
            />
            <StatCard
              label="Previsão semanal"
              value={
                forecast
                  ? `${forecast.predictedEnergyKwh.toLocaleString('pt-BR')} kWh`
                  : 'Indisponível'
              }
              helper={`qualidade ${insight?.demandForecast.quality.toLowerCase() ?? 'insuficiente'}`}
              icon={<Sparkles />}
              origin="CALCULATED"
            />
          </section>
          <section className="surface">
            <SectionHeader
              title="Demanda por horário"
              description="Frequência histórica das sessões válidas"
            />
            <EnergyChart
              data={(insight?.peakHours ?? []).map((item) => ({
                label: item.hour,
                value: item.sessions,
              }))}
            />
          </section>
          <div className="insight-grid two">
            <InsightCard
              title="PADRÃO DE USO"
              meta={`historical_frequency · n=${insight?.sampleSize ?? 0}`}
            >
              {peak?.humanReadableExplanation ?? 'Dados insuficientes para descrever o padrão.'}
            </InsightCard>
            <InsightCard
              type="warning"
              title="ANOMALIA IQR"
              meta={`IQR · n=${insight?.sampleSize ?? 0}`}
            >
              {insight?.anomalies[0]?.message ??
                'Nenhuma anomalia identificada, ou amostra insuficiente.'}
            </InsightCard>
          </div>
        </div>
        <aside className="assistant-panel">
          <header>
            <span>
              <Bot />
            </span>
            <div>
              <b>Síndico Virtual</b>
              <small>Respostas com fontes agregadas</small>
            </div>
            <i>ONLINE</i>
          </header>
          <div className="assistant-body">
            <div className="bot-message">
              Olá! Posso explicar consumo, demanda, anomalias e ociosidade usando apenas métricas
              autorizadas.
            </div>
            {messages.map((message, index) => (
              <div key={index} className="conversation">
                <div className="user-message">{message.question}</div>
                <div className="bot-message">
                  {message.response.answer}
                  <small>
                    Fontes:{' '}
                    {message.response.sources
                      .map((source) => `${source.metric}: ${source.value}`)
                      .join(' · ')}
                  </small>
                </div>
              </div>
            ))}
          </div>
          <div className="quick-questions">
            <button onClick={() => void ask({ question: 'Qual horário tem maior demanda?' })}>
              Maior demanda?
            </button>
            <button onClick={() => void ask({ question: 'Qual carregador fica mais ocioso?' })}>
              Mais ocioso?
            </button>
          </div>
          {assistantError && <div className="assistant-error">{assistantError}</div>}
          <form onSubmit={handleSubmit(ask)}>
            <input {...register('question')} placeholder="Pergunte sobre a operação..." />
            <button disabled={isSubmitting}>
              <Send />
            </button>
          </form>
          <footer>
            <ShieldCheck />
            Não acessa dados individuais sem permissão
          </footer>
        </aside>
      </div>
    </div>
  );
}

export function GoodWePage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['provider-status'],
    queryFn: () => api.providerStatus(session!.accessToken),
  });
  const chargerQuery = useQuery({
    queryKey: ['chargers', 'integration'],
    queryFn: () => api.chargers(session!.accessToken),
  });
  const sync = useMutation({
    mutationFn: () => api.syncChargers(session!.accessToken),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['provider-status'] }),
        queryClient.invalidateQueries({ queryKey: ['chargers'] }),
      ]);
    },
  });
  const provider = status.data;
  const capabilities = provider
    ? Object.entries(provider.capabilities)
        .filter(([, enabled]) => enabled)
        .map(([name]) => `${name}${provider.provider === 'demo' ? ' (MOCK/DEMO)' : ''}`)
    : [];
  const canSync = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';
  const lastSync = provider?.lastSync
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(
        new Date(provider.lastSync),
      )
    : 'Nenhuma sincronização concluída';
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="INTEGRAÇÃO READ-ONLY"
        title="GoodWe SEMS+"
        description="Visibilidade honesta sobre conectividade, recursos comprovados e sincronização."
        action={
          <button
            className="primary-action"
            disabled={!canSync || sync.isPending}
            onClick={() => sync.mutate()}
          >
            <RefreshCw />
            {sync.isPending ? 'Sincronizando…' : 'Sincronizar dados'}
          </button>
        }
      />
      <div className="provider-layout">
        <ProviderStatusCard
          provider={provider?.provider ?? 'carregando'}
          readOnly={provider?.readOnly ?? true}
          connected={provider?.connected ?? false}
          lastSync={lastSync}
          capabilities={capabilities}
          chargers={provider?.identifiedChargers ?? 0}
          lastError={
            provider?.lastError ??
            (status.isError ? 'Não foi possível consultar o estado da integração.' : null)
          }
        />
        <section className="surface integration-info">
          <SectionHeader
            title="Estado da descoberta"
            description="Somente recursos oficialmente confirmados são habilitados"
          />
          <p>
            A arquitetura de integração GoodWe está implementada, porém a conexão real depende do
            contrato oficial da API e das permissões OpenAPI da conta.
          </p>
          <div className="integration-step done">
            <i>
              <Check />
            </i>
            <span>
              <b>Aplicação preparada</b>
              <small>Provider isolado, timeout, retry transitório e logs sanitizados.</small>
            </span>
          </div>
          <div className="integration-step current">
            <i>2</i>
            <span>
              <b>Aguardando credenciais Open API</b>
              <small>Login SEMS+ Web/App não comprova acesso à API oficial.</small>
            </span>
          </div>
          <div className="integration-step">
            <i>3</i>
            <span>
              <b>Validar capabilities</b>
              <small>
                Carregadores, telemetria, sessões e alarmes só serão exibidos após confirmação.
              </small>
            </span>
          </div>
        </section>
      </div>
      <div className="security-banner">
        <ShieldCheck />
        <span>
          <b>Exposição segura</b>
          <p>
            Esta tela nunca renderiza senha, token, cookie, serial sensível ou identificador
            privado. O erro acima foi sanitizado.
          </p>
        </span>
      </div>
      <section className="surface">
        <SectionHeader
          title="Carregadores identificados"
          description="Dispositivos retornados pela integração autorizada"
        />
        {chargerQuery.data?.length ? (
          <DataTable
            rows={chargerQuery.data}
            columns={[
              { key: 'name', label: 'Carregador', render: (row) => row.name },
              { key: 'model', label: 'Modelo', render: (row) => row.model },
              {
                key: 'origin',
                label: 'Origem',
                render: (row) => (
                  <StatusBadge
                    status={row.origin ?? (row.provider === 'GOODWE' ? 'REAL' : 'MOCK')}
                  />
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge status={row.status} />,
              },
            ]}
          />
        ) : (
          <div className="empty-integration">
            <BatteryCharging />
            <h3>Nenhum carregador identificado</h3>
            <p>
              A integração real ainda não possui capability oficial confirmada para listar
              dispositivos.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function AccountPage() {
  const { session } = useAuth();
  const user = session!.user;
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="PERFIL E SEGURANÇA"
        title="Minha conta"
        description="Informações da sessão e preferências pessoais."
      />
      <div className="account-grid">
        <section className="surface account-card">
          <span className="account-avatar">{initials}</span>
          <h3>{user.name}</h3>
          <p>{user.role}</p>
          <dl>
            <div>
              <dt>E-mail</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Escopo</dt>
              <dd>{user.unitId ? 'Unidade associada' : 'Todas as unidades'}</dd>
            </div>
            <div>
              <dt>Autenticação</dt>
              <dd>
                <StatusBadge status="ACTIVE" />
              </dd>
            </div>
          </dl>
        </section>
        <section className="surface account-settings">
          <SectionHeader title="Preferências" />
          <p>Preferências editáveis e notificações ainda não possuem persistência nesta versão.</p>
        </section>
      </div>
    </div>
  );
}
