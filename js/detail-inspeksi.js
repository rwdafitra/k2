document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('id');

    if (!inspectionId) {
        alert("ID Inspeksi tidak ditemukan");
        window.location.href = 'dashboard.html';
        return;
    }

    const checkClient = setInterval(async () => {
        if (window.supabaseClient) {
            clearInterval(checkClient);
            loadDetailData(inspectionId);
        }
    }, 100);
});

async function loadDetailData(id) {
    try {
        // 1. Ambil Data Header
        const { data: ins, error: insErr } = await window.supabaseClient
            .from('inspections')
            .select('*')
            .eq('id', id)
            .single();

        if (insErr) throw insErr;

        document.getElementById('det-tanggal').innerText = new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('det-lokasi').innerText = ins.lokasi_tambang;
        document.getElementById('det-area').innerText = ins.area_kerja || '-';
        
        const statusColor = ins.status?.toUpperCase() === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
        document.getElementById('status-badge').innerHTML = `<span class="px-4 py-2 rounded-full font-bold text-xs ${statusColor}">${ins.status?.toUpperCase()}</span>`;

        // 2. Ambil Data Temuan & Foto Secara Bersamaan
        const [findingsRes, photosRes] = await Promise.all([
            window.supabaseClient.from('inspection_findings').select('*').eq('inspection_id', id),
            window.supabaseClient.from('inspection_photos').select('*').eq('inspection_id', id)
        ]);

        if (findingsRes.error) throw findingsRes.error;
        
        const findings = findingsRes.data;
        const photos = photosRes.data || [];

        console.log("Findings found:", findings); // Debugging
        console.log("Photos found:", photos);     // Debugging

        const listContainer = document.getElementById('findings-list');
        listContainer.innerHTML = '';

        if (findings.length === 0) {
            listContainer.innerHTML = '<div class="card-pro p-10 text-center text-slate-400">Tidak ada detail temuan.</div>';
            return;
        }

        findings.forEach((f, index) => {
            // PERBAIKAN LOGIKA: Cari foto berdasarkan finding_id
            const findingPhoto = photos.find(p => p.finding_id === f.id);
            let imgHtml = '';

            if (findingPhoto) {
                const { data } = window.supabaseClient.storage
                    .from('inspeksi_files')
                    .getPublicUrl(findingPhoto.file_path);
                
                console.log(`URL Foto Temuan #${index+1}:`, data.publicUrl); // Debugging URL

                imgHtml = `
                    <div class="mt-4">
                        <p class="text-[10px] font-black text-slate-400 uppercase mb-2">Bukti Foto</p>
                        <a href="${data.publicUrl}" target="_blank">
                            <img src="${data.publicUrl}" 
                                 alt="Foto Temuan" 
                                 class="rounded-xl border border-slate-200 max-h-80 w-full object-cover shadow-sm hover:opacity-90 transition"
                                 onerror="this.src='https://placehold.co/600x400?text=Foto+Tidak+Dapat+Dimuat'">
                        </a>
                    </div>
                `;
            } else {
                imgHtml = `
                    <div class="mt-4 p-6 bg-slate-100 rounded-xl text-center">
                        <p class="text-xs text-slate-400 italic">Tidak ada lampiran foto untuk temuan ini.</p>
                    </div>
                `;
            }

            const card = document.createElement('div');
            card.className = 'card-pro p-8 border-l-8 border-blue-600';
            card.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <div class="mb-4">
                            <span class="text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase">Temuan #${index + 1}</span>
                        </div>
                        <h3 class="text-xl font-extrabold text-slate-900 mb-2">${f.what || 'Tanpa Judul'}</h3>
                        <p class="text-slate-600 text-sm leading-relaxed mb-4">${f.uraian_temuan || ''}</p>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risiko</p>
                                <p class="font-bold text-sm ${getRisikoColor(f.tingkat_risiko)}">${f.tingkat_risiko || 'LOW'}</p>
                            </div>
                            <div>
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lokasi Spesifik</p>
                                <p class="font-bold text-sm text-slate-800">${f.where_location || '-'}</p>
                            </div>
                        </div>

                        <div class="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rekomendasi Perbaikan</p>
                            <p class="text-sm font-medium text-slate-700">${f.rekomendasi || 'Tidak ada rekomendasi.'}</p>
                        </div>
                    </div>
                    <div class="flex flex-col justify-center">
                        ${imgHtml}
                    </div>
                </div>
            `;
            listContainer.appendChild(card);
        });

    } catch (err) {
        console.error("Error Detail Page:", err);
        alert("Gagal memuat detail: " + err.message);
    }
}

function getRisikoColor(level) {
    switch (level?.toUpperCase()) {
        case 'LOW': return 'text-blue-600';
        case 'MEDIUM': return 'text-yellow-600';
        case 'HIGH': return 'text-orange-600';
        case 'EXTREME': return 'text-red-600';
        default: return 'text-slate-600';
    }
}