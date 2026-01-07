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
            <h3 class="font-extrabold text-slate-900 text-lg uppercase tracking-tight">Temuan #${findingIndex}</h3>
            <span class="text-[10px] bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold uppercase tracking-widest">Detail 5W+1H</span>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Upload Bukti Foto</label>
                <input type="file" class="input-pro text-sm file-input" accept="image/*">
            </div>

            <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">What (Apa Temuannya?)</label>
                <textarea class="input-pro h-20 what-input" placeholder="Uraikan temuan keselamatan..."></textarea>
            </div>
            
            <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Where (Lokasi Spesifik)</label>
                <input type="text" class="input-pro where-input" placeholder="Titik koordinat / Nama unit">
            </div>

            <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Tingkat Risiko</label>
                <select class="input-pro risiko-input">
                    <option value="LOW">Low (Rendah)</option>
                    <option value="MEDIUM" selected>Medium (Sedang)</option>
                    <option value="HIGH">High (Tinggi)</option>
                    <option value="EXTREME">Extreme (Gawat)</option>
                </select>
            </div>

            <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Rekomendasi Perbaikan</label>
                <textarea class="input-pro h-20 rekomendasi-input" placeholder="Langkah perbaikan yang disarankan..."></textarea>
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

        if (!tanggal_inspeksi || !lokasi_tambang) throw new Error("Tanggal dan Lokasi wajib diisi!");

        const firstCard = document.querySelector('.finding-card');
        const firstWhat = firstCard.querySelector('.what-input').value || "Laporan Inspeksi";
        const firstRisiko = firstCard.querySelector('.risiko-input').value;

        // 1. Simpan Header ke tabel inspections
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

        // 2. Simpan setiap temuan
        const cards = document.querySelectorAll('.finding-card');
        for (const card of cards) {
            const what = card.querySelector('.what-input').value;
            if (!what) continue;

            const { data: finding, error: fError } = await window.supabaseClient
                .from('inspection_findings')
                .insert({
                    inspection_id: inspection.id,
                    what: what,
                    uraian_temuan: what,
                    tingkat_risiko: card.querySelector('.risiko-input').value,
                    rekomendasi: card.querySelector('.rekomendasi-input').value,
                    where_location: card.querySelector('.where-input').value || lokasi_tambang,
                    status: 'OPEN'
                }).select().single();

            if (fError) throw fError;

            // 3. Proses Foto
            const fileInput = card.querySelector('.file-input');
            const file = fileInput.files[0];

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `inspeksi/${user.id}/${fileName}`;
                
                // Upload ke Storage
                const { error: upErr } = await window.supabaseClient.storage
                    .from('inspeksi_files').upload(filePath, file);

                if (!upErr) {
                    // Simpan referensi ke database (PENTING)
                    const { error: dbPhotoErr } = await window.supabaseClient
                        .from('inspection_photos').insert({
                            inspection_id: inspection.id,
                            finding_id: finding.id,
                            file_path: filePath,
                            uploaded_by: user.id
                        });
                    if (dbPhotoErr) console.error("Gagal catat foto di DB:", dbPhotoErr.message);
                } else {
                    console.error("Gagal upload file:", upErr.message);
                }
            }
        }

        alert("Berhasil disimpan!");
        window.location.href = 'dashboard.html';

    } catch (err) {
        console.error("Error Simpan:", err);
        alert("Gagal: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "SIMPAN SEMUA DATA";
    }
}