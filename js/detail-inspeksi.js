let canvas, ctx, isDrawing = false;
let activeFindingId = null;

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
            initSignaturePad();
        }
    }, 100);

    document.getElementById('btnDownloadPDF').addEventListener('click', downloadPDF);
    document.getElementById('btnClearSign').addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    document.getElementById('btnSimpanCloseOut').addEventListener('click', processCloseOut);
});

function initSignaturePad() {
    canvas = document.getElementById('signature-pad');
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const start = (e) => { isDrawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if(!isDrawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const stop = () => isDrawing = false;

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); });
    canvas.addEventListener('touchend', stop);
}

async function loadDetail(id) {
    try {
        const { data: ins, error: insErr } = await window.supabaseClient
            .from('inspections').select('*').eq('id', id).single();
        if (insErr) throw insErr;

        // Setup Header & Tanda Tangan
        document.getElementById('det-tanggal').innerText = new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('det-lokasi').innerText = ins.lokasi_tambang;
        document.getElementById('det-area').innerText = ins.area_kerja || '-';
        
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        document.getElementById('inspector-name').innerText = user.email.split('@')[0].toUpperCase();

        // Setup Komentar Section
        setupComments(ins);

        // Render Findings
        const { data: findings } = await window.supabaseClient.from('inspection_findings').select('*').eq('inspection_id', id);
        const { data: photos } = await window.supabaseClient.from('inspection_photos').select('*').eq('inspection_id', id);

        const list = document.getElementById('findings-list');
        list.innerHTML = '';

        findings.forEach((f, i) => {
            const photo = photos?.find(p => p.finding_id === f.id);
            let imgHtml = '';

            if (photo) {
                const { data: url } = window.supabaseClient.storage.from('inspeksi_files').getPublicUrl(photo.file_path);
                const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url.publicUrl)}&w=800`;
                imgHtml = `<img src="${proxiedUrl}" crossOrigin="anonymous" class="rounded-xl border w-full h-64 object-cover shadow-sm">`;
            }

            // Bukti Perbaikan Section
            let perbaikanHtml = '';
            if (f.status === 'CLOSED' && f.bukti_perbaikan_path) {
                const { data: pbUrl } = window.supabaseClient.storage.from('inspeksi_files').getPublicUrl(f.bukti_perbaikan_path);
                perbaikanHtml = `
                    <div class="mt-6 p-4 bg-green-50 rounded-xl border border-green-200">
                        <p class="text-[10px] font-black text-green-600 uppercase mb-2 tracking-widest">Bukti Perbaikan (Closed Out)</p>
                        <div class="flex flex-col md:flex-row gap-4">
                            <img src="https://images.weserv.nl/?url=${encodeURIComponent(pbUrl.publicUrl)}&w=400" crossOrigin="anonymous" class="w-full md:w-32 h-32 object-cover rounded-lg">
                            <p class="text-xs text-slate-700 italic">"${f.keterangan_perbaikan}"</p>
                        </div>
                    </div>`;
            } else if (window.userRole === 'INSPECTOR') {
                perbaikanHtml = `<button onclick="openCloseOut('${f.id}')" class="no-print mt-4 w-full py-2 bg-green-600 text-white text-xs font-bold rounded-lg uppercase">Tindak Lanjut / Close Out</button>`;
            }

            const item = document.createElement('div');
            item.className = 'card-pro p-8 border-l-8 border-blue-600 mb-8 bg-white html2pdf__page-break';
            item.innerHTML = `
                <div class="flex flex-col md:flex-row gap-8">
                    <div class="flex-1">
                        <span class="text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">TEMUAN #${i + 1}</span>
                        <h3 class="text-xl font-extrabold text-slate-900 mt-4 mb-2">${f.what}</h3>
                        <p class="text-slate-600 text-sm mb-4">${f.uraian_temuan || ''}</p>
                        <div class="grid grid-cols-2 gap-4 text-sm font-bold uppercase text-[10px]">
                            <p class="text-blue-600">Risiko: ${f.tingkat_risiko}</p>
                            <p class="text-slate-500">Lokasi: ${f.where_location}</p>
                        </div>
                        <div class="mt-4 p-3 bg-slate-50 rounded-lg border">
                            <p class="text-[10px] font-black text-slate-400 uppercase">Rekomendasi:</p>
                            <p class="text-sm text-slate-700">${f.rekomendasi || '-'}</p>
                        </div>
                        ${perbaikanHtml}
                    </div>
                    <div class="flex-1">${imgHtml || '<div class="h-64 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs italic">Tidak ada foto bukti</div>'}</div>
                </div>`;
            list.appendChild(item);
        });
    } catch (e) { console.error(e); }
}

function setupComments(ins) {
    const role = window.userRole;
    document.getElementById('display-she').innerText = ins.komentar_she || "Belum ada komentar.";
    document.getElementById('display-amn').innerText = ins.komentar_amn || "Belum ada komentar.";
    document.getElementById('display-ktt').innerText = ins.komentar_ktt || "Belum ada komentar.";

    if (role === 'SHE') document.getElementById('input-she').classList.remove('hidden');
    if (role === 'AMN') document.getElementById('input-amn').classList.remove('hidden');
    if (role === 'KTT') document.getElementById('input-ktt').classList.remove('hidden');
}

async function saveComment(type) {
    const text = document.getElementById(`text-${type}`).value;
    const id = new URLSearchParams(window.location.search).get('id');
    const update = {}; update[`komentar_${type}`] = text;

    const { error } = await window.supabaseClient.from('inspections').update(update).eq('id', id);
    if (error) alert(error.message); else location.reload();
}

function openCloseOut(findingId) {
    activeFindingId = findingId;
    document.getElementById('modal-closeout').classList.remove('hidden');
}

function toggleModalClose(show) {
    document.getElementById('modal-closeout').classList.toggle('hidden', !show);
}

async function processCloseOut() {
    const file = document.getElementById('file-perbaikan').files[0];
    const ket = document.getElementById('ket-perbaikan').value;
    if (!file || !ket) return alert("Lengkapi foto bukti dan keterangan!");

    const btn = document.getElementById('btnSimpanCloseOut');
    btn.disabled = true; btn.innerText = "SEDANG MEMPROSES...";

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        const path = `perbaikan/${user.id}/${Date.now()}-${file.name}`;
        
        const { error: upErr } = await window.supabaseClient.storage.from('inspeksi_files').upload(path, file);
        if (upErr) throw upErr;

        const { error: dbErr } = await window.supabaseClient.from('inspection_findings').update({
            status: 'CLOSED',
            bukti_perbaikan_path: path,
            keterangan_perbaikan: ket,
            tanggal_perbaikan: new Date()
        }).eq('id', activeFindingId);

        if (dbErr) throw dbErr;
        alert("Temuan berhasil ditutup (Closed Out)!");
        location.reload();
    } catch (e) { alert(e.message); btn.disabled = false; btn.innerText = "Simpan Perbaikan"; }
}

async function downloadPDF() {
    const element = document.getElementById('printable-area');
    const btn = document.getElementById('btnDownloadPDF');
    const toHide = [document.querySelector('a[href="dashboard.html"]'), document.getElementById('status-badge'), btn, document.getElementById('navbar'), document.getElementById('btnClearSign'), document.querySelectorAll('.no-print')];

    toHide.flat().forEach(el => { if(el) el.style.display = 'none'; });

    const options = {
        margin: [0.5, 0.5],
        filename: `LAPORAN_INSPEKSI_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try { await html2pdf().set(options).from(element).save(); } 
    finally { toHide.flat().forEach(el => { if(el) el.style.display = ''; }); }
}