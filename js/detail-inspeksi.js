let canvas, ctx, isDrawing = false;
let activeFindingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('id');

    if (!inspectionId) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Menunggu Supabase Client siap dari app.js
    const checkClient = setInterval(() => {
        if (window.supabaseClient) {
            clearInterval(checkClient);
            initApp(inspectionId);
        }
    }, 100);

    // Event Listeners Button Utama
    document.getElementById('btnDownloadPDF').onclick = downloadPDF;
    document.getElementById('btnClearSign').onclick = clearSignature;
    document.getElementById('btnSubmitComment').onclick = postManagementComment;
    document.getElementById('btnSimpanCloseOut').onclick = processCloseOut;
});

/**
 * Inisialisasi Aplikasi & Cek Role
 */
async function initApp(id) {
    try {
        // Ambil data user aktif dan profilnya (Role)
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (user) {
            const { data: profile } = await window.supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            
            window.userRole = profile?.role || 'INSPECTOR';
        }

        await loadDetailData(id);
        initSignaturePad();
    } catch (error) {
        console.error("Error initializing app:", error);
    }
}

/**
 * Mengambil dan Menampilkan Data Inspeksi
 */
async function loadDetailData(id) {
    try {
        // 1. Ambil data utama inspeksi
        const { data: ins, error: insErr } = await window.supabaseClient
            .from('inspections')
            .select('*')
            .eq('id', id)
            .single();

        if (insErr) throw insErr;

        // 2. Isi Header Laporan
        document.getElementById('report-id').innerText = ins.id.substring(0, 8).toUpperCase();
        document.getElementById('det-tanggal').innerText = new Date(ins.tanggal_inspeksi)
            .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('det-lokasi').innerText = ins.lokasi_tambang;
        document.getElementById('det-area').innerText = ins.area_kerja || '-';

        // 3. Ambil data temuan, foto, dan komentar secara paralel
        const [findingsRes, photosRes, commentsRes] = await Promise.all([
            window.supabaseClient.from('inspection_findings').select('*').eq('inspection_id', id),
            window.supabaseClient.from('inspection_photos').select('*').eq('inspection_id', id),
            window.supabaseClient.from('inspection_comments').select('*').eq('inspection_id', id).order('created_at', { ascending: true })
        ]);

        renderFindingsTable(findingsRes.data || []);
        renderPhotosGrid(photosRes.data || [], findingsRes.data || []);
        renderCommentsThread(commentsRes.data || []);

        // 4. Set Nama Inspektur di Area Tanda Tangan
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        document.getElementById('inspector-name').innerText = user.email.split('@')[0].toUpperCase();

        // 5. Tampilkan Form Komentar jika role Manajemen (KTT, AMN, SHE)
        if (['KTT', 'AMN', 'SHE'].includes(window.userRole)) {
            document.getElementById('admin-comment-form').classList.remove('hidden');
            document.getElementById('label-role').innerText = window.userRole;
        }

    } catch (err) {
        console.error("Error loading data:", err);
        alert("Gagal memuat detail inspeksi.");
    }
}

/**
 * Render Tabel Temuan (Style DOCX)
 */
function renderFindingsTable(findings) {
    const tbody = document.getElementById('findings-table-body');
    tbody.innerHTML = '';

    findings.forEach((f, i) => {
        let actionContent = '';
        
        if (f.status === 'CLOSED') {
            actionContent = `<div class="mt-2 p-2 bg-green-50 text-green-700 text-[10px] rounded border border-green-200">
                                <b>VERIFIED CLOSED:</b><br>${f.keterangan_perbaikan}
                             </div>`;
        } else if (window.userRole === 'INSPECTOR') {
            actionContent = `<button onclick="openCloseOut('${f.id}')" class="no-print mt-2 block w-full text-[9px] bg-blue-600 text-white px-2 py-1.5 rounded font-bold hover:bg-blue-700 transition">
                                UPDATE PERBAIKAN
                             </button>`;
        }

        tbody.innerHTML += `
            <tr class="align-top">
                <td class="text-center font-bold text-xs p-3 border">${i + 1}</td>
                <td class="text-xs p-3 border">
                    <p class="font-bold text-slate-800">${f.what}</p>
                    <p class="text-slate-500 mt-1">${f.uraian_temuan || ''}</p>
                    <p class="text-[10px] mt-2 font-bold text-blue-600">LOKASI: ${f.where_location}</p>
                </td>
                <td class="text-center p-3 border">
                    <span class="text-[9px] font-black border px-2 py-1 rounded ${f.tingkat_risiko === 'HIGH' ? 'border-red-500 text-red-500' : 'border-amber-500 text-amber-500'}">
                        ${f.tingkat_risiko}
                    </span>
                </td>
                <td class="text-xs p-3 border">
                    <p class="font-medium text-slate-700">${f.rekomendasi || 'Segera lakukan perbaikan sesuai standar.'}</p>
                    ${actionContent}
                </td>
            </tr>`;
    });
}

/**
 * Render Lampiran Foto
 */
function renderPhotosGrid(photos, findings) {
    const pGrid = document.getElementById('photos-grid');
    pGrid.innerHTML = '';

    if (photos.length === 0) {
        pGrid.innerHTML = '<p class="col-span-2 text-center text-slate-400 text-xs italic">Tidak ada lampiran foto.</p>';
        return;
    }

    photos.forEach(p => {
        const { data: url } = window.supabaseClient.storage.from('inspeksi_files').getPublicUrl(p.file_path);
        const findWhat = findings.find(f => f.id === p.finding_id)?.what || 'Foto Temuan';

        pGrid.innerHTML += `
            <div class="border p-3 rounded-xl bg-white shadow-sm">
                <img src="https://images.weserv.nl/?url=${encodeURIComponent(url.publicUrl)}&w=500" 
                     class="w-full h-52 object-cover rounded-lg mb-3 border border-slate-100" 
                     crossOrigin="anonymous">
                <p class="text-[10px] text-center font-bold text-slate-600 uppercase tracking-tight">${findWhat}</p>
            </div>`;
    });
}

/**
 * Render Thread Komentar Manajemen
 */
function renderCommentsThread(comments) {
    const thread = document.getElementById('comments-thread');
    if (comments.length === 0) return;

    thread.innerHTML = '';
    comments.forEach(c => {
        const styles = {
            KTT: 'bg-red-50 border-red-100 text-red-800',
            AMN: 'bg-green-50 border-green-100 text-green-800',
            SHE: 'bg-blue-50 border-blue-100 text-blue-800'
        };
        const style = styles[c.user_role] || 'bg-slate-50 border-slate-200 text-slate-700';

        thread.innerHTML += `
            <div class="${style} p-4 rounded-xl border text-xs shadow-sm">
                <div class="flex justify-between mb-1 opacity-70">
                    <span class="font-black">${c.user_role} - ${c.user_name}</span>
                    <span>${new Date(c.created_at).toLocaleString('id-ID')}</span>
                </div>
                <p class="font-bold italic">"${c.comment_text}"</p>
            </div>`;
    });
}

/**
 * Fungsi Submit Komentar (KTT/AMN/SHE)
 */
async function postManagementComment() {
    const txt = document.getElementById('input-comment-text').value;
    const id = new URLSearchParams(window.location.search).get('id');
    if (!txt.trim()) return alert("Tulis arahan terlebih dahulu!");

    const btn = document.getElementById('btnSubmitComment');
    btn.disabled = true;
    btn.innerText = "MENGIRIM...";

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        const { error } = await window.supabaseClient.from('inspection_comments').insert({
            inspection_id: id,
            user_id: user.id,
            user_role: window.userRole,
            user_name: user.email.split('@')[0].toUpperCase(),
            comment_text: txt
        });

        if (error) throw error;
        location.reload();
    } catch (e) {
        alert(e.message);
        btn.disabled = false;
        btn.innerText = "Submit Arahan";
    }
}

/**
 * Inisialisasi Signature Pad (Canvas)
 */
function initSignaturePad() {
    canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

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

function clearSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Close-Out (Perbaikan Temuan)
 */
function openCloseOut(id) {
    activeFindingId = id;
    document.getElementById('modal-closeout').classList.remove('hidden');
}

function toggleModalClose(show) {
    document.getElementById('modal-closeout').classList.toggle('hidden', !show);
}

async function processCloseOut() {
    const file = document.getElementById('file-perbaikan').files[0];
    const ket = document.getElementById('ket-perbaikan').value;
    if (!file || !ket) return alert("Mohon lengkapi foto dan keterangan!");

    const btn = document.getElementById('btnSimpanCloseOut');
    btn.disabled = true;
    btn.innerText = "UPLOADING...";

    try {
        const path = `perbaikan/${Date.now()}-${file.name}`;
        await window.supabaseClient.storage.from('inspeksi_files').upload(path, file);
        
        const { error } = await window.supabaseClient.from('inspection_findings').update({ 
            status: 'CLOSED', 
            bukti_perbaikan_path: path, 
            keterangan_perbaikan: ket, 
            tanggal_perbaikan: new Date() 
        }).eq('id', activeFindingId);
        
        if (error) throw error;
        location.reload();
    } catch (e) {
        alert(e.message);
        btn.disabled = false;
        btn.innerText = "SIMPAN";
    }
}

/**
 * Export PDF (html2pdf)
 */
async function downloadPDF() {
    const el = document.getElementById('printable-area');
    const btn = document.getElementById('btnDownloadPDF');
    const originalText = btn.innerText;
    
    btn.innerText = "MENYIAPKAN...";
    
    const options = {
        margin: [0.3, 0.3, 0.3, 0.3],
        filename: `LAPORAN_INSPEKSI_${document.getElementById('report-id').innerText}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true, scrollY: 0, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(options).from(el).save().then(() => {
        btn.innerText = originalText;
    });
}