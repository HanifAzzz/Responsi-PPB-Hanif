# Library Loans REST API

REST API pencatatan peminjaman buku perpustakaan menggunakan **Node.js**, **Express.js**, dan **Supabase PostgreSQL**, dapat di-deploy ke **Vercel**. Mendukung CRUD dan filter berdasarkan status/nama anggota.

## URL deployment

**Base URL:** `https://<nama-project>.vercel.app` **(ganti dengan URL asli setelah deployment; belum di-deploy)**.

**Repository:** `https://github.com/<username>/library-loans-api` **(ganti setelah push ke GitHub)**.

## Struktur proyek

```text
api/index.js        Entry point Vercel
src/server.js       Express routes, validasi, dan Supabase client
schema.sql          SQL pembuatan tabel dan indeks
vercel.json         Rewrite seluruh request ke Express
.env.example        Contoh variabel environment
package.json        Dependencies dan scripts
```

## Skema tabel `public.loans`

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint identity | Primary key otomatis |
| member_name | text | Nama anggota, wajib |
| book_title | text | Judul buku, wajib |
| loan_date | date | Tanggal pinjam, wajib |
| due_date | date | Jatuh tempo, wajib, >= loan_date |
| return_date | date/null | Tanggal pengembalian |
| status | text | Dipinjam / Dikembalikan / Terlambat |
| created_at | timestamptz | Waktu pencatatan otomatis |

`Dikembalikan` harus memiliki `return_date`. Status `Terlambat` diatur manual (belum otomatis).

## Instalasi lokal

1. Install Node.js versi 18 atau lebih baru.
2. Buat project Supabase, buka **SQL Editor**, jalankan isi `schema.sql`.
3. Salin `.env.example` menjadi `.env` dan isi `SUPABASE_URL` serta `SUPABASE_SERVICE_ROLE_KEY` dari dashboard Supabase. **Jangan commit `.env` atau membagikan service role key.**
4. Jalankan:

```bash
npm install
npm run dev
```

API: `http://localhost:3000`. Tes `GET /` untuk health check sederhana.

## Endpoint dan contoh request/response

### POST /loans — Create

```http
POST /loans
Content-Type: application/json

{
  "member_name": "Budi Santoso",
  "book_title": "Laskar Pelangi",
  "loan_date": "2026-10-10",
  "due_date": "2026-10-17",
  "status": "Dipinjam"
}
```

Contoh response `201 Created` (ID dan timestamp merupakan contoh):

```json
{
  "message": "Peminjaman berhasil ditambahkan",
  "data": {
    "id": 1,
    "member_name": "Budi Santoso",
    "book_title": "Laskar Pelangi",
    "loan_date": "2026-10-10",
    "due_date": "2026-10-17",
    "return_date": null,
    "status": "Dipinjam",
    "created_at": "2026-10-10T12:00:00+00:00"
  }
}
```

### GET /loans — Read all

```http
GET /loans
GET /loans?status=Terlambat
GET /loans?member_name=Budi
GET /loans?status=Dipinjam&member_name=Budi
```

Contoh response `200 OK`:

```json
{ "message": "Data peminjaman berhasil diambil", "count": 0, "data": [] }
```

### GET /loans/:id — Read one

```http
GET /loans/1
```

Response `200 OK`: `{ "data": { "id": 1, "member_name": "Budi Santoso", "book_title": "Laskar Pelangi", "loan_date": "2026-10-10", "due_date": "2026-10-17", "return_date": null, "status": "Dipinjam", "created_at": "2026-10-10T12:00:00+00:00" } }`

### PUT /loans/:id — Update (mendukung partial fields)

```http
PUT /loans/1
Content-Type: application/json

{ "status": "Dikembalikan", "return_date": "2026-10-15" }
```

Response `200 OK`:

```json
{ "message": "Peminjaman berhasil diperbarui", "data": { "id": 1, "member_name": "Budi Santoso", "book_title": "Laskar Pelangi", "loan_date": "2026-10-10", "due_date": "2026-10-17", "return_date": "2026-10-15", "status": "Dikembalikan", "created_at": "2026-10-10T12:00:00+00:00" } }
```

### DELETE /loans/:id — Delete

```http
DELETE /loans/1
```

Response `200 OK`:

```json
{ "message": "Peminjaman berhasil dihapus" }
```

Error umum: `400` input/filter tidak valid, `404` data tidak ditemukan, `500` kesalahan database, `503` konfigurasi Supabase belum tersedia.

## Deploy ke Vercel

1. Push seluruh folder proyek ke repository **GitHub publik** (kecuali `.env` dan `node_modules`).
2. Masuk ke [vercel.com/new](https://vercel.com/new), **Import Git Repository**.
3. Pilih repository; gunakan konfigurasi default Node.js/Other, root directory proyek. File `api/index.js` adalah serverless function dan `vercel.json` mengarahkan request ke sana.
4. Di **Settings → Environment Variables**, tambahkan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` dengan nilai asli. Jangan gunakan prefiks `NEXT_PUBLIC_`.
5. Klik **Deploy**, buka URL yang diberikan Vercel. Uji `GET /`, `GET /loans`, lalu CRUD dengan Postman.
6. **Edit bagian URL deployment dan repository di README ini**, commit, push kembali. Pastikan deployment publik dapat diakses.

> Catatan keamanan: API ini sengaja sederhana untuk responsi, tanpa autentikasi pengguna. Service role key hanya disimpan di environment server. Jangan gunakan API publik tanpa autentikasi untuk data anggota sungguhan.

## Pengumpulan

Kirim **link GitHub publik** dan **base URL Vercel yang sudah berfungsi** melalui form pengumpulan.
