let canvas, ctx, isDrawing = false;

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
            initSignaturePad(); // Inisialisasi tanda tangan
        }
    }, 100);

    document.getElementById('btnDownloadPDF').addEventListener('click', downloadPDF);
    document.getElementById('btnClearSign').addEventListener('click', clearSignature);
});

function initSignaturePad() {
    canvas = document.getElementById('signature-pad');
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    const startDrawing = (e) => {
        isDrawing = true;
        const pos = getMousePos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDrawing = () => isDrawing = false;

    // Mouse Events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    // Touch Events (Mobile)
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startDrawing(e.touches[0]);
    });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        draw(e.touches[0]);
    });
    canvas.addEventListener('touchend', stopDrawing);
}

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

function clearSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function loadDetail(id) {
    try {
        const { data: ins, error: insErr } = await window.supabaseClient
            .from('inspections').select('*').eq('id', id).single();

        if (insErr) throw insErr;

        document.getElementById('det-tanggal').innerText = new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('det-lokasi').innerText = ins.lokasi_tambang;
        document.getElementById('det-area').innerText = ins.area_kerja || '-';
        
        // Ambil nama inspektur dari auth session
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        document.getElementById('inspector-name').innerText = user.email.split('@')[0].toUpperCase();

        const { data: findings } = await window.supabaseClient.from('inspection_findings').select('*').eq('inspection_id', id);
        const { data: photos } = await window.supabaseClient.from('inspection_photos').select('*').eq('inspection_id', id);

        const list = document.getElementById('findings-list');
        list.innerHTML = '';

        findings.forEach((f, i) => {
            const photo = photos?.find(p => p.finding_id === f.id);
            let imgTag = '';

            if (photo) {
                const { data: url } = window.supabaseClient.storage.from('inspeksi_files').getPublicUrl(photo.file_path);
                const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url.publicUrl)}&w=800`;
                
                imgTag = `
                    <div class="mt-4">
                        <p class="text-[10px] font-black text-slate-400 uppercase mb-2">Bukti Foto</p>
                        <img src="${proxiedUrl}" crossOrigin="anonymous" class="rounded-xl border w-full h-64 object-cover shadow-sm">
                    </div>`;
            }

            const item = document.createElement('div');
            item.className = 'card-pro p-8 border-l-8 border-blue-600 mb-8 bg-white html2pdf__page-break';
            item.innerHTML = `
                <div class="flex flex-col md:flex-row gap-8">
                    <div class="flex-1">
                        <span class="text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase">Temuan #${i + 1}</span>
                        <h3 class="text-xl font-extrabold text-slate-900 mt-4 mb-2">${f.what}</h3>
                        <p class="text-slate-600 text-sm mb-4" style="white-space: pre-wrap;">${f.uraian_temuan || ''}</p>
                        <div class="grid grid-cols-2 gap-4 text-sm font-bold">
                            <div>
                                <p class="text-[10px] text-slate-400 uppercase">Risiko</p>
                                <p class="text-blue-600">${f.tingkat_risiko}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400 uppercase">Lokasi</p>
                                <p class="text-slate-800">${f.where_location}</p>
                            </div>
                        </div>
                        <div class="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p class="text-[10px] font-black text-slate-400 uppercase">Rekomendasi:</p>
                            <p class="text-sm text-slate-700">${f.rekomendasi || '-'}</p>
                        </div>
                    </div>
                    <div class="flex-1">${imgTag || '<div class="h-64 bg-slate-100 rounded-xl flex items-center justify-center">N/A</div>'}</div>
                </div>`;
            list.appendChild(item);
        });
    } catch (e) { console.error(e); }
}

async function downloadPDF() {
    const element = document.getElementById('printable-area');
    const btn = document.getElementById('btnDownloadPDF');
    
    // Sembunyikan elemen UI
    const backBtn = document.querySelector('a[href="dashboard.html"]');
    const statusBadge = document.getElementById('status-badge');
    const clearSign = document.getElementById('btnClearSign');
    const navbar = document.getElementById('navbar');

    [backBtn, statusBadge, btn, navbar, clearSign].forEach(el => { if(el) el.style.display = 'none'; });

    const options = {
        margin: [0.5, 0.5],
        filename: `LAPORAN_INSPEKSI_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
        await html2pdf().set(options).from(element).save();
    } finally {
        // Tampilkan kembali elemen UI
        [backBtn, statusBadge, btn, navbar, clearSign].forEach(el => { if(el) el.style.display = 'block'; });
    }
}