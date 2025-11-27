import { ..., updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { auth, db } from './config.js';
// Tambahkan 'createUserWithEmailAndPassword' dan 'setDoc'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { collection, addDoc, setDoc, getDocs, doc, deleteDoc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";


// --- GLOBAL AUTH CHECK ---
onAuthStateChanged(auth, async (user) => {
    const currentPath = window.location.pathname;
    
    if (user) {
        // Cek Role User
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : { role: 'user' }; // Default user
        
        // Simpan role di session storage untuk akses cepat
        sessionStorage.setItem('role', userData.role);

        // Jika di halaman login, lempar ke dashboard
        if (currentPath.includes('login.html')) {
            window.location.href = 'dashboard.html';
        }

        // Logic menyembunyikan menu admin untuk user biasa
        if (userData.role !== 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }

    } else {
        // Jika belum login dan bukan di halaman login, tendang ke login
        if (!currentPath.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }
});

// --- FUNGSI UTILITAS ---
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(angka);
}

// Convert Image to Base64 (Untuk demo sederhana tanpa Storage Bucket)
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// --- LOGIKA PER HALAMAN ---
const pageId = document.body.id;

// 1. LOGIN PAGE    // 1. LOGIN & DAFTAR
    if (pageId === 'page-login') {
        // Logika Login
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.textContent = 'Memuat...';
            
            signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
                .then(() => {
                    // Berhasil login, onAuthStateChanged akan mengarahkan ke dashboard
                })
                .catch(err => {
                    alert("Login Gagal: " + err.message);
                    btn.textContent = 'Masuk';
                });
        });

        // Logika Daftar (Register)
        document.getElementById('daftarForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const nama = document.getElementById('reg_nama').value;
            const email = document.getElementById('reg_email').value;
            const pass = document.getElementById('reg_password').value;
            const btn = e.target.querySelector('button');

            if(pass.length < 6) return alert("Kata sandi minimal 6 karakter!");

            btn.textContent = 'Mendaftar...';

            createUserWithEmailAndPassword(auth, email, pass)
                .then(async (userCredential) => {
                    const user = userCredential.user;
                    
                    // Simpan data user ke database 'users' dengan role default 'user'
                    await setDoc(doc(db, "users", user.uid), {
                        nama: nama,
                        email: email,
                        role: 'user', // Default role user biasa, bukan admin
                        createdAt: new Date()
                    });

                    alert("Pendaftaran Berhasil! Selamat datang.");
                    // Otomatis akan dialihkan ke dashboard karena sudah login
                })
                .catch((error) => {
                    alert("Gagal Mendaftar: " + error.message);
                    btn.textContent = 'Daftar Sekarang';
                });
        });
    }


// 2. DASHBOARD
if (pageId === 'page-dashboard') {
    document.getElementById('btnLogout').addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = 'login.html');
    });
}

// 3. TAMBAH ULOS (Logic Input)
if (pageId === 'page-tambah-ulos') {
    document.getElementById('formUlos').addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('foto').files[0];
        if(!file) return alert('Pilih foto!');
        
        const imgBase64 = await toBase64(file);
        
        const data = {
            nama: document.getElementById('nama').value,
            jenis: document.getElementById('jenis').value,
            motif: document.getElementById('motif').value,
            warna: document.getElementById('warna').value,
            upah: Number(document.getElementById('upah').value),
            stock: Number(document.getElementById('stock').value),
            harga: Number(document.getElementById('harga').value),
            foto: imgBase64,
            timestamp: new Date()
        };

        try {
            await addDoc(collection(db, "ulos"), data);
            alert('Data Ulos Berhasil Disimpan!');
            window.location.href = 'ulos.html';
        } catch (err) {
            alert('Gagal: ' + err.message);
        }
    });
}

// 4. GALERI ULOS (Logic Tampil Data)
if (pageId === 'page-ulos') {
    const container = document.getElementById('listUlos');
    const isAdmin = sessionStorage.getItem('role') === 'admin';

    const renderData = async () => {
        container.innerHTML = '<p class="text-center">Memuat data...</p>';
        const q = query(collection(db, "ulos"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const el = document.createElement('div');
            el.className = 'data-item';
            el.innerHTML = `
                <img src="${data.foto}" class="data-img" onclick="window.open('${data.foto}')">
                <div class="data-info">
                    <h4>${data.nama} <span class="badge">${data.jenis}</span></h4>
                    <p>Motif: ${data.motif} | Warna: ${data.warna}</p>
                    <p><strong>Harga: ${formatRupiah(data.harga)}</strong></p>
                    <p><small>Stok: ${data.stock} | Upah: ${formatRupiah(data.upah)}</small></p>
                </div>
                ${isAdmin ? `<button class="btn-danger" style="width:auto; padding:5px 10px;" onclick="hapusData('ulos', '${doc.id}')"><i class="fas fa-trash"></i></button>` : ''}
            `;
            container.appendChild(el);
        });
    };
    renderData();

    window.hapusData = async (col, id) => {
        if(confirm('Hapus data ini?')) {
            await deleteDoc(doc(db, col, id));
            renderData();
        }
    }
}

// 5. HITUNG GAJI (Logic Kalkulasi)
if (pageId === 'page-hitung-gaji') {
    // Populate Dropdowns (Karyawan & Ulos)
    // Note: Anda perlu menambah logika fetch collection 'karyawan' dan 'ulos' disini
    // Untuk demo saya hardcode logika hitungnya

    document.getElementById('btnHitung').addEventListener('click', () => {
        const jumlah = Number(document.getElementById('jumlah').value);
        const upahPerLembar = Number(document.getElementById('upah_lembar').value); // Harusnya otomatis dari dropdown Ulos
        const pakan = Number(document.getElementById('pakan').value);
        
        // Potongan
        const air = Number(document.getElementById('pot_air').value) || 0;
        const wifi = Number(document.getElementById('pot_wifi').value) || 0;
        const stell = Number(document.getElementById('pot_stell').value) || 0;
        const lain = Number(document.getElementById('pot_lain').value) || 0;
        
        const totalPotongan = air + wifi + stell + lain;
        const gajiKotor = jumlah * upahPerLembar;
        const gajiBersih = gajiKotor - pakan - totalPotongan;

        document.getElementById('total_gaji').value = formatRupiah(gajiBersih);
        
        // Simpan ke object global untuk nanti disave
        window.tempGajiData = {
            gajiBersih, totalPotongan, pakan, jumlah, timestamp: new Date()
            // Tambahkan field nama, dll dari input
        };
    });

    document.getElementById('formGaji').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!window.tempGajiData) return alert('Silakan hitung terlebih dahulu');
        
        await addDoc(collection(db, "gaji"), window.tempGajiData);
        alert('Data Gaji Tersimpan');
        window.location.href = 'rekapan_gaji.html';
    });
}
import { auth, db } from './config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// --- GLOBAL UTILS ---
const formatRupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n);
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// --- AUTH CHECK ---
onAuthStateChanged(auth, async (user) => {
    const pageId = document.body.id;
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const role = userDoc.exists() ? userDoc.data().role : 'user';
        sessionStorage.setItem('role', role);
        
        if (pageId === 'page-login') window.location.href = 'dashboard.html';
        if (role !== 'admin') document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        
        // Load Data Spesifik per Halaman
        if(pageId) initPageLogic(pageId, role);
        
    } else {
        if (pageId !== 'page-login') window.location.href = 'login.html';
    }
});

// --- LOGIKA HALAMAN (ROUTER) ---
async function initPageLogic(pageId, role) {
    
    // LOGOUT
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

    // 1. LOGIN
    if (pageId === 'page-login') {
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
                .catch(err => alert("Login Gagal: " + err.message));
        });
    }

    // 2. INPUT DATA (Generic Handler)    // ... (Kode Login di atas tetap sama) ...

    // 2. INPUT DATA & EDIT DATA (Update Logic)
    const forms = {
        'page-tambah-karyawan': { col: 'karyawan', hasImage: true, redirect: 'data_karyawan.html' },
        'page-tambah-ulos':     { col: 'ulos', hasImage: true, redirect: 'ulos.html' }, // Tambahkan ini jika halaman tambah ulos ada
        'page-tambah-pesanan':  { col: 'pesanan', hasImage: false, redirect: 'pesanan.html' },
        'page-minta-upah':      { col: 'minta_upah', hasImage: false, redirect: 'permintaan_upah.html' }
    };

    if (forms[pageId]) {
        const config = forms[pageId];
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id'); // Cek apakah sedang mode Edit?

        // A. Jika Mode Edit: Ambil data lama & isi form
        if (editId) {
            document.querySelector('.navbar h2').innerText = "Edit Data"; // Ubah judul
            document.querySelector('button[type="submit"]').innerText = "Perbarui Data";
            
            const docSnap = await getDoc(doc(db, config.col, editId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Loop semua input dan isi nilainya
                const inputs = document.querySelectorAll('input:not([type="file"]), select');
                inputs.forEach(input => {
                    if (data[input.id]) input.value = data[input.id];
                });
            }
        }

        // B. Populate Dropdown (Pesanan/Upah)
        if(pageId.includes('pesanan') || pageId.includes('upah')) {
            const ulosSelect = document.getElementById('nama_ulos');
            const karSelect = document.getElementById('nama_karyawan');
            
            if(ulosSelect) {
                const s = await getDocs(collection(db, 'ulos'));
                s.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.data().nama;
                    opt.innerText = d.data().nama;
                    ulosSelect.appendChild(opt);
                });
                // Set nilai dropdown jika mode edit
                if(editId) { 
                    const d = await getDoc(doc(db, config.col, editId));
                    if(d.exists()) ulosSelect.value = d.data().nama_ulos;
                }
            }
            if(karSelect) {
                const k = await getDocs(collection(db, 'karyawan'));
                k.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.data().nama;
                    opt.innerText = d.data().nama;
                    karSelect.appendChild(opt);
                });
                if(editId) {
                    const d = await getDoc(doc(db, config.col, editId));
                    if(d.exists()) karSelect.value = d.data().nama_karyawan;
                }
            }
        }

        // C. Simpan Data (Create / Update)
        document.getElementById('formInput').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {};
            const inputs = e.target.querySelectorAll('input, select');
            
            for (const input of inputs) {
                if(input.type !== 'file' && input.id) formData[input.id] = input.value;
            }

            // Cek Foto: Jika upload baru pakai baru, jika tidak pakai lama
            if (config.hasImage) {
                const file = document.getElementById('foto').files[0];
                if(file) {
                    formData.foto = await toBase64(file);
                } else if (editId) {
                    // Jika edit tapi tidak ganti foto, tidak usah update field foto
                }
            }
            
            formData.timestamp = new Date();

            try {
                if (editId) {
                    // MODE UPDATE
                    // Hapus field foto jika undefined agar tidak menimpa data lama dengan kosong
                    if(!formData.foto) delete formData.foto; 
                    
                    await updateDoc(doc(db, config.col, editId), formData); // Gunakan updateDoc dari import
                    alert('Data Berhasil Diperbarui!');
                } else {
                    // MODE CREATE BARU
                    await addDoc(collection(db, config.col), formData);
                    alert('Data Berhasil Disimpan!');
                }
                window.location.href = config.redirect;
            } catch (err) {
                console.error(err);
                alert('Terjadi kesalahan: ' + err.message);
            }
        });
    }

    // ... (Bagian 3. List Data di bawah ini) ...


    // 3. MENAMPILKAN DATA (Generic List)
   // --- RENDER TEMPLATES (DENGAN TOMBOL EDIT) ---

function renderKaryawan(doc, isAdmin) {
    const d = doc.data();
    const div = document.createElement('div');
    div.className = 'data-item';
    div.innerHTML = `
        <img src="${d.foto || 'borsin.png'}" class="data-img">
        <div class="data-info">
            <h4>${d.nama} <span class="badge">${d.jk}</span></h4>
            <p><i class="fab fa-whatsapp"></i> ${d.hp}</p>
            <p><i class="fas fa-university"></i> ${d.bank} - ${d.rekening}</p>
        </div>
        ${isAdmin ? `
            <div style="display:flex; gap:5px; flex-direction:column;">
                <a href="tambah_karyawan.html?id=${doc.id}" class="btn-warning btn-sm" style="text-decoration:none; text-align:center; color:white; padding:5px; border-radius:5px;"><i class="fas fa-edit"></i></a>
                <button class="btn-danger" style="width:auto; padding:5px;" onclick="hapusData('karyawan','${doc.id}')"><i class="fas fa-trash"></i></button>
            </div>
        ` : ''}
    `;
    return div;
}

function renderPesanan(doc, isAdmin) {
    const d = doc.data();
    const div = document.createElement('div');
    div.className = 'data-item';
    div.innerHTML = `
        <div class="data-info">
            <h4>Pesanan: ${d.nama_ulos}</h4>
            <p>Jumlah: <strong>${d.jumlah} Lembar</strong></p>
            <p>Oleh: ${d.nama_karyawan}</p>
        </div>
        ${isAdmin ? `
            <div style="display:flex; gap:5px;">
                <a href="tambah_pesanan.html?id=${doc.id}" class="btn-warning btn-sm" style="color:white; padding:5px 10px; border-radius:5px;"><i class="fas fa-edit"></i></a>
                <button class="btn-danger" style="width:auto; padding:5px 10px;" onclick="hapusData('pesanan','${doc.id}')"><i class="fas fa-trash"></i></button>
            </div>
        ` : ''}
    `;
    return div;
}

function renderMintaUpah(doc, isAdmin) {
    const d = doc.data();
    const div = document.createElement('div');
    div.className = 'data-item';
    div.innerHTML = `
        <div class="data-info">
            <h4>${d.nama_karyawan}</h4>
            <p>${d.nama_ulos} (${d.jumlah} lbr)</p>
            <p>Pot. Lain: ${formatRupiah(d.biaya_lain || 0)}</p>
        </div>
        ${isAdmin ? `
            <div style="display:flex; gap:5px;">
                <a href="minta_upah.html?id=${doc.id}" class="btn-warning btn-sm" style="color:white; padding:5px 10px; border-radius:5px;"><i class="fas fa-edit"></i></a>
                <button class="btn-danger" style="width:auto; padding:5px 10px;" onclick="hapusData('minta_upah','${doc.id}')"><i class="fas fa-trash"></i></button>
            </div>
        ` : ''}
    `;
    return div;
}


    // 4. REKAPAN GAJI (Table & Export)
    if (pageId === 'page-rekapan-gaji') {
        const tbody = document.getElementById('tbodyGaji');
        const snap = await getDocs(query(collection(db, 'gaji'), orderBy("timestamp", "desc")));
        
        let totalUlos = 0, totalPakan = 0, totalGaji = 0;
        let no = 1;

        snap.forEach(doc => {
            const d = doc.data();
            totalUlos += Number(d.jumlah || 0);
            totalPakan += Number(d.pakan || 0);
            totalGaji += Number(d.gajiBersih || 0);

            const row = `<tr>
                <td>${no++}</td>
                <td>${d.timestamp?.toDate().toLocaleDateString()}</td>
                <td>${d.nama_karyawan || '-'}</td>
                <td>${d.jumlah}</td>
                <td>${formatRupiah(d.pakan)}</td>
                <td style="font-weight:bold; color:var(--primary)">${formatRupiah(d.gajiBersih)}</td>
                <td>
                    <button class="btn-sm" onclick="navigator.clipboard.writeText('${d.gajiBersih}')"><i class="fas fa-copy"></i></button>
                    ${role === 'admin' ? `<button class="btn-sm btn-del" onclick="hapusData('gaji','${doc.id}')"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            </tr>`;
            tbody.innerHTML += row;
        });

        document.getElementById('t_ulos').innerText = totalUlos;
        document.getElementById('t_pakan').innerText = formatRupiah(totalPakan);
        document.getElementById('t_gaji').innerText = formatRupiah(totalGaji);
    }
}

// --- RENDER TEMPLATES ---
function renderKaryawan(doc, isAdmin) {
    const d = doc.data();
    const div = document.createElement('div');
    div.className = 'data-item';
    div.innerHTML = `
        <img src="${d.foto || 'borsin.png'}" class="data-img">
        <div class="data-info">
            <h4>${d.nama} <span class="badge">${d.jk}</span></h4>
            <p><i class="fab fa-whatsapp"></i> ${d.hp}</p>
            <p><i class="fas fa-university"></i> ${d.bank} - ${d.rekening} 
               <i class="fas fa-copy" style="cursor:pointer; color:blue;" onclick="navigator.clipboard.writeText('${d.rekening}')"></i>
            </p>
        </div>
        ${isAdmin ? `<button class="btn-danger" style="width:auto" onclick="hapusData('karyawan','${doc.id}')"><i class="fas fa-trash"></i></button>` : ''}
    `;
    return div;
}

function renderPesanan(doc, isAdmin) {
    const d = doc.data();
    const div = document.createElement('div');
    div.className = 'data-item';
    div.innerHTML = `
        <div class="data-info">
            <h4>Pesanan: ${d.nama_ulos}</h4>
            <p>Jumlah: <strong>${d.jumlah} Lembar</strong></p>
            <p>Dikerjakan oleh: ${d.nama_karyawan}</p>
        </div>
        ${isAdmin ? `<button class="btn-danger" style="width:auto" onclick="hapusData('pesanan','${doc.id}')"><i class="fas fa-trash"></i></button>` : ''}
    `;
    return div;
}

function renderMintaUpah(doc, isAdmin) {
    const d = doc.data();
    const div = document.createElement('div');
    div.className = 'data-item';
    div.innerHTML = `
        <div class="data-info">
            <h4>${d.nama_karyawan} <span class="badge">Minta Upah</span></h4>
            <p>Ulos: ${d.nama_ulos} (${d.jumlah} lbr)</p>
            <p>Potongan Lain: ${formatRupiah(d.biaya_lain || 0)}</p>
        </div>
        ${isAdmin ? `<button class="btn-danger" style="width:auto" onclick="hapusData('minta_upah','${doc.id}')"><i class="fas fa-trash"></i></button>` : ''}
    `;
    return div;
}

// Global Delete Function
window.hapusData = async (col, id) => {
    if(confirm('Hapus data ini permanen?')) {
        await deleteDoc(doc(db, col, id));
        window.location.reload();
    }
};
