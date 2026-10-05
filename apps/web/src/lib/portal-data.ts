export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export const chargers = [
  {
    id: '1',
    name: 'Vaga 01',
    model: 'GW22K-HCA-20',
    power: '22 kW',
    location: 'Garagem · G1',
    status: 'CHARGING',
    lastSeen: 'agora',
    utilization: 78,
  },
  {
    id: '2',
    name: 'Vaga 02',
    model: 'GW11K-HCA-20',
    power: '11 kW',
    location: 'Garagem · G1',
    status: 'AVAILABLE',
    lastSeen: 'há 2 min',
    utilization: 54,
  },
  {
    id: '3',
    name: 'Vaga 03',
    model: 'GW7K-HCA-20',
    power: '7 kW',
    location: 'Garagem · G2',
    status: 'OFFLINE',
    lastSeen: 'há 48 min',
    utilization: 21,
  },
  {
    id: '4',
    name: 'Visitantes',
    model: 'GW11K-HCA-20',
    power: '11 kW',
    location: 'Térreo',
    status: 'FAULT',
    lastSeen: 'há 16 min',
    utilization: 34,
  },
];

export const sessions = [
  {
    id: 'SES-1048',
    unit: 'A · 1204',
    user: 'Ana Souza',
    charger: 'Vaga 01',
    startedAt: '12 out · 18:20',
    duration: '1h 42min',
    energy: '18,75 kWh',
    amount: 'R$ 21,31',
    status: 'ACTIVE',
    quality: 'VALID',
  },
  {
    id: 'SES-1047',
    unit: 'B · 804',
    user: 'Rafael Lima',
    charger: 'Vaga 02',
    startedAt: '12 out · 07:10',
    duration: '2h 08min',
    energy: '14,20 kWh',
    amount: 'R$ 16,63',
    status: 'COMPLETED',
    quality: 'VALID',
  },
  {
    id: 'SES-1046',
    unit: 'C · 301',
    user: 'Camila Rocha',
    charger: 'Vaga 01',
    startedAt: '11 out · 21:00',
    duration: '2h 31min',
    energy: '21,40 kWh',
    amount: 'R$ 24,04',
    status: 'COMPLETED',
    quality: 'VALID',
  },
  {
    id: 'SES-1045',
    unit: 'A · 502',
    user: 'Não identificado',
    charger: 'Vaga 03',
    startedAt: '11 out · 17:35',
    duration: '46min',
    energy: '9,80 kWh',
    amount: 'Em análise',
    status: 'PENDING_REVIEW',
    quality: 'PARTIAL',
  },
  {
    id: 'SES-1044',
    unit: 'B · 1102',
    user: 'Bruno Nunes',
    charger: 'Vaga 02',
    startedAt: '10 out · 22:14',
    duration: '1h 51min',
    energy: '16,30 kWh',
    amount: 'R$ 18,70',
    status: 'INTERRUPTED',
    quality: 'VALID',
  },
];

export const units = [
  {
    id: 'u1',
    code: 'A · 1204',
    responsible: 'Ana Souza',
    users: 2,
    vehicles: 2,
    energy: '126,8 kWh',
    amount: 'R$ 143,42',
    trend: '+8%',
  },
  {
    id: 'u2',
    code: 'B · 804',
    responsible: 'Rafael Lima',
    users: 1,
    vehicles: 1,
    energy: '98,4 kWh',
    amount: 'R$ 112,16',
    trend: '-3%',
  },
  {
    id: 'u3',
    code: 'C · 301',
    responsible: 'Camila Rocha',
    users: 2,
    vehicles: 2,
    energy: '87,2 kWh',
    amount: 'R$ 99,66',
    trend: '+12%',
  },
  {
    id: 'u4',
    code: 'A · 502',
    responsible: 'Diego Martins',
    users: 1,
    vehicles: 1,
    energy: '64,1 kWh',
    amount: 'R$ 73,15',
    trend: '+2%',
  },
];

export const users = [
  {
    id: 'p1',
    name: 'Ana Souza',
    email: 'ana@exemplo.local',
    unit: 'A · 1204',
    role: 'USER',
    status: 'ACTIVE',
  },
  {
    id: 'p2',
    name: 'Rafael Lima',
    email: 'rafael@exemplo.local',
    unit: 'B · 804',
    role: 'USER',
    status: 'ACTIVE',
  },
  {
    id: 'p3',
    name: 'Camila Rocha',
    email: 'camila@exemplo.local',
    unit: 'C · 301',
    role: 'MANAGER',
    status: 'ACTIVE',
  },
  {
    id: 'p4',
    name: 'Diego Martins',
    email: 'diego@exemplo.local',
    unit: 'A · 502',
    role: 'USER',
    status: 'INACTIVE',
  },
];

export const vehicles = [
  {
    id: 'v1',
    name: 'Volvo EX30',
    owner: 'Ana Souza',
    plate: 'EVX-1A24',
    type: 'BEV',
    status: 'ACTIVE',
  },
  {
    id: 'v2',
    name: 'BYD Dolphin',
    owner: 'Rafael Lima',
    plate: 'ELE-8V04',
    type: 'BEV',
    status: 'ACTIVE',
  },
  {
    id: 'v3',
    name: 'GWM Haval H6',
    owner: 'Camila Rocha',
    plate: 'PHE-3C01',
    type: 'PHEV',
    status: 'ACTIVE',
  },
];

export const rfids = [
  {
    id: 'r1',
    uid: '•••• 91A4',
    owner: 'Ana Souza',
    unit: 'A · 1204',
    lastUse: '12 out · 18:20',
    status: 'ACTIVE',
  },
  {
    id: 'r2',
    uid: '•••• C802',
    owner: 'Rafael Lima',
    unit: 'B · 804',
    lastUse: '12 out · 07:10',
    status: 'ACTIVE',
  },
  {
    id: 'r3',
    uid: '•••• 33F1',
    owner: 'Camila Rocha',
    unit: 'C · 301',
    lastUse: '11 out · 21:00',
    status: 'ACTIVE',
  },
];

export const invoices = [
  {
    id: 'FAT-2026-10-A1204',
    unit: 'A · 1204',
    reference: 'Outubro 2026',
    energy: '126,8 kWh',
    energyAmount: 'R$ 137,42',
    fees: 'R$ 6,00',
    total: 'R$ 143,42',
    status: 'OPEN',
  },
  {
    id: 'FAT-2026-10-B804',
    unit: 'B · 804',
    reference: 'Outubro 2026',
    energy: '98,4 kWh',
    energyAmount: 'R$ 106,16',
    fees: 'R$ 6,00',
    total: 'R$ 112,16',
    status: 'CLOSED',
  },
  {
    id: 'FAT-2026-09-C301',
    unit: 'C · 301',
    reference: 'Setembro 2026',
    energy: '81,3 kWh',
    energyAmount: 'R$ 87,80',
    fees: 'R$ 6,00',
    total: 'R$ 93,80',
    status: 'PAID',
  },
];

export const dailyEnergy = [
  { label: '01', value: 74 },
  { label: '02', value: 92 },
  { label: '03', value: 68 },
  { label: '04', value: 116 },
  { label: '05', value: 84 },
  { label: '06', value: 132 },
  { label: '07', value: 104 },
  { label: '08', value: 173 },
  { label: '09', value: 112 },
  { label: '10', value: 146 },
  { label: '11', value: 128 },
  { label: '12', value: 97 },
];

export const hourlyUsage = [
  { label: '00h', value: 1 },
  { label: '03h', value: 0 },
  { label: '06h', value: 3 },
  { label: '09h', value: 2 },
  { label: '12h', value: 4 },
  { label: '15h', value: 3 },
  { label: '18h', value: 9 },
  { label: '21h', value: 7 },
];

export const monthlyUser = [
  { label: 'Mai', value: 46 },
  { label: 'Jun', value: 58 },
  { label: 'Jul', value: 51 },
  { label: 'Ago', value: 72 },
  { label: 'Set', value: 68 },
  { label: 'Out', value: 84 },
];

export const unitConsumption = units.map((unit) => ({
  label: unit.code,
  value: Number(unit.energy.replace(',', '.').split(' ')[0]),
}));

export const heatmap = Array.from({ length: 7 }, (_, day) =>
  Array.from({ length: 8 }, (_, slot) => ({
    day,
    slot,
    value: ((day * 3 + slot * 5) % 10) + (slot > 4 ? 5 : 0),
  })),
).flat();
