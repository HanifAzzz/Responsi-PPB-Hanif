require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env');
  // Biarkan Vercel melaporkan kesalahan konfigurasi saat request, bukan saat import.
}
const db = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    }) : null;
app.use((req, res, next) => {
  if (!db && req.path !== '/') return res.status(503).json({ message: 'Supabase belum dikonfigurasi' });
  next();
});
const allowed = ['Dipinjam', 'Dikembalikan', 'Terlambat'];
const fields = ['member_name', 'book_title', 'loan_date', 'due_date', 'return_date', 'status'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validDate = v => typeof v === 'string' && datePattern.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const errorResponse = (res, error) => res.status(500).json({ message: 'Terjadi kesalahan database', error: error.message });
const validId = (req, res, next) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ message: 'ID harus bilangan bulat positif' });
  next();
};
function validate(payload, complete = false) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Body harus objek JSON';
  if (Object.keys(payload).some(key => !fields.includes(key))) return 'Ada field yang tidak dikenal';
  if (complete && ['member_name', 'book_title', 'loan_date', 'due_date'].some(k => payload[k] === undefined)) return 'Nama anggota, judul buku, tanggal pinjam, dan jatuh tempo wajib diisi';
  if (Object.keys(payload).length === 0) return 'Tidak ada data untuk diperbarui';
  for (const key of ['member_name', 'book_title']) {
    if (key in payload && (typeof payload[key] !== 'string' || !payload[key].trim())) return `${key} harus berupa teks yang tidak kosong`;
  }
  for (const key of ['loan_date', 'due_date', 'return_date']) {
    if (key in payload && !(key === 'return_date' && payload[key] === null) && !validDate(payload[key])) return `${key} harus tanggal valid YYYY-MM-DD`;
  }
  if ('status' in payload && !allowed.includes(payload.status)) return 'Status tidak valid';
  return null;
}
function validateDates(data) {
  if (data.due_date < data.loan_date) return 'Tanggal jatuh tempo tidak boleh sebelum tanggal pinjam';
  if (data.return_date && data.return_date < data.loan_date) return 'Tanggal kembali tidak boleh sebelum tanggal pinjam';
  if (data.status === 'Dikembalikan' && !data.return_date) return 'Status Dikembalikan membutuhkan return_date';
  if (data.status !== 'Dikembalikan' && data.return_date) return 'return_date hanya boleh diisi jika status Dikembalikan';
  return null;
}
app.get('/', (_req, res) => res.json({ message: 'Library Loans API aktif', endpoints: '/loans' }));
app.get('/loans', async (req, res) => {
  const { status, member_name } = req.query;
  if (status !== undefined && (typeof status !== 'string' || !allowed.includes(status))) return res.status(400).json({ message: 'Filter status tidak valid' });
  if (member_name !== undefined && (typeof member_name !== 'string' || !member_name.trim())) return res.status(400).json({ message: 'Filter member_name tidak valid' });
  let query = db.from('loans').select('*').order('id', { ascending: false });
  if (status) query = query.eq('status', status);
  if (member_name) query = query.ilike('member_name', `%${member_name.replace(/[%_\\]/g, '\\$&')}%`);
  const { data, error } = await query;
  if (error) return errorResponse(res, error);
  res.json({ message: 'Data peminjaman berhasil diambil', count: data.length, data });
});
app.get('/loans/:id', validId, async (req, res) => {
  const { data, error } = await db.from('loans').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return errorResponse(res, error);
  if (!data) return res.status(404).json({ message: 'Data peminjaman tidak ditemukan' });
  res.json({ data });
});
app.post('/loans', async (req, res) => {
  const issue = validate(req.body, true);
  if (issue) return res.status(400).json({ message: issue });
  const payload = { ...req.body, status: req.body.status ?? 'Dipinjam', return_date: req.body.return_date ?? null };
  const dateIssue = validateDates(payload);
  if (dateIssue) return res.status(400).json({ message: dateIssue });
  const { data, error } = await db.from('loans').insert(payload).select().single();
  if (error) return errorResponse(res, error);
  res.status(201).json({ message: 'Peminjaman berhasil ditambahkan', data });
});
app.put('/loans/:id', validId, async (req, res) => {
  const issue = validate(req.body);
  if (issue) return res.status(400).json({ message: issue });
  const existing = await db.from('loans').select('*').eq('id', req.params.id).maybeSingle();
  if (existing.error) return errorResponse(res, existing.error);
  if (!existing.data) return res.status(404).json({ message: 'Data peminjaman tidak ditemukan' });
  const payload = { ...existing.data, ...req.body };
  const dateIssue = validateDates(payload);
  if (dateIssue) return res.status(400).json({ message: dateIssue });
  const { data, error } = await db.from('loans').update(req.body).eq('id', req.params.id).select().single();
  if (error) return errorResponse(res, error);
  res.json({ message: 'Peminjaman berhasil diperbarui', data });
});
app.delete('/loans/:id', validId, async (req, res) => {
  const { data, error } = await db.from('loans').delete().eq('id', req.params.id).select('id');
  if (error) return errorResponse(res, error);
  if (!data.length) return res.status(404).json({ message: 'Data peminjaman tidak ditemukan' });
  res.json({ message: 'Peminjaman berhasil dihapus' });
});
app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ message: 'Format JSON tidak valid' });
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan server' });
});
const port = Number(process.env.PORT) || 3000;
if (require.main === module) {
  app.listen(port, () => console.log(`API berjalan di http://localhost:${port}`));
}
module.exports = app;
