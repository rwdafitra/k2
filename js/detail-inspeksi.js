let canvas, ctx, isDrawing = false;
let activeFindingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('id');
    if (!inspectionId) return window.location.href = 'dashboard.html';

    // Beri sedikit jeda untuk memastikan supabaseClient di app.js sudah ready
    const checkClient = setInterval(() => {
        if (window.supabaseClient) {
            clearInterval(checkClient);
            loadDetail(inspectionId);
            initSignaturePad();
        }
    }, 100);

    document.getElementById('btnDownloadPDF').onclick = downloadPDF;
    document.getElementById('btnClearSign').onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('btnSubmitComment').onclick = postManagementComment;
    document.getElementById('btnSimpanCloseOut').onclick = processCloseOut;
});

function initSignaturePad() {
    canvas = document.getElementById('signature-pad');
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        return { 
            x: (clientX - rect.left) * (canvas.width / rect.width), 
            y: (clientY - rect.top) * (canvas.height / rect.height) 
        };
    };

    const start = (e) => { isDrawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if(!isDrawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', () => isDrawing = false);

    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); });
}

async function loadDetail(id) {
    try {
        const { data: ins, error } = await window.supabaseClient.from('inspections').select('*').eq('id', id).single();
        if (error) throw error;

        document.getElementById('report-id').innerText = ins.id.substring(0,8);
        document.getElementById('det-tanggal').innerText = new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric'});
        document.getElementById('det-lokasi').innerText = ins.lokasi_tambang;
        document.getElementById('det-area').innerText = ins.area_kerja || '-';

        const { data: { user } } = await window.supabaseClient.auth.getUser();
        document.getElementById('inspector-name').innerText = user.email.split('@')[0].toUpperCase();

        // Tampilkan Form Komentar jika role sesuai
        const myRole = window.userRole;
        if (['KTT', 'AMN', 'SHE'].includes(myRole)) {
            document.getElementById('admin-comment-form').classList.remove('hidden');
            document.getElementById('label-role').innerText = myRole;
        }

        // Load Findings & Photos
        const { data: findings } = await window.supabaseClient.from('inspection_findings').select('*').eq('inspection_id', id);
        const { data: photos } = await window.supabaseClient.from('inspection_photos').select('*').eq('inspection_id', id);

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
        const proxiedUrl = url ? `https://images.weserv.nl/?url=${encodeURIComponent(url.publicUrl)}&w=800` : '';

        // Tombol Close-Out / Info Perbaikan
        let perbaikanSection = '';
        if (f.status === 'CLOSED') {
            const { data: pbUrl } = window.supabaseClient.storage.from('inspeksi_files').getPublicUrl(f.bukti_perbaikan_path);
            perbaikanSection = `
                <div class="mt-6 p-5 bg-green-50 rounded-2xl border border-green-100 flex flex-col md:flex-row gap-4">
                    <img src="https://images.weserv.nl/?url=${encodeURIComponent(pbUrl.publicUrl)}&w=300" class="w-24 h-24 object-cover rounded-xl border-2 border-white shadow-sm">
                    <div>
                        <p class="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Status: Perbaikan Selesai</p>
                        <p class="text-sm text-slate-700 font-medium">"${f.keterangan_perbaikan}"</p>
                    </div>
                </div>`;
        } else if (window.userRole === 'INSPECTOR') {
            perbaikanSection = `
                <button onclick="openCloseOut('${f.id}')" class="no-print mt-6 w-full py-3 bg-slate-900 text-white text-xs font-bold rounded-xl uppercase tracking-widest shadow-lg hover:bg-black transition">
                    Tindak Lanjut / Close Out
                </button>`;
        }

        list.innerHTML += `
            <div class="card-report p-8 md:p-10 flex flex-col md:flex-row gap-10">
                <div class="flex-1">
                    <span class="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-tighter">Temuan #${i+1}</span>
                    <h3 class="text-2xl font-black text-slate-800 mt-4 mb-3">${f.what}</h3>
                    <p class="text-slate-500 text-sm leading-relaxed mb-6">${f.uraian_temuan || ''}</p>
                    
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="p-3 bg-slate-50 rounded-xl">
                            <p class="text-[9px] font-black text-slate-400 uppercase">Tingkat Risiko</p>
                            <p class="font-bold text-slate-700">${f.tingkat_risiko}</p>
                        </div>
                        <div class="p-3 bg-slate-50 rounded-xl">
                            <p class="text-[9px] font-black text-slate-400 uppercase">Lokasi Spesifik</p>
                            <p class="font-bold text-slate-700">${f.where_location}</p>
                        </div>
                    </div>

                    <div class="border-t pt-4">
                        <p class="text-[9px] font-black text-slate-400 uppercase mb-1">Rekomendasi Perbaikan:</p>
                        <p class="text-sm text-slate-600 italic font-medium">${f.rekomendasi || '-'}</p>
                    </div>

                    ${perbaikanSection}
                </div>
                <div class="w-full md:w-80 h-64 md:h-auto bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-slate-200">
                    ${proxiedUrl ? `<img src="${proxiedUrl}" crossOrigin="anonymous" class="w-full h-full object-cover">` : '<div class="h-full flex items-center justify-center text-slate-400 text-xs uppercase font-bold">No Image</div>'}
                </div>
            </div>`;
    });
}

async function loadComments(id) {
    const thread = document.getElementById('comments-thread');
    const { data } = await window.supabaseClient.from('inspection_comments').select('*').eq('inspection_id', id).order('created_at', { ascending: true });
    
    if (data?.length > 0) {
        thread.innerHTML = '';
        data.forEach(c => {
            const roleStyles = {
                KTT: 'bg-red-50 text-red-700 border-red-100',
                AMN: 'bg-green-50 text-green-700 border-green-100',
                SHE: 'bg-blue-50 text-blue-700 border-blue-100'
            };
            const style = roleStyles[c.user_role] || 'bg-slate-50 text-slate-700 border-slate-100';
            
            thread.innerHTML += `
                <div class="${style} p-5 rounded-2xl border-2 shadow-sm">
                    <div class="flex justify-between items-center mb-2">
                        <p class="text-[10px] font-black uppercase tracking-widest">${c.user_role} — ${c.user_name}</p>
                        <p class="text-[9px] opacity-60 font-bold">${new Date(c.created_at).toLocaleString('id-ID')}</p>
                    </div>
                    <p class="text-sm font-semibold leading-relaxed">${c.comment_text}</p>
                </div>`;
        });
    }
}

async function postManagementComment() {
    const txt = document.getElementById('input-comment-text').value;
    const id = new URLSearchParams(window.location.search).get('id');
    if (!txt.trim()) return alert("Tulis komentar dulu!");

    const { data: { user } } = await window.supabaseClient.auth.getUser();
    const { error } = await window.supabaseClient.from('inspection_comments').insert({
        inspection_id: id, user_id: user.id, user_role: window.userRole,
        user_name: user.email.split('@')[0].toUpperCase(), comment_text: txt
    });

    if (error) alert(error.message); else location.reload();
}

function openCloseOut(id) { activeFindingId = id; document.getElementById('modal-closeout').classList.remove('hidden'); }
function toggleModalClose(s) { document.getElementById('modal-closeout').classList.toggle('hidden', !s); }

async function processCloseOut() {
    const file = document.getElementById('file-perbaikan').files[0];
    const ket = document.getElementById('ket-perbaikan').value;
    if (!file || !ket) return alert("Lengkapi bukti foto dan keterangan!");

    const btn = document.getElementById('btnSimpanCloseOut');
    btn.disabled = true; btn.innerText = "PROSES...";

    try {
        const path = `perbaikan/${Date.now()}-${file.name}`;
        await window.supabaseClient.storage.from('inspeksi_files').upload(path, file);
        await window.supabaseClient.from('inspection_findings').update({ 
            status: 'CLOSED', bukti_perbaikan_path: path, keterangan_perbaikan: ket, tanggal_perbaikan: new Date() 
        }).eq('id', activeFindingId);
        
        location.reload();
    } catch (e) { alert(e.message); btn.disabled = false; btn.innerText = "Simpan Perbaikan"; }
}

async function downloadPDF() {
    const el = document.getElementById('printable-area');
    const btn = document.getElementById('btnDownloadPDF');
    btn.innerText = "Mohon Tunggu...";
    
    const options = {
        margin: [0.3, 0.3],
        filename: `LAPORAN_INSPEKSI_${document.getElementById('report-id').innerText}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(options).from(el).save().then(() => {
        btn.innerText = "Cetak PDF";
    });
}