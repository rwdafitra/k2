let canvas, ctx, isDrawing = false;
let activeFindingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('id');
    if (!inspectionId) return window.location.href = 'dashboard.html';

    // Inisialisasi Aplikasi
    const checkClient = setInterval(() => {
        if (window.supabaseClient) {
            clearInterval(checkClient);
            initApp(inspectionId);
        }
    }, 100);

    // Event Listeners Utama
    document.getElementById('btnDownloadPDF').onclick = downloadPDF;
    document.getElementById('btnClearSign').onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('btnSubmitComment').onclick = postManagementComment;
    document.getElementById('btnSimpanCloseOut').onclick = processCloseOut;
});

async function initApp(id) {
    // 1. Ambil data User & Profile Terlebih dahulu (Memastikan Role Terdeteksi)
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (user) {
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        
        // Simpan role secara lokal agar sinkron
        window.userRole = profile?.role || 'INSPECTOR';
    }

    await loadDetail(id);
    initSignaturePad();
}

async function loadDetail(id) {
    try {
        const { data: ins, error } = await window.supabaseClient.from('inspections').select('*').eq('id', id).single();
        if (error) throw error;

        // Populate Data Header
        document.getElementById('report-id').innerText = ins.id.substring(0,8).toUpperCase();
        document.getElementById('det-tanggal').innerText = new Date(ins.tanggal_inspeksi).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric'});
        document.getElementById('det-lokasi').innerText = ins.lokasi_tambang;
        document.getElementById('det-area').innerText = ins.area_kerja || '-';

        // Tampilkan Nama Inspektur
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        document.getElementById('inspector-name').innerText = user.email.split('@')[0].toUpperCase();

        // LOGIKA ROLE UNTUK KOMENTAR
        const myRole = window.userRole;
        console.log("Menjalankan UI untuk role:", myRole);
        
        // Memunculkan Form Komentar hanya untuk Manajemen (KTT, AMN, SHE)
        const managementRoles = ['KTT', 'AMN', 'SHE'];
        if (managementRoles.includes(myRole)) {
            const commentForm = document.getElementById('admin-comment-form');
            if(commentForm) {
                commentForm.classList.remove('hidden');
                document.getElementById('label-role').innerText = myRole;
            }
        }

        // Load Temuan & Komentar yang sudah ada
        const [findingsRes, photosRes, commentsRes] = await Promise.all([
            window.supabaseClient.from('inspection_findings').select('*').eq('inspection_id', id),
            window.supabaseClient.from('inspection_photos').select('*').eq('inspection_id', id),
            window.supabaseClient.from('inspection_comments').select('*').eq('inspection_id', id).order('created_at', { ascending: true })
        ]);

        renderFindings(findingsRes.data || [], photosRes.data || []);
        renderComments(commentsRes.data || []);

    } catch (e) { console.error("Detail Load Error:", e); }
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
                <div class="mt-8 p-6 bg-green-50 rounded-3xl border border-green-100 flex gap-6 items-start">
                    <img src="https://images.weserv.nl/?url=${encodeURIComponent(pbUrl.publicUrl)}&w=300" class="w-24 h-24 object-cover rounded-2xl shadow-sm border-2 border-white">
                    <div>
                        <p class="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1 italic">Verified Completion</p>
                        <p class="text-sm text-slate-700 font-bold leading-relaxed mb-1">"${f.keterangan_perbaikan}"</p>
                        <p class="text-[9px] text-slate-400 font-medium">${new Date(f.tanggal_perbaikan).toLocaleString('id-ID')}</p>
                    </div>
                </div>`;
        } else if (window.userRole === 'INSPECTOR') {
            perbaikanSection = `
                <button onclick="openCloseOut('${f.id}')" class="no-print mt-6 w-full py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest shadow-lg hover:bg-black transition-all">
                    Lakukan Close Out (Submit Perbaikan)
                </button>`;
        }

        list.innerHTML += `
            <div class="report-card p-10 flex flex-col md:flex-row gap-10 html2pdf__page-break">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-6">
                        <span class="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full uppercase italic">Finding #${i+1}</span>
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${f.status}</span>
                    </div>
                    <h3 class="text-2xl font-black text-slate-800 leading-tight mb-4">${f.what}</h3>
                    <p class="text-slate-500 text-sm leading-relaxed mb-8">${f.uraian_temuan || ''}</p>
                    
                    <div class="grid grid-cols-2 gap-4 mb-8">
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Risk Level</p>
                            <p class="font-bold text-slate-800 text-xs">${f.tingkat_risiko}</p>
                        </div>
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Work Location</p>
                            <p class="font-bold text-slate-800 text-xs">${f.where_location}</p>
                        </div>
                    </div>

                    <div class="bg-slate-50 p-5 rounded-2xl border border-dashed border-slate-200">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Corrective Recommendation</p>
                        <p class="text-sm text-slate-600 font-medium">${f.rekomendasi || '-'}</p>
                    </div>

                    ${perbaikanSection}
                </div>
                <div class="w-full md:w-80 bg-slate-50 rounded-3xl overflow-hidden border border-slate-200">
                    ${proxiedUrl ? `<img src="${proxiedUrl}" crossOrigin="anonymous" class="w-full h-full object-cover">` : '<div class="h-64 flex items-center justify-center text-slate-300 font-bold uppercase text-[10px]">No Photo</div>'}
                </div>
            </div>`;
    });
}

function renderComments(comments) {
    const thread = document.getElementById('comments-thread');
    if (comments.length > 0) {
        thread.innerHTML = '';
        comments.forEach(c => {
            const styles = {
                KTT: 'bg-red-50 text-red-900 border-red-100',
                AMN: 'bg-green-50 text-green-900 border-green-100',
                SHE: 'bg-blue-50 text-blue-900 border-blue-100'
            };
            const style = styles[c.user_role] || 'bg-slate-50 border-slate-100';
            
            thread.innerHTML += `
                <div class="${style} p-6 rounded-2xl border shadow-sm">
                    <div class="flex justify-between items-center mb-3">
                        <p class="text-[9px] font-black uppercase tracking-widest opacity-60">${c.user_role} — ${c.user_name}</p>
                        <p class="text-[9px] opacity-40 font-bold">${new Date(c.created_at).toLocaleString('id-ID')}</p>
                    </div>
                    <p class="text-sm font-bold leading-relaxed italic">"${c.comment_text}"</p>
                </div>`;
        });
    }
}

async function postManagementComment() {
    const txt = document.getElementById('input-comment-text').value;
    const id = new URLSearchParams(window.location.search).get('id');
    if (!txt.trim()) return alert("Catatan arahan tidak boleh kosong!");

    const btn = document.getElementById('btnSubmitComment');
    btn.disabled = true; btn.innerText = "SINKRONISASI...";

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

// Fungsi Pendukung Signature Pad
function initSignaturePad() {
    canvas = document.getElementById('signature-pad');
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3; ctx.lineCap = 'round';

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

// Fungsi Close-Out
function openCloseOut(id) { activeFindingId = id; document.getElementById('modal-closeout').classList.remove('hidden'); }
function toggleModalClose(s) { document.getElementById('modal-closeout').classList.toggle('hidden', !s); }

async function processCloseOut() {
    const file = document.getElementById('file-perbaikan').files[0];
    const ket = document.getElementById('ket-perbaikan').value;
    if (!file || !ket) return alert("Wajib lampirkan foto perbaikan!");

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

// Fungsi PDF
async function downloadPDF() {
    const el = document.getElementById('printable-area');
    const btn = document.getElementById('btnDownloadPDF');
    btn.innerText = "GENERATING...";
    
    const options = {
        margin: [0.3, 0.3],
        filename: `REPORT_${document.getElementById('report-id').innerText}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 3, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(options).from(el).save().then(() => { btn.innerText = "Cetak PDF"; });
}