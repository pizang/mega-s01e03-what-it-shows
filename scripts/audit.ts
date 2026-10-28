import path from 'node:path';
import reports from '../src/lib/data/reports-4471.json';
import notes from '../src/lib/data/desk-notes.json';
import { groupByCause, readAs, uniqueById, type Report, type Tenant } from '../src/lib/kb/causes';

const directory = path.resolve(import.meta.dir, '../src/lib/data/tenants');
const tenants = await Promise.all([...new Bun.Glob('*.json').scanSync(directory)].sort().map(async (file) => {
  const tenant: Tenant = await Bun.file(path.join(directory, file)).json();
  return tenant;
}));
const byHandle = new Map(tenants.map((tenant) => [tenant.handle, tenant]));
const unique = uniqueById(reports as Report[]);
const merged = unique.filter((report) => report.mergedInto === 4471);
const groups = groupByCause(merged, (report) => byHandle.get(report.tenant));
console.log(JSON.stringify({
  snapshot: '2026-10-04',
  rows: reports.length,
  unique: unique.length,
  duplicateRows: reports.length - unique.length,
  groups: groups.map((group) => ({
    ...group,
    reports: group.reports.map((report) => report.id),
    oneDayMove: readAs(group, notes.oneDayMove),
  })),
}, null, 2));
