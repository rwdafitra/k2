let findingIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnAddFinding').addEventListener('click', addFinding);
    document.getElementById('btnSubmit').addEventListener('click', submitInspection);
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
            <span class="text-[10px] bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold uppercase">Foto & Detail</span>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Upload Bukti Foto</label>
                <input type="file" class="input-pro text-sm file-input" accept="image/*">
            </div>

            <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">What (Uraian Temuan)</label>
                <textarea class="input-pro h-20" data-field="what" placeholder="Apa temuannya?"></textarea>
            </div>
            
            <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Where (Lokasi Spesifik)</label>
                <input type="text" class="input-pro" data-field="where_location" placeholder="Lokasi spesifik">
            </div>

            <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Tingkat Risiko</label>
                <select class="input-pro" data-field="tingkat_risiko">
                    <option>Rendah</option><option>Sedang</option><option>Tinggi</option><option>Ekstrim</option>
                </select>
            </div>

            <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Rekomendasi</label>
                <textarea class="input-pro" data-field="rekomendasi" placeholder="Langkah perbaikan..."></textarea>
            </div>
        </div>
    `;
    container.appendChild(div);
}

async function submitInspection() {
    const btn = document.getElementById('btnSubmit');
    const tanggal = document.getElementById('tanggal_inspeksi').value;
    const lokasi = document.getElementById('lokasi_tambang').value;

    if (!tanggal || !lokasi) return alert("Isi Tanggal dan Lokasi!");

    btn.disabled = true;
    btn.innerText = "SEDANG MENGUPLOAD DATA & FOTO...";

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();

        // 1. Simpan Inspeksi Utama
        const { data: inspection, error: insError } = await window.supabaseClient
            .from('inspections')
            .insert({
                tanggal_inspeksi: tanggal,
                lokasi_tambang: lokasi,
                area_kerja: document.getElementById('area_kerja').value,
                inspector_id: user.id,
                status: 'draft'
            }).select().single();

        if (insError) throw insError;

        // 2. Loop semua temuan
        const findingCards = document.querySelectorAll('.finding-card');
        
        for (const card of findingCards) {
            const dataFinding = { inspection_id: inspection.id };
            card.querySelectorAll('[data-field]').forEach(el => {
                dataFinding[el.dataset.field] = el.value;
            });

            // Simpan Data Temuan ke DB
            const { data: savedFinding, error: findError } = await window.supabaseClient
                .from('inspection_findings')
                .insert(dataFinding).select().single();
            
            if (findError) throw findError;

            // 3. Proses Foto Jika Ada
            const fileInput = card.querySelector('.file-input');
            const file = fileInput.files[0];

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                // Upload ke Storage
                const { error: uploadError } = await window.supabaseClient.storage
                    .from('inspeksi_files')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Catat ke tabel inspection_photos
                await window.supabaseClient.from('inspection_photos').insert({
                    inspection_id: inspection.id,
                    finding_id: savedFinding.id,
                    file_path: filePath,
                    uploaded_by: user.id
                });
            }
        }

        alert("Berhasil disimpan!");
        window.location.href = 'dashboard.html';

    } catch (err) {
        alert("Gagal: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "SIMPAN SEMUA DATA";
    }
}