import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BatteryCharging, Check, Gauge, RefreshCw, Zap } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { PageHeader, SectionHeader } from '../components/app-shell';
import { StatusBadge, TelemetryChart } from '../components/ui';
import { api, type ChargerView, type OperationalMetric } from '../lib/api';

function sourceName(source: string | null) {
  if (source === 'SEMS') return 'GoodWe / SEMS';
  if (source === 'MOCK') return 'Mock';
  if (source === 'MODBUS') return 'Modbus';
  if (source === 'EV_CHARGEOPS') return 'EV ChargeOps';
  return 'Não disponibilizada';
}

function relativeTime(value: string | null) {
  if (!value) return null;
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function MetricCard({
  label,
  metric,
  unit,
  decimals = 1,
}: {
  label: string;
  metric: OperationalMetric<number | string>;
  unit?: string;
  decimals?: number;
}) {
  const available = metric.classification !== 'UNAVAILABLE' && metric.value != null;
  const numeric =
    typeof metric.value === 'number' ||
    (typeof metric.value === 'string' &&
      metric.value.trim() !== '' &&
      Number.isFinite(Number(metric.value)));
  const formattedValue =
    label === 'Última atualização' && typeof metric.value === 'string'
      ? relativeTime(metric.value)
      : numeric
        ? Number(metric.value).toLocaleString('pt-BR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : metric.value;
  const displayed = available
    ? `${formattedValue}${unit ? ` ${unit}` : ''}`
    : 'Não disponibilizado pela integração atual';
  return (
    <article className={`telemetry-metric ${available ? '' : 'unavailable'}`}>
      <header>
        <span>{label}</span>
        <StatusBadge status={metric.classification} />
      </header>
      <strong>{displayed}</strong>
      <footer>
        <span>Fonte: {sourceName(metric.source)}</span>
        {metric.observedAt && <span>Atualizado {relativeTime(metric.observedAt)}</span>}
      </footer>
    </article>
  );
}

function chargerOrigin(charger: ChargerView) {
  return charger.origin ?? (charger.provider === 'GOODWE' ? 'REAL' : 'MOCK');
}

export function ChargersPage() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['chargers'],
    queryFn: () => api.chargers(session!.accessToken),
  });
  const rows = query.data ?? [];
  const totalPower = rows.reduce((sum, charger) => sum + Number(charger.nominalPowerKw), 0);
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="HCA G2 · VISÃO OPERACIONAL"
        title="Carregadores compartilhados"
        description="Cadastro, estado observado e proveniência explícita de cada dispositivo."
        action={
          <button
            className="secondary-action"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw />
            Atualizar status
          </button>
        }
      />
      <section className="stats-grid four">
        <article className="stat-card">
          <div className="stat-head">
            <span>Total identificado</span>
            <i>
              <BatteryCharging />
            </i>
          </div>
          <strong>{query.isLoading ? '—' : rows.length}</strong>
          <p>
            {rows.length
              ? `${totalPower.toLocaleString('pt-BR')} kW nominais`
              : 'Nenhum dispositivo'}
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-head">
            <span>Disponíveis</span>
            <i>
              <Check />
            </i>
          </div>
          <strong>{rows.filter((item) => item.status === 'AVAILABLE').length}</strong>
          <p>estado observado</p>
        </article>
        <article className="stat-card">
          <div className="stat-head">
            <span>Carregando</span>
            <i>
              <Zap />
            </i>
          </div>
          <strong>{rows.filter((item) => item.status === 'CHARGING').length}</strong>
          <p>estado observado</p>
        </article>
        <article className="stat-card">
          <div className="stat-head">
            <span>Falha / offline</span>
            <i>
              <Gauge />
            </i>
          </div>
          <strong>
            {rows.filter((item) => ['FAULT', 'OFFLINE'].includes(item.status)).length}
          </strong>
          <p>requer atenção</p>
        </article>
      </section>
      <div className="provenance-strip">
        <span>
          <StatusBadge status="REAL" />
          GoodWe ou fonte física
        </span>
        <span>
          <StatusBadge status="MOCK" />
          Ambiente simulado
        </span>
        <span>
          <StatusBadge status="CALCULATED" />
          Derivado pela plataforma
        </span>
        <span>
          <StatusBadge status="UNAVAILABLE" />
          Não fornecido
        </span>
      </div>
      {query.isError && (
        <div className="inline-alert">
          Não foi possível consultar os carregadores. Nenhum valor foi simulado para substituir a
          resposta real.
        </div>
      )}
      <div className="charger-catalog">
        {rows.map((charger) => (
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
                <dt>Potência nominal</dt>
                <dd>{Number(charger.nominalPowerKw).toLocaleString('pt-BR')} kW</dd>
              </div>
              <div>
                <dt>Última atualização</dt>
                <dd>{relativeTime(charger.lastSeenAt) ?? 'Não disponibilizada'}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>
                  <StatusBadge status={chargerOrigin(charger)} />
                </dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
      {!query.isLoading && !query.isError && rows.length === 0 && (
        <div className="empty-integration">
          <BatteryCharging />
          <h3>Nenhum carregador encontrado</h3>
          <p>A API não retornou dispositivos para o escopo atual.</p>
        </div>
      )}
    </div>
  );
}

export function ChargerDetailPage() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['charger-operational', id],
    queryFn: () => api.operationalCharger(session!.accessToken, id),
    enabled: Boolean(id),
    refetchInterval: 30_000,
  });
  const charger = query.data;
  if (query.isLoading) return <div className="route-loading">Carregando dados operacionais…</div>;
  if (!charger)
    return (
      <div className="missing-state">
        <BatteryCharging />
        <h3>Dados operacionais indisponíveis</h3>
        <p>
          {query.isError
            ? 'A API não retornou este carregador. Nenhuma telemetria substituta foi exibida.'
            : 'Carregador não encontrado.'}
        </p>
        <Link to="/carregadores">Voltar aos carregadores</Link>
      </div>
    );
  const metrics = charger.metrics;
  return (
    <div className="page-content">
      <Link className="back-link" to="/carregadores">
        <ArrowLeft />
        Carregadores
      </Link>
      <PageHeader
        eyebrow="HCA G2 · TELEMETRIA READ-ONLY"
        title={charger.name}
        description={charger.location}
        action={
          <>
            <StatusBadge status={metrics.status.classification} />
            <StatusBadge
              status={
                metrics.status.classification === 'UNAVAILABLE'
                  ? 'UNAVAILABLE'
                  : String(metrics.status.value)
              }
            />
          </>
        }
      />
      <div className="provenance-strip">
        <span>
          <StatusBadge status="REAL" />
          Dado GoodWe/físico
        </span>
        <span>
          <StatusBadge status="MOCK" />
          Dado simulado
        </span>
        <span>
          <StatusBadge status="CALCULATED" />
          Cálculo EV ChargeOps
        </span>
        <span>
          <StatusBadge status="UNAVAILABLE" />
          Integração não forneceu
        </span>
      </div>
      <section className="telemetry-grid">
        <MetricCard label="Modelo" metric={metrics.model} decimals={0} />
        <MetricCard label="Potência nominal" metric={metrics.nominalPowerKw} unit="kW" />
        <MetricCard label="Potência atual" metric={metrics.powerKw} unit="kW" />
        <MetricCard label="Energia da sessão" metric={metrics.sessionEnergyKwh} unit="kWh" />
        <MetricCard label="Energia acumulada" metric={metrics.accumulatedEnergyKwh} unit="kWh" />
        <MetricCard label="Corrente" metric={metrics.currentA} unit="A" />
        <MetricCard label="Tensão" metric={metrics.voltageV} unit="V" />
        <MetricCard label="Última atualização" metric={metrics.lastUpdatedAt} decimals={0} />
      </section>
      <section className="surface">
        <SectionHeader
          title="Potência ao longo do tempo"
          description={`${charger.readings.length} leituras disponíveis · valores ausentes não são interpolados`}
        />
        <TelemetryChart data={charger.readings} />
        <div className="chart-provenance">
          <span>Origem das leituras</span>
          {[...new Set(charger.readings.map((reading) => reading.classification))].map(
            (classification) => (
              <StatusBadge key={classification} status={classification} />
            ),
          )}
        </div>
      </section>
      <section className="surface operational-note">
        <ShieldNote />
      </section>
    </div>
  );
}

function ShieldNote() {
  return (
    <div>
      <b>Leitura de proveniência</b>
      <p>
        <strong>REAL</strong> identifica observações GoodWe/SEMS ou outra fonte física;{' '}
        <strong>MOCK</strong> identifica o provider de demonstração; <strong>CALCULATED</strong>{' '}
        identifica valores derivados pelo EV ChargeOps. Ausências permanecem indisponíveis e nunca
        são convertidas em zero.
      </p>
    </div>
  );
}
