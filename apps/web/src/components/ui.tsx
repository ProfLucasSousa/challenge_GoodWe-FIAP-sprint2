import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, CircleAlert, Lightbulb, PlugZap } from 'lucide-react';

export function StatCard({
  label,
  value,
  helper,
  trend,
  icon,
  origin,
}: {
  label: string;
  value: string;
  helper?: string;
  trend?: string;
  icon: ReactNode;
  origin?: 'REAL' | 'MOCK' | 'CALCULATED';
}) {
  return (
    <article className="stat-card">
      <div className="stat-head">
        <span>{label}</span>
        <span className="stat-meta">
          {origin && <StatusBadge status={origin} />}
          <i>{icon}</i>
        </span>
      </div>
      <strong>{value}</strong>
      {(helper || trend) && (
        <p>
          {trend && (
            <b className={trend.startsWith('-') ? 'down' : ''}>
              {trend.startsWith('-') ? <ArrowDownRight /> : <ArrowUpRight />}
              {trend}
            </b>
          )}{' '}
          {helper}
        </p>
      )}
    </article>
  );
}

const statusLabels: Record<string, string> = {
  AVAILABLE: 'Disponível',
  CHARGING: 'Carregando',
  OFFLINE: 'Offline',
  FAULT: 'Falha',
  UNKNOWN: 'Desconhecido',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  COMPLETED: 'Concluída',
  INTERRUPTED: 'Interrompida',
  ERROR: 'Erro',
  PENDING_REVIEW: 'Revisão pendente',
  VALID: 'Validado',
  PARTIAL: 'Parcial',
  INVALID: 'Inválido',
  OPEN: 'Aberta',
  CLOSED: 'Fechada',
  PAID: 'Paga',
  CANCELLED: 'Cancelada',
  CONNECTED: 'Conectada',
  REAL: 'Real',
  MOCK: 'Mock',
  CALCULATED: 'Calculado',
  UNAVAILABLE: 'Indisponível',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = ['AVAILABLE', 'ACTIVE', 'COMPLETED', 'VALID', 'PAID', 'CONNECTED', 'REAL'].includes(
    status,
  )
    ? 'success'
    : ['CHARGING', 'MOCK'].includes(status)
      ? 'info'
      : ['PENDING_REVIEW', 'PARTIAL', 'OPEN', 'INTERRUPTED', 'CALCULATED'].includes(status)
        ? 'warning'
        : ['FAULT', 'ERROR', 'INVALID'].includes(status)
          ? 'danger'
          : 'neutral';
  return (
    <span className={`status-badge ${tone}`}>
      <i />
      {statusLabels[status] ?? status}
    </span>
  );
}

export interface DataColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: 'right';
}
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty = 'Nenhum registro encontrado.',
}: {
  columns: DataColumn<T>[];
  rows: T[];
  empty?: string;
}) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key} className={column.align}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="empty-cell">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function EnergyChart({
  data,
  color = '#b5ce39',
}: {
  data: Array<{ label: string; value: number }>;
  color?: string;
}) {
  const gradient = `fill-${color.replace('#', '')}`;
  return (
    <div className="energy-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e8ece5" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#858e86', fontSize: 11 }}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#858e86', fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [`${value} kWh`, 'Energia']}
            contentStyle={{ borderRadius: 10, border: '1px solid #dfe5dc', fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradient})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TelemetryChart({
  data,
}: {
  data: Array<{ timestamp: string; powerKw: number | string | null }>;
}) {
  const points = data
    .filter((item) => item.powerKw != null)
    .map((item) => ({
      time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
        new Date(item.timestamp),
      ),
      powerKw: Number(item.powerKw),
    }));
  if (!points.length) {
    return (
      <div className="telemetry-empty">
        Não há leituras temporais disponibilizadas pela integração atual.
      </div>
    );
  }
  return (
    <div className="energy-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 16, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="#e8ece5" vertical={false} />
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#858e86', fontSize: 10 }}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#858e86', fontSize: 10 }} />
          <Tooltip formatter={(value) => [`${value} kW`, 'Potência']} />
          <Line
            type="monotone"
            dataKey="powerKw"
            stroke="#2c6c70"
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UsageHeatmap({
  data,
}: {
  data: Array<{ day: number; slot: number; value: number }>;
}) {
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return (
    <div className="heatmap">
      <div className="heat-hours">
        <span />
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
      </div>
      {days.map((day, dayIndex) => (
        <div className="heat-row" key={day}>
          <span>{day}</span>
          {data
            .filter((cell) => cell.day === dayIndex)
            .map((cell) => (
              <i
                key={cell.slot}
                title={`${day}: intensidade ${cell.value}`}
                style={{ opacity: Math.max(0.12, cell.value / 15) }}
              />
            ))}
        </div>
      ))}
      <div className="heat-legend">
        <span>Menor uso</span>
        <i />
        <i />
        <i />
        <i />
        <span>Maior uso</span>
      </div>
    </div>
  );
}

export function InsightCard({
  type = 'insight',
  title,
  children,
  meta,
}: {
  type?: 'insight' | 'warning';
  title: string;
  children: ReactNode;
  meta: string;
}) {
  return (
    <article className={`insight-card ${type}`}>
      <span>{type === 'warning' ? <CircleAlert /> : <Lightbulb />}</span>
      <div>
        <small>{title}</small>
        <p>{children}</p>
        <em>{meta}</em>
      </div>
    </article>
  );
}

export function ProviderStatusCard({
  provider,
  readOnly,
  connected,
  lastSync,
  capabilities,
  chargers,
  lastError,
}: {
  provider: string;
  readOnly: boolean;
  connected: boolean;
  lastSync: string;
  capabilities: string[];
  chargers: number;
  lastError?: string | null;
}) {
  return (
    <article className="provider-card">
      <header>
        <span className="provider-logo">
          <PlugZap />
        </span>
        <div>
          <p>GoodWe SEMS+</p>
          <StatusBadge status={connected ? 'CONNECTED' : 'PREPARED'} />
        </div>
      </header>
      <dl>
        <div>
          <dt>Provider atual</dt>
          <dd>{provider}</dd>
        </div>
        <div>
          <dt>Modo</dt>
          <dd>{readOnly ? 'READ-ONLY' : 'NÃO CONFIRMADO'}</dd>
        </div>
        <div>
          <dt>Última sincronização</dt>
          <dd>{lastSync}</dd>
        </div>
        <div>
          <dt>Carregadores identificados</dt>
          <dd>{chargers}</dd>
        </div>
      </dl>
      <div className="capabilities">
        <small>CAPABILITIES CONFIRMADAS</small>
        {capabilities.length ? (
          capabilities.map((item) => <span key={item}>{item}</span>)
        ) : (
          <p>Nenhuma capability confirmada.</p>
        )}
      </div>
      {lastError && (
        <div className="provider-error">
          <CircleAlert />{' '}
          <span>
            <b>Último erro</b>
            {lastError}
          </span>
        </div>
      )}
    </article>
  );
}
