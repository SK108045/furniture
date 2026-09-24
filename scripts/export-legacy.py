"""Export existing SQLite data for Supabase SQL Editor; never changes the source."""
import json
import sqlite3
from pathlib import Path

source = Path('data/nicoo.sqlite')
if not source.exists():
    raise SystemExit('No legacy database found at data/nicoo.sqlite.')
db = sqlite3.connect(f'file:{source}?mode=ro', uri=True)
db.row_factory = sqlite3.Row
tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
lines = ['-- Run supabase/schema.sql first. Existing cloud rows are never overwritten.', 'BEGIN;']
def literal(value):
    if value is None: return 'NULL'
    if isinstance(value, bool): return 'true' if value else 'false'
    if isinstance(value, (int, float)): return str(value)
    return "'" + str(value).replace("'", "''") + "'"
count = 0
for table in ['orders', 'profiles', 'payment_callbacks']:
    if table not in tables: continue
    for row in db.execute(f'SELECT * FROM {table}'):
        data = dict(row)
        if table == 'payment_callbacks': data['applied'] = bool(data['applied'])
        for field in ['details', 'payload']:
            if field in data: data[field] = json.dumps(json.loads(data[field]), ensure_ascii=False)
        columns = ','.join('"' + c + '"' for c in data)
        lines.append(f'INSERT INTO public.nicoo_{table} ({columns}) VALUES ({",".join(literal(v) for v in data.values())}) ON CONFLICT DO NOTHING;')
        count += 1
lines.append('COMMIT;')
target = Path('data/supabase-legacy.sql')
target.write_text('\n'.join(lines) + '\n')
target.chmod(0o600)
print(f'Exported {count} rows to {target}. Local SQLite data was preserved.')
