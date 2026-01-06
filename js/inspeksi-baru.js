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
                <textarea class="input-pro h-20" data-field="what" id="first_finding_text" placeholder="Uraikan temuan keselamatan..."></textarea>
            </div>
            
            <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Where (Lokasi Spesifik)</label>
                <input type="text" class="input-pro" data-field="where_location" placeholder="Titik koordinat / Nama unit">
            </div>

            <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Tingkat Risiko</label>
                <select class="input-pro" data-field="tingkat_risiko">
                    <option value="Rendah">Rendah</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Tinggi">Tinggi</option>
                    <option value="Ekstrim">Ekstrim</option>
                </select>
            </div>

            <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Rekomendasi Perbaikan</label>
                <textarea class="input-pro h-20" data-field="rekomendasi" id="first_recom_text" placeholder="Langkah perbaikan..."></textarea>
            </div>
        </div>
    `;
    container.appendChild(div);
}

async function submitInspection() {
    const btn = document.getElementById('btnSubmit');
    const tanggal = document.getElementById('tanggal_inspeksi').value;
    const lokasi = document.getElementById('lokasi_tambang').value;
    const area = document.getElementById('area_kerja').value;

    const uraianPertama = document.getElementById('first_finding_text').value;
    const rekomendasiPertama = document.getElementById('first_recom_text').value;
    const risikoPertama = document.querySelector('[data-field="tingkat_risiko"]').value;

    if (!tanggal || !lokasi || !uraianPertama) {
        alert("Mohon isi Tanggal, Lokasi, dan Uraian Temuan!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "SEDANG MENYIMPAN DATA...";

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error("Sesi berakhir, silakan login ulang.");

        // PERBAIKAN: Status diubah menjadi 'DRAFT' (Huruf Kapital) 
        // untuk melewati 'inspections_status_check'
        const { data: inspection, error: insError } = await window.supabaseClient
            .from('inspections')
            .insert({
                tanggal_inspeksi: tanggal,
                lokasi_tambang: lokasi,
                area_kerja: area,
                inspector_id: user.id,
                status: 'DRAFT',                // <-- Huruf kapital
                uraian_temuan: uraianPertama,
                rekomendasi: rekomendasiPertama,
                tingkat_risiko: risikoPertama
            }).select().single();

        if (insError) throw insError;

        const findingCards = document.querySelectorAll('.finding-card');
        
        for (const card of findingCards) {
            const dataFinding = { inspection_id: inspection.id };
            card.querySelectorAll('[data-field]').forEach(el => {
                dataFinding[el.dataset.field] = el.value;
            });

            const { data: savedFinding, error: findError } = await window.supabaseClient
                .from('inspection_findings')
                .insert(dataFinding).select().single();
            
            if (findError) throw findError;

            const fileInput = card.querySelector('.file-input');
            const file = fileInput.files[0];

            if (file) {
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
                const filePath = `inspeksi/${user.id}/${fileName}`;

                const { error: uploadError } = await window.supabaseClient.storage
                    .from('inspeksi_files')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                await window.supabaseClient.from('inspection_photos').insert({
                    inspection_id: inspection.id,
                    finding_id: savedFinding.id,
                    file_path: filePath,
                    uploaded_by: user.id
                });
            }
        }

        alert("Berhasil! Laporan inspeksi telah disimpan.");
        window.location.href = 'dashboard.html';

    } catch (err) {
        console.error("Error Detail:", err);
        alert("Gagal menyimpan: " + (err.message || "Terjadi kesalahan sistem"));
    } finally {
        btn.disabled = false;
        btn.innerText = "SIMPAN SEMUA DATA";
    }
}