let canvas, ctx, isDrawing = false;
let activeFindingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('id');
    if (!inspectionId) return window.location.href = 'dashboard.html';

    // Loop pengecekan hingga Supabase Client siap (dari app.js)
    const checkClient = setInterval(() => {
        if (window.supabaseClient) {
            clearInterval(checkClient);
            initApp(inspectionId);
        }
    }, 100);

    // Event Listeners
    document.getElementById('btnDownloadPDF').onclick = downloadPDF;
    document.getElementById('btnClearSign').onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('btnSubmitComment').onclick = postManagementComment;
    document.getElementById('btnSimpanCloseOut').onclick = processCloseOut;
});

async function initApp(id) {
    await loadDetail(id);
    initSignaturePad();
}

function initSignaturePad() {
    canvas = document.getElementById('signature-pad');
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 3; ctx.lineCap = 'round';

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

        // Populate Header Data
        document.getElementById('report-id').innerText = ins.id.substring(0,8).toUpperCase();
        document.getElementById('det-tanggal').innerText = new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric'});
        document.getElementById('det-lokasi').innerText = ins.lokasi_tambang;
        document.getElementById('det-area').innerText = ins.area_kerja || '-';

        // Set Inspector Name
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        document.getElementById('inspector-name').innerText = user.email.split('@')[0].toUpperCase();

        // LOGIKA ROLE: Penting! Pastikan window.userRole sudah ada dari app.js
        setTimeout(() => {
            const myRole = window.userRole;
            console.log("Current User Role:", myRole); // Debugging
            if (['KTT', 'AMN', 'SHE'].includes(myRole)) {
                document.getElementById('admin-comment-form').classList.remove('hidden');
                document.getElementById('label-role').innerText = myRole;
            }
        }, 500);

        // Load Findings & Comments
        const { data: findings } = await window.supabaseClient.from('inspection_findings').select('*').eq('inspection_id', id);
        const { data: photos } = await window.supabaseClient.from('inspection_photos').select('*').eq('inspection_id', id);

        renderFindings(findings, photos);
        loadComments(id);

    } catch (e) { console.error("Error loading detail:", e); }
}

function renderFindings(findings, photos) {
    const list = document.getElementById('findings-list');
    list.innerHTML = '';

    findings.forEach((f, i) => {
        const photo = photos?.find(p => p.finding_id === f.id);
        const { data: url } = photo ? window.supabaseClient.storage.from('inspeksi_files').getPublicUrl(photo.file_path) : { data: null };
        const proxiedUrl = url ? `https://images.weserv.nl/?url=${encodeURIComponent(url.publicUrl)}&w=800` : '';

        let perbaikanSection = '';
        if (f.status === 'CLOSED') {
            const { data: pbUrl } = window.supabaseClient.storage.from('inspeksi_files').getPublicUrl(f.bukti_perbaikan_path);
            perbaikanSection = `
                <div class="mt-8 p-6 bg-green-50 rounded-[2rem] border border-green-100 flex flex-col md:flex-row gap-6">
                    <img src="https://images.weserv.nl/?url=${encodeURIComponent(pbUrl.publicUrl)}&w=300" class="w-28 h-28 object-cover rounded-2xl shadow-sm border-2 border-white">
                    <div>
                        <div class="flex items-center gap-2 mb-2">
                             <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                             <p class="text-[10px] font-black text-green-600 uppercase tracking-[0.2em]">Closed Out (Verified)</p>
                        </div>
                        <p class="text-sm text-slate-700 font-semibold leading-relaxed">"${f.keterangan_perbaikan}"</p>
                        <p class="text-[9px] text-slate-400 mt-2">Selesai pada: ${new Date(f.tanggal_perbaikan).toLocaleDateString('id-ID')}</p>
                    </div>
                </div>`;
        } else if (window.userRole === 'INSPECTOR') {
            perbaikanSection = `
                <button onclick="openCloseOut('${f.id}')" class="no-print mt-8 w-full py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all transform hover:-translate-y-1">
                    Ajukan Close Out
                </button>`;
        }

        list.innerHTML += `
            <div class="report-card p-8 md:p-10 flex flex-col md:flex-row gap-10 html2pdf__page-break">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full uppercase tracking-widest italic">Finding #${i+1}</span>
                        <span class="text-[10px] font-black ${f.tingkat_risiko === 'HIGH' ? 'text-red-500' : 'text-amber-500'} uppercase tracking-widest">${f.tingkat_risiko} Risk</span>
                    </div>
                    <h3 class="text-2xl font-extrabold text-slate-800 leading-tight mb-4">${f.what}</h3>
                    <p class="text-slate-500 text-sm leading-relaxed mb-8">${f.uraian_temuan || 'Tidak ada deskripsi tambahan.'}</p>
                    
                    <div class="grid grid-cols-2 gap-4 mb-8">
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Lokasi Kerja</p>
                            <p class="font-bold text-slate-700 text-xs uppercase">${f.where_location}</p>
                        </div>
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Temuan</p>
                            <p class="font-bold ${f.status === 'CLOSED' ? 'text-green-600' : 'text-red-500'} text-xs uppercase">${f.status}</p>
                        </div>
                    </div>

                    <div class="border-t border-slate-100 pt-6">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Rekomendasi Tindakan</p>
                        <p class="text-sm text-slate-600 italic font-medium bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                            ${f.rekomendasi || 'Harap segera dilakukan tindakan perbaikan.'}
                        </p>
                    </div>

                    ${perbaikanSection}
                </div>
                <div class="w-full md:w-80 h-72 md:h-auto bg-slate-50 rounded-[2rem] overflow-hidden shadow-inner border border-slate-100">
                    ${proxiedUrl ? `<img src="${proxiedUrl}" crossOrigin="anonymous" class="w-full h-full object-cover">` : '<div class="h-full flex items-center justify-center text-slate-300 text-[10px] font-black uppercase">No Documented Image</div>'}
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
                KTT: 'bg-red-50 text-red-900 border-red-100',
                AMN: 'bg-green-50 text-green-900 border-green-100',
                SHE: 'bg-blue-50 text-blue-900 border-blue-100'
            };
            const style = roleStyles[c.user_role] || 'bg-slate-50 text-slate-800 border-slate-100';
            
            thread.innerHTML += `
                <div class="${style} p-6 rounded-[1.5rem] border shadow-sm relative overflow-hidden">
                    <div class="flex justify-between items-center mb-3">
                        <p class="text-[9px] font-black uppercase tracking-widest opacity-70">${c.user_role} — ${c.user_name}</p>
                        <p class="text-[9px] opacity-50 font-bold">${new Date(c.created_at).toLocaleString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                    </div>
                    <p class="text-sm font-bold leading-relaxed">${c.comment_text}</p>
                </div>`;
        });
    }
}

async function postManagementComment() {
    const txt = document.getElementById('input-comment-text').value;
    const id = new URLSearchParams(window.location.search).get('id');
    if (!txt.trim()) return alert("Tulis komentar terlebih dahulu!");

    const btn = document.getElementById('btnSubmitComment');
    btn.disabled = true; btn.innerText = "MENGIRIM...";

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        const { error } = await window.supabaseClient.from('inspection_comments').insert({
            inspection_id: id, user_id: user.id, user_role: window.userRole,
            user_name: user.email.split('@')[0].toUpperCase(), comment_text: txt
        });

        if (error) throw error;
        location.reload();
    } catch (e) { alert(e.message); btn.disabled = false; btn.innerText = "Kirim Komentar"; }
}

function openCloseOut(id) { activeFindingId = id; document.getElementById('modal-closeout').classList.remove('hidden'); }
function toggleModalClose(s) { document.getElementById('modal-closeout').classList.toggle('hidden', !s); }

async function processCloseOut() {
    const file = document.getElementById('file-perbaikan').files[0];
    const ket = document.getElementById('ket-perbaikan').value;
    if (!file || !ket) return alert("Lengkapi bukti foto dan keterangan tindakan!");

    const btn = document.getElementById('btnSimpanCloseOut');
    btn.disabled = true; btn.innerText = "UPLOADING...";

    try {
        const path = `perbaikan/${Date.now()}-${file.name}`;
        await window.supabaseClient.storage.from('inspeksi_files').upload(path, file);
        await window.supabaseClient.from('inspection_findings').update({ 
            status: 'CLOSED', bukti_perbaikan_path: path, keterangan_perbaikan: ket, tanggal_perbaikan: new Date() 
        }).eq('id', activeFindingId);
        
        location.reload();
    } catch (e) { alert(e.message); btn.disabled = false; btn.innerText = "Submit Perbaikan"; }
}

async function downloadPDF() {
    const el = document.getElementById('printable-area');
    const btn = document.getElementById('btnDownloadPDF');
    const oldTxt = btn.innerText;
    btn.innerText = "MENYIAPKAN PDF...";
    
    const options = {
        margin: [0.3, 0.3],
        filename: `INSPEKSI_REPORT_${document.getElementById('report-id').innerText}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true, letterRendering: true, scrollY: 0 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(options).from(el).save().then(() => {
        btn.innerText = oldTxt;
    });
}