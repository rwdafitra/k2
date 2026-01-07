let findingIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = document.getElementById('btnAddFinding');
    const btnSubmit = document.getElementById('btnSubmit');

    if (btnAdd) btnAdd.addEventListener('click', addFinding);
    if (btnSubmit) btnSubmit.addEventListener('click', submitInspection);

    addFinding(); 
});

function addFinding() {
    findingIndex++;
    const container = document.getElementById('findingsContainer');
    const div = document.createElement('div');
    div.className = 'card-pro p-8 mb-6 border-l-8 border-blue-600 finding-card';
    div.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h3 class="font-extrabold text-slate-900 text-lg uppercase">Temuan #${findingIndex}</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Upload Bukti Foto</label>
                <input type="file" class="input-pro text-sm file-input" accept="image/*">
            </div>
            <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">What (Temuan)</label>
                <textarea class="input-pro h-20 what-input" placeholder="Uraikan temuan..."></textarea>
            </div>
            <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Lokasi Spesifik</label>
                <input type="text" class="input-pro where-input" placeholder="Nama Unit/Koordinat">
            </div>
            <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Tingkat Risiko</label>
                <select class="input-pro risiko-input">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="EXTREME">Extreme</option>
                </select>
            </div>
            <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Rekomendasi</label>
                <textarea class="input-pro h-20 rekomendasi-input" placeholder="Saran perbaikan..."></textarea>
            </div>
        </div>
    `;
    container.appendChild(div);
}

async function submitInspection() {
    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.innerText = "SEDANG MENYIMPAN...";

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error("Sesi berakhir, silakan login kembali.");

        const tanggal_inspeksi = document.getElementById('tanggal_inspeksi').value;
        const lokasi_tambang = document.getElementById('lokasi_tambang').value;
        const area_kerja = document.getElementById('area_kerja').value;

        if (!tanggal_inspeksi || !lokasi_tambang) throw new Error("Lengkapi Tanggal dan Lokasi!");

        // Ambil data kartu pertama untuk mengisi kolom wajib di tabel inspections
        const firstCard = document.querySelector('.finding-card');
        const firstWhat = firstCard.querySelector('.what-input').value || "Laporan Rutin";
        const firstRisiko = firstCard.querySelector('.risiko-input').value || "LOW";

        // 1. Simpan ke tabel 'inspections'
        const { data: inspection, error: insError } = await window.supabaseClient
            .from('inspections')
            .insert({
                tanggal_inspeksi,
                lokasi_tambang,
                area_kerja,
                inspector_id: user.id,
                status: 'DRAFT',
                uraian_temuan: firstWhat, 
                tingkat_risiko: firstRisiko
            }).select().single();

        if (insError) throw insError;

        // 2. Simpan ke tabel 'inspection_findings'
        const cards = document.querySelectorAll('.finding-card');
        for (const card of cards) {
            const whatValue = card.querySelector('.what-input').value;
            if (!whatValue) continue;

            const { data: finding, error: fError } = await window.supabaseClient
                .from('inspection_findings')
                .insert({
                    inspection_id: inspection.id,
                    what: whatValue,
                    uraian_temuan: whatValue, // Kolom yang bermasalah di cache
                    tingkat_risiko: card.querySelector('.risiko-input').value,
                    rekomendasi: card.querySelector('.rekomendasi-input').value,
                    where_location: card.querySelector('.where-input').value || lokasi_tambang,
                    status: 'OPEN'
                }).select().single();

            if (fError) throw fError;

            // 3. Upload Foto ke Storage
            const file = card.querySelector('.file-input').files[0];
            if (file) {
                const fileName = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
                const filePath = `inspeksi/${user.id}/${fileName}`;
                
                const { error: upErr } = await window.supabaseClient.storage
                    .from('inspeksi_files').upload(filePath, file);

                if (!upErr) {
                    await window.supabaseClient.from('inspection_photos').insert({
                        inspection_id: inspection.id,
                        finding_id: finding.id,
                        file_path: filePath,
                        uploaded_by: user.id
                    });
                }
            }
        }

        alert("Berhasil disimpan!");
        window.location.href = 'dashboard.html';

    } catch (err) {
        console.error("Error Detail:", err);
        alert("Gagal: " + (err.message || "Terjadi kesalahan sistem"));
    } finally {
        btn.disabled = false;
        btn.innerText = "SIMPAN SEMUA DATA";
    }
}