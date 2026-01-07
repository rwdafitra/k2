let canvas, ctx, isDrawing = false;
let activeFindingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('id');
    if (!inspectionId) return window.location.href = 'dashboard.html';

    const checkClient = setInterval(() => {
        if (window.supabaseClient) {
            clearInterval(checkClient);
            loadDetail(inspectionId);
            initSignaturePad();
        }
    }, 100);

    document.getElementById('btnDownloadPDF').onclick = downloadPDF;
    document.getElementById('btnClearSign').onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('btnSubmitComment').onclick = postComment;
    document.getElementById('btnSimpanCloseOut').onclick = processCloseOut;
});

function initSignaturePad() {
    canvas = document.getElementById('signature-pad');
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
    };
    canvas.addEventListener('mousedown', (e) => { isDrawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); });
    canvas.addEventListener('mousemove', (e) => { if(!isDrawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
    window.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isDrawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if(!isDrawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
    canvas.addEventListener('touchend', () => isDrawing = false);
}

async function loadDetail(id) {
    try {
        const { data: ins } = await window.supabaseClient.from('inspections').select('*').eq('id', id).single();
        const { data: findings } = await window.supabaseClient.from('inspection_findings').select('*').eq('inspection_id', id);
        const { data: photos } = await window.supabaseClient.from('inspection_photos').select('*').eq('inspection_id', id);

        document.getElementById('det-tanggal').innerText = new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID');
        document.getElementById('det-lokasi').innerText = ins.lokasi_tambang;
        document.getElementById('det-area').innerText = ins.area_kerja || '-';

        const { data: { user } } = await window.supabaseClient.auth.getUser();
        document.getElementById('inspector-name').innerText = user.email.split('@')[0].toUpperCase();

        // Admin UI
        if (['KTT', 'AMN', 'SHE'].includes(window.userRole)) {
            document.getElementById('admin-comment-form').classList.remove('hidden');
            document.getElementById('label-role').innerText = window.userRole;
        }

        renderFindings(findings, photos);
        loadComments(id);
    } catch (e) { console.error(e); }
}

function renderFindings(findings, photos) {
    const list = document.getElementById('findings-list');
    list.innerHTML = '';
    findings.forEach((f, i) => {
        const photo = photos?.find(p => p.finding_id === f.id);
        const { data: url } = photo ? window.supabaseClient.storage.from('inspeksi_files').getPublicUrl(photo.file_path) : { data: null };
        const proxied = url ? `https://images.weserv.nl/?url=${encodeURIComponent(url.publicUrl)}&w=600` : '';

        let actionHtml = (f.status === 'OPEN' && window.userRole === 'INSPECTOR') 
            ? `<button onclick="openCloseOut('${f.id}')" class="no-print mt-4 w-full py-2 bg-green-600 text-white rounded text-[10px] font-bold">CLOSE TEMUAN</button>` : '';
        
        if (f.status === 'CLOSED') {
            const { data: pbUrl } = window.supabaseClient.storage.from('inspeksi_files').getPublicUrl(f.bukti_perbaikan_path);
            actionHtml = `<div class="mt-4 p-3 bg-green-50 rounded border border-green-200">
                <p class="text-[9px] font-bold text-green-600 uppercase">Perbaikan Selesai:</p>
                <img src="https://images.weserv.nl/?url=${encodeURIComponent(pbUrl.publicUrl)}&w=200" class="w-20 h-20 object-cover mt-1 rounded">
                <p class="text-[10px] italic mt-1">${f.keterangan_perbaikan}</p>
            </div>`;
        }

        list.innerHTML += `
            <div class="p-6 border-l-4 border-blue-500 bg-white shadow-sm flex flex-col md:flex-row gap-6 html2pdf__page-break">
                <div class="flex-1">
                    <span class="text-[9px] font-bold text-blue-500 uppercase">Temuan #${i+1}</span>
                    <h3 class="font-bold text-lg mb-2">${f.what}</h3>
                    <p class="text-xs text-slate-500 mb-4">${f.uraian_temuan || ''}</p>
                    <p class="text-[9px] font-bold">RISIKO: ${f.tingkat_risiko} | LOKASI: ${f.where_location}</p>
                    ${actionHtml}
                </div>
                <div class="w-full md:w-64 h-48 bg-slate-100 rounded overflow-hidden">
                    ${proxied ? `<img src="${proxied}" crossOrigin="anonymous" class="w-full h-full object-cover">` : ''}
                </div>
            </div>`;
    });
}

async function loadComments(id) {
    const thread = document.getElementById('comments-thread');
    const { data } = await window.supabaseClient.from('inspection_comments').select('*').eq('inspection_id', id).order('created_at', { ascending: true });
    if (data?.length > 0) thread.innerHTML = '';
    data?.forEach(c => {
        const colors = { KTT: 'bg-red-50 text-red-700', AMN: 'bg-green-50 text-green-700', SHE: 'bg-blue-50 text-blue-700' };
        thread.innerHTML += `<div class="${colors[c.user_role] || 'bg-slate-50'} p-3 rounded-xl border border-white">
            <p class="text-[9px] font-black uppercase mb-1">${c.user_role} - ${c.user_name}</p>
            <p class="text-xs font-medium">${c.comment_text}</p>
        </div>`;
    });
}

async function postComment() {
    const txt = document.getElementById('input-comment-text').value;
    const id = new URLSearchParams(window.location.search).get('id');
    if (!txt.trim()) return;
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    await window.supabaseClient.from('inspection_comments').insert({
        inspection_id: id, user_id: user.id, user_role: window.userRole,
        user_name: user.email.split('@')[0].toUpperCase(), comment_text: txt
    });
    location.reload();
}

function openCloseOut(id) { activeFindingId = id; document.getElementById('modal-closeout').classList.remove('hidden'); }
function toggleModalClose(s) { document.getElementById('modal-closeout').classList.toggle('hidden', !s); }

async function processCloseOut() {
    const f = document.getElementById('file-perbaikan').files[0];
    const k = document.getElementById('ket-perbaikan').value;
    if (!f || !k) return alert("Lengkapi data!");
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    const path = `perbaikan/${Date.now()}-${f.name}`;
    await window.supabaseClient.storage.from('inspeksi_files').upload(path, f);
    await window.supabaseClient.from('inspection_findings').update({ status: 'CLOSED', bukti_perbaikan_path: path, keterangan_perbaikan: k, tanggal_perbaikan: new Date() }).eq('id', activeFindingId);
    location.reload();
}

async function downloadPDF() {
    const el = document.getElementById('printable-area');
    const toHide = document.querySelectorAll('.no-print');
    toHide.forEach(h => h.style.display = 'none');
    await html2pdf().set({ margin: 0.5, filename: 'Laporan.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { format: 'a4' } }).from(el).save();
    toHide.forEach(h => h.style.display = '');
}