import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BatteryCharging,
  CircleDollarSign,
  Clock3,
  Gauge,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { PageHeader, SectionHeader } from '../components/app-shell';
import { DataTable, EnergyChart, InsightCard, StatCard, StatusBadge } from '../components/ui';
import { api } from '../lib/api';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function DashboardPage() {
  const { session } = useAuth();
  const month = new Date().toISOString().slice(0, 7);
  const dashboard = useQuery({
    queryKey: ['dashboard', month],
    queryFn: () => api.dashboard(session!.accessToken, month),
  });
  const intelligence = useQuery({
    queryKey: ['intelligence', 90],
    queryFn: () => api.intelligence(session!.accessToken),
    enabled: session?.user.role !== 'USER',
  });
  const summary = dashboard.data;

  if (session?.user.role === 'USER') {
    return (
      <UserDashboard
        name={session.user.name.split(' ')[0] ?? session.user.name}
        summary={summary}
        loading={dashboard.isLoading}
      />
    );
  }

  const useByCharger =
    summary?.chargerUtilization.map((item) => ({
      name: item.chargerName,
      uso: item.utilizationPercent,
      ociosidade: item.idlePercent,
    })) ?? [];
  const peak = intelligence.data?.peakHours[0];
  const mostIdle = [...(intelligence.data?.chargerUtilization ?? [])].sort(
    (a, b) => a.utilizationPercent - b.utilizationPercent,
  )[0];
  const anomaly = intelligence.data?.anomalies[0];

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="OPERAÇÃO COMPARTILHADA"
        title="Energia em movimento"
        description="Consumo, infraestrutura, pendências e rateio com origem rastreável."
        action={
          <label className="date-control">
            <Clock3 /> {month}
          </label>
        }
      />
      {dashboard.isError && (
        <div className="inline-alert">
          A API não respondeu. Nenhuma métrica substituta foi apresentada.
        </div>
      )}
      <section className="stats-grid six">
        <StatCard
          label="Energia total"
          value={summary ? `${number.format(summary.energyKwh)} kWh` : '—'}
          helper="energia válida no período"
          icon={<Zap />}
          origin="CALCULATED"
        />
        <StatCard
          label="Sessões"
          value={summary ? String(summary.sessions) : '—'}
          helper="no período"
          icon={<Activity />}
          origin="CALCULATED"
        />
        <StatCard
          label="Disponíveis"
          value={summary ? String(summary.availableChargers) : '—'}
          helper="carregadores"
          icon={<BatteryCharging />}
          origin="CALCULATED"
        />
        <StatCard
          label="Carregando"
          value={summary ? String(summary.chargingChargers) : '—'}
          helper="estado persistido"
          icon={<Gauge />}
          origin="CALCULATED"
        />
        <StatCard
          label="Falhas / offline"
          value={summary ? String(summary.offlineOrFaultChargers) : '—'}
          helper="requer atenção"
          icon={<TriangleAlert />}
          origin="CALCULATED"
        />
        <StatCard
          label="Valor rateado"
          value={summary ? currency.format(summary.totalAmount) : '—'}
          helper="itens já faturados"
          icon={<CircleDollarSign />}
          origin="CALCULATED"
        />
        <StatCard
          label="Sessões pendentes"
          value={summary ? String(summary.pendingSessions) : '—'}
          helper="aguardando revisão"
          icon={<TriangleAlert />}
          origin="CALCULATED"
        />
      </section>

      <div className="two-col wide-left">
        <section className="surface">
          <SectionHeader title="Consumo diário" description="Energia validada por dia · kWh" />
          <EnergyChart
            data={
              summary?.dailyEnergy.map((item) => ({
                label: item.day.slice(-2),
                value: item.energyKwh,
              })) ?? []
            }
          />
        </section>
        <section className="surface">
          <SectionHeader title="Uso por horário" description="Início das sessões no período" />
          <EnergyChart
            data={
              summary?.peakHours.map((item) => ({ label: item.hour, value: item.sessions })) ?? []
            }
            color="#c2cf45"
          />
        </section>
      </div>

      <div className="two-col">
        <section className="surface">
          <SectionHeader
            title="Utilização vs. ociosidade"
            description="Percentual da janela selecionada"
          />
          <div className="stack-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={useByCharger} margin={{ left: 8, right: 10 }}>
                <CartesianGrid stroke="#e8ece5" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  width={90}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Bar dataKey="uso" name="Em uso" stackId="a" fill="#213c31" />
                <Bar dataKey="ociosidade" name="Ocioso" stackId="a" fill="#dce8a1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="surface">
          <SectionHeader
            title="Consumo por unidade"
            description="Energia válida no período selecionado"
          />
          <div className="rank-list">
            {(summary?.energyByUnit ?? []).map((item, index) => (
              <div key={item.unitCode}>
                <b>{index + 1}</b>
                <span>{item.unitCode}</span>
                <strong>{number.format(item.energyKwh)} kWh</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="surface">
        <SectionHeader
          title="Pendências e sessões recentes"
          description="Dados que afetam identificação e rateio"
          action={<Link to="/sessoes">Ver todas →</Link>}
        />
        <DataTable
          rows={summary?.recentSessions ?? []}
          columns={[
            {
              key: 'id',
              label: 'Sessão',
              render: (row) => (
                <Link className="table-link" to={`/sessoes/${row.id}`}>
                  {row.id.slice(0, 8)}
                </Link>
              ),
            },
            {
              key: 'unit',
              label: 'Unidade / usuário',
              render: (row) => (
                <>
                  <b>{row.unitCode}</b>
                  <small>{row.userName}</small>
                </>
              ),
            },
            { key: 'charger', label: 'Carregador', render: (row) => row.chargerName },
            {
              key: 'energy',
              label: 'Energia',
              render: (row) => `${number.format(row.energyKwh)} kWh`,
            },
            {
              key: 'amount',
              label: 'Rateio',
              render: (row) => (row.amount == null ? 'Não faturada' : currency.format(row.amount)),
            },
            {
              key: 'origin',
              label: 'Origem',
              render: (row) => <StatusBadge status={row.origin} />,
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <StatusBadge status={row.status} />,
            },
          ]}
        />
      </section>

      <section>
        <SectionHeader
          title="Insights explicáveis"
          description="Sinais calculados somente a partir dos dados autorizados"
        />
        <div className="insight-grid">
          <InsightCard
            title="PICO DE DEMANDA"
            meta={`historical_frequency · n=${intelligence.data?.sampleSize ?? 0}`}
          >
            {peak?.humanReadableExplanation ?? 'Dados insuficientes para identificar um pico.'}
          </InsightCard>
          <InsightCard
            title="OCIOSIDADE"
            meta={`janela de 90 dias · ${mostIdle?.sessionCount ?? 0} sessões`}
          >
            {mostIdle
              ? `${mostIdle.chargerName} apresentou ${number.format(100 - mostIdle.utilizationPercent)}% de ociosidade.`
              : 'Dados insuficientes para comparar carregadores.'}
          </InsightCard>
          <InsightCard type="warning" title="ANOMALIAS" meta="IQR · dados válidos">
            {anomaly?.message ?? 'Nenhuma anomalia estatística identificada na amostra disponível.'}
          </InsightCard>
        </div>
      </section>
    </div>
  );
}

function UserDashboard({
  name,
  summary,
  loading,
}: {
  name: string;
  summary?: Awaited<ReturnType<typeof api.dashboard>>;
  loading: boolean;
}) {
  const empty = loading ? '…' : '—';
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="MINHA RECARGA"
        title={`Olá, ${name}`}
        description="Consumo, veículos, sessões e valores restritos ao seu usuário."
      />
      <section className="stats-grid four">
        <StatCard
          label="Energia consumida"
          value={summary ? `${number.format(summary.energyKwh)} kWh` : empty}
          helper="energia válida no mês"
          icon={<Zap />}
          origin="CALCULATED"
        />
        <StatCard
          label="Valor estimado"
          value={summary ? currency.format(summary.totalAmount) : empty}
          helper="itens faturados"
          icon={<CircleDollarSign />}
          origin="CALCULATED"
        />
        <StatCard
          label="Minhas sessões"
          value={summary ? String(summary.sessions) : empty}
          helper="no mês"
          icon={<Activity />}
          origin="CALCULATED"
        />
        <StatCard
          label="Meus veículos"
          value={summary ? String(summary.activeVehicles) : empty}
          helper="ativos"
          icon={<BatteryCharging />}
          origin="CALCULATED"
        />
      </section>
      <div className="two-col wide-left">
        <section className="surface">
          <SectionHeader title="Evolução mensal" description="Consumo próprio validado · kWh" />
          <EnergyChart
            data={
              summary?.monthlyEnergy.map((item) => ({
                label: item.month,
                value: item.energyKwh,
              })) ?? []
            }
          />
        </section>
        <section className="surface user-bill">
          <SectionHeader title="Valor do período" description={summary?.period ?? 'Sem período'} />
          <strong>{summary ? currency.format(summary.totalAmount) : empty}</strong>
          <span>
            {summary
              ? `${number.format(summary.energyKwh)} kWh em ${summary.sessions} sessões`
              : 'Dados indisponíveis'}
          </span>
          <Link className="primary-link" to="/faturas">
            Ver minhas faturas
          </Link>
        </section>
      </div>
      <section className="surface">
        <SectionHeader title="Minhas sessões recentes" />
        <DataTable
          rows={summary?.recentSessions ?? []}
          columns={[
            { key: 'id', label: 'Sessão', render: (row) => row.id.slice(0, 8) },
            { key: 'charger', label: 'Carregador', render: (row) => row.chargerName },
            {
              key: 'started',
              label: 'Início',
              render: (row) => new Date(row.startedAt).toLocaleString('pt-BR'),
            },
            {
              key: 'energy',
              label: 'Energia',
              render: (row) => `${number.format(row.energyKwh)} kWh`,
            },
            {
              key: 'amount',
              label: 'Valor',
              render: (row) => (row.amount == null ? 'Não faturada' : currency.format(row.amount)),
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
