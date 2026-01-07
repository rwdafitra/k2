document.addEventListener('DOMContentLoaded', () => {
  // Memberi jeda sedikit agar window.supabaseClient di app.js sudah terinisialisasi
  const checkClient = setInterval(() => {
    if (window.supabaseClient) {
      clearInterval(checkClient);
      loadDashboardData();
    }
  }, 100);
});

async function loadDashboardData() {
  try {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return;

    // Ambil data inspeksi milik user yang sedang login
    const { data: inspections, error } = await window.supabaseClient
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 1. UPDATE STATISTIK
    // Menggunakan toUpperCase() agar pengecekan status lebih aman
    const total = inspections.length;
    const draftCount = inspections.filter(i => i.status?.toUpperCase() === 'DRAFT').length;
    const closedCount = inspections.filter(i => i.status?.toUpperCase() === 'CLOSED').length;

    document.getElementById('total-inspeksi').innerText = total;
    document.getElementById('total-draft').innerText = draftCount;
    document.getElementById('total-closed').innerText = closedCount;

    // 2. RENDER TABEL
    const listContainer = document.getElementById('inspection-list');
    
    if (!inspections || inspections.length === 0) {
      listContainer.innerHTML = `
        <div class="p-20 text-center">
          <div class="text-slate-300 mb-4">
            <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <p class="text-slate-400 font-medium italic">Belum ada riwayat data inspeksi.</p>
        </div>`;
      return;
    }

    listContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="text-slate-400 text-[11px] uppercase tracking-widest border-b">
              <th class="px-8 py-4">Tanggal</th>
              <th class="px-8 py-4">Lokasi / Area</th>
              <th class="px-8 py-4 text-center">Status</th>
              <th class="px-8 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="text-slate-700 font-medium">
            ${inspections.map(ins => {
              const status = ins.status?.toUpperCase() || 'DRAFT';
              const badgeClass = status === 'DRAFT' 
                ? 'bg-yellow-100 text-yellow-700' 
                : 'bg-green-100 text-green-700';

              return `
                <tr onclick="window.location.href='detail-inspeksi.html?id=${ins.id}'" 
                    class="border-b border-slate-50 hover:bg-blue-50/50 transition cursor-pointer group">
                  <td class="px-8 py-5 text-sm">
                    ${new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}
                  </td>
                  <td class="px-8 py-5 text-sm">
                    <span class="block font-bold text-slate-900 group-hover:text-blue-700">${ins.lokasi_tambang}</span>
                    <span class="text-xs text-slate-400">${ins.area_kerja || '-'}</span>
                  </td>
                  <td class="px-8 py-5 text-center text-xs">
                    <span class="px-4 py-1.5 rounded-full font-bold ${badgeClass}">
                      ${status}
                    </span>
                  </td>
                  <td class="px-8 py-5 text-right">
                    <span class="text-blue-600 text-sm font-bold opacity-0 group-hover:opacity-100 transition">Lihat Detail →</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

  } catch (err) {
    console.error("Dashboard Error:", err);
    const listContainer = document.getElementById('inspection-list');
    if (listContainer) {
      listContainer.innerHTML = `<div class="p-10 text-red-500 text-center">Gagal memuat data: ${err.message}</div>`;
    }
  }
}