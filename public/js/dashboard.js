document.addEventListener('DOMContentLoaded', async () => {
  // Tunggu sebentar untuk memastikan supabaseClient sudah siap dari app.js
  setTimeout(loadDashboardData, 500);
});

async function loadDashboardData() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) return;

  // 1. Ambil Data Inspeksi
  const { data: inspections, error } = await window.supabaseClient
    .from('inspections')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching data:', error.message);
    return;
  }

  // 2. Update Counter Summary
  const total = inspections.length;
  const draft = inspections.filter(i => i.status === 'draft').length;
  const closed = inspections.filter(i => i.status === 'closed').length;

  document.getElementById('total-inspeksi').innerText = total;
  document.getElementById('total-draft').innerText = draft;
  document.getElementById('total-closed').innerText = closed;

  // 3. Tampilkan List Inspeksi
  const listContainer = document.getElementById('inspection-list');
  
  if (inspections.length === 0) {
    listContainer.innerHTML = '<p class="text-center py-4">Belum ada data inspeksi.</p>';
    return;
  }

  listContainer.innerHTML = `
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="border-b">
          <th class="py-2">Tanggal</th>
          <th class="py-2">Lokasi</th>
          <th class="py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        ${inspections.map(ins => `
          <tr class="border-b hover:bg-gray-50 cursor-pointer">
            <td class="py-2">${new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID')}</td>
            <td class="py-2 font-medium">${ins.lokasi_tambang}</td>
            <td class="py-2">
              <span class="px-2 py-1 rounded text-xs ${ins.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                ${ins.status.toUpperCase()}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}