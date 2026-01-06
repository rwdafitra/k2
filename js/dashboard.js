document.addEventListener('DOMContentLoaded', async () => {
  // Tunggu app.js siap
  setTimeout(loadDashboardData, 800);
});

async function loadDashboardData() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) return;

  const { data: inspections, error } = await window.supabaseClient
    .from('inspections')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return;

  // Update Statistik
  document.getElementById('total-inspeksi').innerText = inspections.length;
  document.getElementById('total-draft').innerText = inspections.filter(i => i.status === 'draft').length;
  document.getElementById('total-closed').innerText = inspections.filter(i => i.status === 'closed').length;

  const listContainer = document.getElementById('inspection-list');
  
  if (inspections.length === 0) {
    listContainer.innerHTML = '<div class="p-20 text-center text-slate-400 font-medium italic">Belum ada riwayat data inspeksi.</div>';
    return;
  }

  listContainer.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead>
          <tr class="text-slate-400 text-[11px] uppercase tracking-widest border-b">
            <th class="px-8 py-4">Waktu & Tanggal</th>
            <th class="px-8 py-4">Lokasi / Area</th>
            <th class="px-8 py-4 text-center">Status</th>
          </tr>
        </thead>
        <tbody class="text-slate-700 font-medium">
          ${inspections.map(ins => `
            <tr class="border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer">
              <td class="px-8 py-5 text-sm">${new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</td>
              <td class="px-8 py-5 text-sm">
                <span class="block font-bold text-slate-900">${ins.lokasi_tambang}</span>
                <span class="text-xs text-slate-400">${ins.area_kerja || '-'}</span>
              </td>
              <td class="px-8 py-5 text-center text-xs">
                <span class="px-4 py-1.5 rounded-full font-bold shadow-sm ${ins.status === 'draft' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}">
                  ${ins.status.toUpperCase()}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}