let findingIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
  const btnAdd = document.getElementById('btnAddFinding');
  const btnSubmit = document.getElementById('btnSubmit');

  if (btnAdd) btnAdd.addEventListener('click', addFinding);
  if (btnSubmit) btnSubmit.addEventListener('click', submitInspection);

  addFinding(); // Start with 1 finding card
});

function addFinding() {
  findingIndex++;
  const container = document.getElementById('findingsContainer');
  const div = document.createElement('div');
  div.className = 'bg-white p-4 rounded shadow mb-4 finding-card';
  div.innerHTML = `
    <h3 class="font-semibold mb-2 text-blue-700">Temuan #${findingIndex}</h3>
    <textarea class="w-full p-2 border rounded mb-2" placeholder="APA yang ditemukan (WHAT)" data-field="what"></textarea>
    <input class="w-full p-2 border rounded mb-2" placeholder="WHERE (Lokasi spesifik)" data-field="where_location"/>
    <select class="w-full p-2 border rounded mb-2" data-field="tingkat_risiko">
      <option value="">Pilih Tingkat Risiko</option>
      <option>Rendah</option><option>Sedang</option><option>Tinggi</option>
    </select>
    <textarea class="w-full p-2 border rounded mb-2" placeholder="Rekomendasi Perbaikan" data-field="rekomendasi"></textarea>
  `;
  container.appendChild(div);
}

async function submitInspection() {
  const tanggal = document.getElementById('tanggal').value;
  const lokasi = document.getElementById('lokasi').value;
  const area = document.getElementById('area').value;

  if (!tanggal || !lokasi) return alert("Isi tanggal dan lokasi!");

  const { data: { user } } = await window.supabaseClient.auth.getUser();

  const { data: inspection, error } = await window.supabaseClient
    .from('inspections')
    .insert({
      tanggal_inspeksi: tanggal,
      lokasi_tambang: lokasi,
      area_kerja: area,
      inspector_id: user.id,
      status: 'draft'
    }).select().single();

  if (error) return alert(error.message);

  const findingCards = document.querySelectorAll('.finding-card');
  for (const card of findingCards) {
    const data = { inspection_id: inspection.id };
    card.querySelectorAll('[data-field]').forEach(el => {
      data[el.dataset.field] = el.value;
    });

    await window.supabaseClient.from('inspection_findings').insert(data);
  }

  alert('Inspeksi berhasil disimpan');
  window.location.href = 'dashboard.html';
}