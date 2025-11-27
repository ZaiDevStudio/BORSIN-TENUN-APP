import { auth, db } from './config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { collection, addDoc, setDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// --- GLOBAL UTILS ---
const formatRupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n);
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// --- AUTH CHECK & ROUTER ---
onAuthStateChanged(auth, async (user) => {
    const pageId = document.body.id;
    console.log("Halaman saat ini:", pageId); // Untuk Debugging di Console

    if (user) {
        // Jika User Login
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const role = userDoc.exists() ? userDoc.data().role : 'user';
        sessionStorage.setItem('role', role);
        
        // Redirect jika masih di halaman login
        if (pageId === 'page-login') window.location.href = 'dashboard.html';
        
        // Sembunyikan menu Admin jika bukan Admin
        if (role !== 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }
        
        // Jalankan Logika Halaman
        if(pageId) initPageLogic(pageId, role);
        
    } else {
        // Jika Belum Login
        if (pageId !== 'page-login' && !pageId.includes('index')) {
            window.location.href = 'login.html';
        } else if (pageId === 'page-login') {
            // Jalankan logika login jika di halaman login
            initPageLogic(pageId, null);
        }
    }
});

// --- LOGIKA UTAMA PER HALAMAN ---
async function initPageLogic(pageId, role) {
    
    // LOGOUT LISTENER
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

    // 1. HALAMAN LOGIN & DAFTAR
    if (pageId === 'page-login') {
        // Login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault(); // Mencegah Refresh
                const btn = e.target.querySelector('button');
                const originalText = btn.textContent;
                btn.textContent = 'Memuat...';
                
                signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
                    .then(() => {
                        console.log("Login Berhasil");
                        // Redirect otomatis oleh onAuthStateChanged
                    })
                    .catch(err => {
                        console.error(err);
                        alert("Login Gagal: " + err.message);
                        btn.textContent = originalText;
                    });
            });
        }

        // Daftar
        const daftarForm = document.getElementById('daftarForm');
        if (daftarForm) {
            daftarForm.addEventListener('submit', (e) => {
                e.preventDefault(); // Mencegah Refresh
                const nama = document.getElementById('reg_nama').value;
                const email = document.getElementById('reg_email').value;
                const pass = document.getElementById('reg_password').value;
                const btn = e.target.querySelector('button');

                if(pass.length < 6) return alert("Kata sandi minimal 6 karakter!");
                
                btn.textContent = 'Mendaftar...';

                createUserWithEmailAndPassword(auth, email, pass)
                    .then(async (userCredential) => {
                        const user = userCredential.user;
                        await setDoc(doc(db, "users", user.uid), {
                            nama: nama,
                            email: email,
                            role: 'user', 
                            createdAt: new Date()
                        });
                        alert("Pendaftaran Berhasil!");
                    })
                    .catch((error) => {
                        alert("Gagal Mendaftar: " + error.message);
                        btn.textContent = 'Daftar Sekarang';
                    });
            });
        }
    }

    // 2. INPUT DATA (CREATE & EDIT)
    const forms = {
        'page-tambah-karyawan': { col: 'karyawan', hasImage: true, redirect: 'data_karyawan.html' },
        'page-tambah-ulos':     { col: 'ulos', hasImage: true, redirect: 'ulos.html' },
        'page-tambah-pesanan':  { col: 'pesanan', hasImage: false, redirect: 'pesanan.html' },
        'page-minta-upah':      { col: 'minta_upah', hasImage: false, redirect: 'permintaan_upah.html' }
    };

    if (forms[pageId]) {
        const config = forms[pageId];
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id'); 

        // Isi Data Dropdown (Jika Ada)
        if(document.getElementById('nama_ulos')) {
            const s = await getDocs(collection(db, 'ulos'));
            s.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.data().nama;
                opt.innerText = d.data().nama;
                document.getElementById('nama_ulos').appendChild(opt);
            });
        }
        if(document.getElementById('nama_karyawan')) {
            const k = await getDocs(collection(db, 'karyawan'));
            k.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.data().nama;
                opt.innerText = d.data().nama;
                document.getElementById('nama_karyawan').appendChild(opt);
            });
        }

        // Mode Edit: Ambil Data Lama
        if (editId) {
            document.querySelector('.navbar h2').innerText = "Edit Data"; 
            const docSnap = await getDoc(doc(db, config.col, editId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                const inputs = document.querySelectorAll('input:not([type="file"]), select');
                inputs.forEach(input => {
                    if (data[input.id]) input.value = data[input.id];
                });
            }
        }

        document.getElementById('formInput').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {};
            const inputs = e.target.querySelectorAll('input, select');
            
            for (const input of inputs) {
                if(input.type !== 'file' && input.id) formData[input.id] = input.value;
            }

            if (config.hasImage) {
                const file = document.getElementById('foto').files[0];
                if(file) {
                    formData.foto = await toBase64(file);
                }
            }
            
            formData.timestamp = new Date();

            try {
                if (editId) {
                    if(!formData.foto) delete formData.foto; 
                    await updateDoc(doc(db, config.col, editId), formData);
                    alert('Data Diperbarui!');
                } else {
                    await addDoc(collection(db, config.col), formData);
                    alert('Data Disimpan!');
                }
                window.location.href = config.redirect;
            } catch (err) {
                alert('Error: ' + err.message);
            }
        });
    }

    // 3. LIST DATA (READ & DELETE)
    const lists = {
        'page-data-karyawan': { col: 'karyawan', render: renderKaryawan },
        'page-pesanan': { col: 'pesanan', render: renderPesanan },
        'page-permintaan-upah': { col: 'minta_upah', render: renderMintaUpah },
        'page-ulos': { col: 'ulos', render: renderUlos }
    };

    if (lists[pageId]) {
        const config = lists[pageId];
        const container = document.getElementById('dataContainer') || document.getElementById('listUlos');
        
        if (container) {
            const q = query(collection(db, config.col), orderBy("timestamp", "desc"));
            const snap = await getDocs(q);
            container.innerHTML = '';
            snap.forEach(doc => container.appendChild(config.render(doc, role === 'admin')));
        }
    }

    // 4. KHUSUS REKAPAN GAJI
    if (pageId === 'page-rekapan-gaji') {
        const tbody = document.getElementById('tbodyGaji');
        const snap = await getDocs(query(collection(db, 'gaji'), orderBy("timestamp", "desc")));
        
        let totalUlos = 0, totalPakan = 0, totalGaji = 0, no = 1;

        snap.forEach(doc => {
            const d = doc.data();
            totalUlos += Number(d.jumlah || 0);
            totalPakan += Number(d.pakan || 0);
            totalGaji += Number(d.gajiBersih || 0);

            tbody.innerHTML += `<tr>
                <td>${no++}</td>
                <td>${d.timestamp?.toDate().toLocaleDateString()}</td>
                <td>${d.nama_karyawan || '-'}</td>
                <td>${d.jumlah}</td>
                <td>${formatRupiah(d.pakan)}</td>
                <td style="font-weight:bold; color:var(--primary)">${formatRupiah(d.gajiBersih)}</td>
                <td>${role === 'admin' ? `<button class="btn-danger btn-sm" onclick="hapusData('gaji','${doc.id}')"><i class="fas fa-trash"></i></button>` : ''}</td>
            </tr>`;
        });
        document.getElementById('t_ulos').innerText = totalUlos;
        document.getElementById('t_pakan').innerText = formatRupiah(totalPakan);
        document.getElementById('t_gaji').innerText = formatRupiah(totalGaji);
    }
}

// --- TEMPLATES RENDER ---
function renderUlos(doc, isAdmin) {
    const d = doc.data();
    const div = document.createElement('div');
    div.className = 'data-item';
    div.innerHTML = `
        <img src="${d.foto}" class="data-img" onclick="window.open('${d.foto}')">
        <div class="data-info">
            <h4>${d.nama} <span class="badge">${d.jenis}</span></h4>
            <p>Stok: ${d.stock} | Harga: ${formatRupiah(d.harga)}</p>
        </div>
        ${isAdmin ? makeAdminBtns('tambah_data_ulos.html', 'ulos', doc.id) : ''}
    `;
    return div;
}

function renderKaryawan(doc, isAdmin) {
    const d = doc.data();
    const div = document.createElement('div');
    div.className = 'data-item';
    div.innerHTML = `
        <img src="${d.foto || 'borsin.png'}" class="data-img">
        <div class="data-info">
            <h4>${d.nama}</h4>
            <p>${d.bank} - ${d.rekening}</p>
        </div>
        ${isAdmin ? makeAdminBtns('tambah_karyawan.html', 'karyawan', doc.id) : ''}
    `;
    return div;
}

function renderPesanan(doc, isAdmin) {
    const d = doc.data();
    const div = document.createElement('div');
    div.className = 'data-item';
    div.innerHTML = `
        <div class="data-info"><h4>${d.nama_ulos}</h4><p>Jml: ${d.jumlah} | Oleh: ${d.nama_karyawan}</p></div>
        ${isAdmin ? makeAdminBtns('tambah_pesanan.html', 'pesanan', doc.id) : ''}
    `;
    return div;
}

function renderMintaUpah(doc, isAdmin) {
    const d = doc.data();
    const div = document.createElement('div');
    div.className = 'data-item';
    div.innerHTML = `
        <div class="data-info"><h4>${d.nama_karyawan}</h4><p>Ulos: ${d.nama_ulos}</p></div>
        ${isAdmin ? makeAdminBtns('minta_upah.html', 'minta_upah', doc.id) : ''}
    `;
    return div;
}

// Helper Tombol Admin
function makeAdminBtns(page, col, id) {
    return `<div style="display:flex; flex-direction:column; gap:5px;">
        <a href="${page}?id=${id}" class="btn-warning btn-sm" style="text-decoration:none; text-align:center; padding:5px; color:#fff; border-radius:5px;"><i class="fas fa-edit"></i></a>
        <button class="btn-danger" style="width:auto; padding:5px;" onclick="hapusData('${col}','${id}')"><i class="fas fa-trash"></i></button>
    </div>`;
}

window.hapusData = async (col, id) => {
    if(confirm('Hapus Data?')) {
        await deleteDoc(doc(db, col, id));
        window.location.reload();
    }
};
        
