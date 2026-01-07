document.addEventListener('DOMContentLoaded', async () => {
    // Ambil ID dari parameter URL
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('id');

    if (!inspectionId) {
        alert("ID Inspeksi tidak ditemukan");
        window.location.href = 'dashboard.html';
        return;
    }

    // Tunggu sebentar agar window.supabaseClient siap
    const checkClient = setInterval(async () => {
        if (window.supabaseClient) {
            clearInterval(checkClient);
            loadDetailData(inspectionId);
        }
    }, 100);
});

async function loadDetailData(id) {
    try {
        // 1. Ambil Data Header Inspeksi
        const { data: ins, error: insErr } = await window.supabaseClient
            .from('inspections')
            .select('*')
            .eq('id', id)
            .single();

        if (insErr) throw insErr;

        // Isi data header ke HTML
        document.getElementById('det-tanggal').innerText = new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('det-lokasi').innerText = ins.lokasi_tambang;
        document.getElementById('det-area').innerText = ins.area_kerja || '-';
        
        const statusColor = ins.status?.toUpperCase() === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
        document.getElementById('status-badge').innerHTML = `
            <span class="px-4 py-2 rounded-full font-bold text-xs ${statusColor}">${ins.status?.toUpperCase()}</span>
        `;

        // 2. Ambil Data Temuan
        const { data: findings, error: findErr } = await window.supabaseClient
            .from('inspection_findings')
            .select('*')
            .eq('inspection_id', id);

        if (findErr) throw findErr;

        // 3. Ambil Data Foto
        const { data: photos, error: photoErr } = await window.supabaseClient
            .from('inspection_photos')
            .select('*')
            .eq('inspection_id', id);

        const listContainer = document.getElementById('findings-list');
        listContainer.innerHTML = '';

        if (findings.length === 0) {
            listContainer.innerHTML = '<div class="card-pro p-10 text-center text-slate-400">Tidak ada detail temuan.</div>';
            return;
        }

        findings.forEach((f, index) => {
            // Cari foto yang berhubungan dengan finding ini
            const findingPhoto = photos.find(p => p.finding_id === f.id);
            let imgHtml = '';

            if (findingPhoto) {
                // Generate URL publik untuk gambar dari storage
                const { data: publicUrl } = window.supabaseClient.storage
                    .from('inspeksi_files')
                    .getPublicUrl(findingPhoto.file_path);
                
                imgHtml = `
                    <div class="mt-4">
                        <p class="text-[10px] font-black text-slate-400 uppercase mb-2">Bukti Foto</p>
                        <img src="${publicUrl.publicUrl}" class="rounded-xl border border-slate-200 max-h-64 w-full object-cover shadow-sm">
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
                        <h3 class="text-xl font-extrabold text-slate-900 mb-2">${f.what}</h3>
                        <p class="text-slate-600 text-sm leading-relaxed mb-4">${f.uraian_temuan || ''}</p>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risiko</p>
                                <p class="font-bold text-sm ${getRisikoColor(f.tingkat_risiko)}">${f.tingkat_risiko}</p>
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
                    ${imgHtml}
                </div>
            `;
            listContainer.appendChild(card);
        });

    } catch (err) {
        console.error(err);
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