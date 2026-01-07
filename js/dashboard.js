document.addEventListener('DOMContentLoaded', () => {
  // Tunggu sebentar untuk memastikan session ter-load
  setTimeout(loadDashboardData, 500);
});

async function loadDashboardData() {
  const { data: inspections, error } = await window.supabaseClient
    .from('inspections')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  // Update Statistik (Gunakan toUpperCase agar sinkron dengan DB)
  document.getElementById('total-inspeksi').innerText = inspections.length;
  document.getElementById('total-draft').innerText = inspections.filter(i => i.status?.toUpperCase() === 'DRAFT').length;
  document.getElementById('total-closed').innerText = inspections.filter(i => i.status?.toUpperCase() === 'CLOSED').length;

  const listContainer = document.getElementById('inspection-list');
  if (inspections.length === 0) {
    listContainer.innerHTML = '<div class="p-10 text-center text-slate-400 italic">Belum ada data.</div>';
    return;
  }

  listContainer.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
          <tr>
            <th class="px-8 py-3">Tanggal</th>
            <th class="px-8 py-3">Lokasi</th>
            <th class="px-8 py-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${inspections.map(ins => `
            <tr class="hover:bg-slate-50 transition cursor-pointer">
              <td class="px-8 py-4 text-sm">${new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID')}</td>
              <td class="px-8 py-4">
                <span class="block font-bold text-slate-800">${ins.lokasi_tambang}</span>
                <span class="text-xs text-slate-400">${ins.area_kerja || '-'}</span>
              </td>
              <td class="px-8 py-4 text-center">
                <span class="px-3 py-1 rounded-full text-[10px] font-bold ${ins.status?.toUpperCase() === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}">
                  ${ins.status?.toUpperCase()}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}