import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#8b5cf6', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'];

const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' };

export function AttendanceTrendsChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: string) => v.slice(8)} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
        <Bar dataKey="present" name="Present" stackId="a" fill="#10b981" />
        <Bar dataKey="absent" name="Absent" stackId="a" fill="#ef4444" />
        <Bar dataKey="leave" name="Leave" stackId="a" fill="#f59e0b" />
        <Bar dataKey="holiday" name="Holiday" stackId="a" fill="#8b5cf6" />
        <Bar dataKey="half_day" name="Half Day" stackId="a" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DeptAttendanceChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
        <Bar dataKey="present" name="Present" fill="#10b981" />
        <Bar dataKey="absent" name="Absent" fill="#ef4444" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LeaveUsageChart({ data, types }: { data: any[]; types: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
        {types.map((type, i) => (
          <Line key={type} type="monotone" dataKey={type} name={type.charAt(0).toUpperCase() + type.slice(1)} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TaskPieChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={70} label={({ name, value }: any) => `${name}: ${value}`}>
          {data.map((_: any, i: number) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function OvertimeChart({ data, departments }: { data: any[]; departments: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Math.round(v * 10) / 10}h`} />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
        {departments.map((dept, i) => (
          <Bar key={dept} dataKey={dept} name={dept} fill={COLORS[i % COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
