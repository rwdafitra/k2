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

    document.getElementById('btnDownloadPDF').addEventListener('click', downloadPDF);
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
            let imgTag = '';

            if (photo) {
                const { data: url } = window.supabaseClient.storage.from('inspeksi_files').getPublicUrl(photo.file_path);
                // Menggunakan proxy images.weserv.nl untuk stabilitas CORS pada PDF
                const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url.publicUrl)}&w=800`;
                
                imgTag = `
                    <div class="mt-4">
                        <p class="text-[10px] font-black text-slate-400 uppercase mb-2">Bukti Foto</p>
                        <img src="${proxiedUrl}" crossOrigin="anonymous" class="rounded-xl border w-full h-64 object-cover shadow-sm">
                    </div>`;
            }

            const item = document.createElement('div');
            // Tambahkan class 'html2pdf__page-break' agar tiap temuan pindah halaman jika ruang tidak cukup
            item.className = 'card-pro p-8 border-l-8 border-blue-600 mb-8 bg-white html2pdf__page-break';
            item.innerHTML = `
                <div class="flex flex-col md:flex-row gap-8">
                    <div class="flex-1">
                        <span class="text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase">Temuan #${i + 1}</span>
                        <h3 class="text-xl font-extrabold text-slate-900 mt-4 mb-2">${f.what}</h3>
                        <p class="text-slate-600 text-sm mb-4" style="white-space: pre-wrap;">${f.uraian_temuan || ''}</p>
                        <div class="grid grid-cols-2 gap-4 text-sm font-bold">
                            <div>
                                <p class="text-[10px] text-slate-400 uppercase">Tingkat Risiko</p>
                                <p class="text-blue-600">${f.tingkat_risiko}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400 uppercase">Lokasi Spesifik</p>
                                <p class="text-slate-800">${f.where_location}</p>
                            </div>
                        </div>
                        <div class="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p class="text-[10px] font-black text-slate-400 uppercase">Rekomendasi Perbaikan:</p>
                            <p class="text-sm text-slate-700">${f.rekomendasi || '-'}</p>
                        </div>
                    </div>
                    <div class="flex-1">
                        ${imgTag || '<div class="h-64 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs italic">Tidak ada foto</div>'}
                    </div>
                </div>`;
            list.appendChild(item);
        });
    } catch (e) { console.error(e); }
}

function downloadPDF() {
    const element = document.getElementById('printable-area');
    const btn = document.getElementById('btnDownloadPDF');
    
    btn.innerText = "Memproses PDF...";
    btn.disabled = true;

    // Konfigurasi PDF yang lebih optimal
    const options = {
        margin:       [0.5, 0.5],
        filename:     `Laporan-Inspeksi-${new Date().getTime()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true, 
            letterRendering: true,
            scrollY: 0
        },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
        // Memaksa pemutusan halaman otomatis pada elemen temuan
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(options).from(element).save().then(() => {
        btn.innerText = "Cetak PDF";
        btn.disabled = false;
    });
}