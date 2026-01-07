document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('id');

    if (!inspectionId) {
        window.location.href = 'dashboard.html';
        return;
    }

    const checkClient = setInterval(() => {
        if (window.supabaseClient) {
            clearInterval(checkClient);
            loadDetail(inspectionId);
        }
    }, 100);
});

async function loadDetail(id) {
    try {
        const { data: ins, error: insErr } = await window.supabaseClient
            .from('inspections').select('*').eq('id', id).single();

        if (insErr) throw insErr;

        document.getElementById('det-tanggal').innerText = new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('det-lokasi').innerText = ins.lokasi_tambang;
        document.getElementById('det-area').innerText = ins.area_kerja || '-';
        
        const { data: findings } = await window.supabaseClient.from('inspection_findings').select('*').eq('inspection_id', id);
        const { data: photos } = await window.supabaseClient.from('inspection_photos').select('*').eq('inspection_id', id);

        const list = document.getElementById('findings-list');
        list.innerHTML = '';

        findings.forEach((f, i) => {
            const photo = photos?.find(p => p.finding_id === f.id);
            let imgTag = '<div class="mt-4 p-4 bg-slate-100 rounded-lg text-xs text-slate-400 italic text-center">Tidak ada lampiran foto</div>';

            if (photo) {
                const { data: url } = window.supabaseClient.storage.from('inspeksi_files').getPublicUrl(photo.file_path);
                imgTag = `
                    <div class="mt-4">
                        <p class="text-[10px] font-black text-slate-400 uppercase mb-2">Bukti Foto</p>
                        <img src="${url.publicUrl}" class="rounded-xl border w-full max-h-80 object-cover shadow-sm">
                    </div>`;
            }

            const item = document.createElement('div');
            item.className = 'card-pro p-8 border-l-8 border-blue-600 mb-6';
            item.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <span class="text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase">Temuan #${i + 1}</span>
                        <h3 class="text-xl font-extrabold text-slate-900 mt-4 mb-2">${f.what}</h3>
                        <p class="text-slate-600 text-sm mb-4">${f.uraian_temuan || ''}</p>
                        <div class="grid grid-cols-2 gap-4 text-sm font-bold">
                            <p class="text-blue-600 uppercase text-[10px]">Risiko: ${f.tingkat_risiko}</p>
                            <p class="text-slate-500 uppercase text-[10px]">Lokasi: ${f.where_location}</p>
                        </div>
                        <div class="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p class="text-[10px] font-black text-slate-400 uppercase">Rekomendasi:</p>
                            <p class="text-sm text-slate-700">${f.rekomendasi || '-'}</p>
                        </div>
                    </div>
                    ${imgTag}
                </div>`;
            list.appendChild(item);
        });
    } catch (e) { alert(e.message); }
}